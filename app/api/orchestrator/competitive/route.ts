import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { checkEnv } from "@/lib/env";
checkEnv();

export const maxDuration = 60;

const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type LogEntry = {
  id: string;
  timestamp: string;
  actor: "coordinator" | "agent_a" | "agent_b" | "agent_c";
  type: "plan" | "assignment" | "output" | "critique" | "decision" | "final";
  content: string;
};

function log(actor: LogEntry["actor"], type: LogEntry["type"], content: string): LogEntry {
  return { id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, timestamp: new Date().toISOString(), actor, type, content };
}

// Strip non-ASCII characters before sending to DeepSeek / Groq
function clean(text: string): string {
  return text
    .replace(/—/g, "-")
    .replace(/–/g, "-")
    .replace(/‘/g, "'")
    .replace(/’/g, "'")
    .replace(/“/g, '"')
    .replace(/”/g, '"')
    .replace(/…/g, "...")
    .replace(/[^\x00-\x7F]/g, "");
}

type Msg = { role: string; content: string };

async function deepseek(messages: Msg[], temperature = 0.8): Promise<string> {
  const deepseekKey = (process.env.DEEPSEEK_API_KEY ?? "").replace(/[^\x00-\x7F]/g, "");
  const payload = JSON.stringify({ model: "deepseek-chat", messages: messages.map(m => ({ ...m, content: clean(m.content) })), temperature });
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8", "Authorization": `Bearer ${deepseekKey}` },
    body: Buffer.from(payload, "utf8"),
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`DeepSeek error ${res.status}: ${t.slice(0, 200)}`); }
  const data = await res.json() as { choices: { message: { content: string } }[] };
  return data.choices[0].message.content ?? "";
}

async function groq(messages: Msg[], temperature = 0.8): Promise<string> {
  const groqKey = (process.env.GROQ_API_KEY ?? "").replace(/[^\x00-\x7F]/g, "");
  const payload = JSON.stringify({ model: "llama-3.3-70b-versatile", messages: messages.map(m => ({ ...m, content: clean(m.content) })), temperature });
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8", "Authorization": `Bearer ${groqKey}` },
    body: Buffer.from(payload, "utf8"),
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`Groq error ${res.status}: ${t.slice(0, 200)}`); }
  const data = await res.json() as { choices: { message: { content: string } }[] };
  return data.choices[0].message.content ?? "";
}

export async function POST(req: NextRequest) {
  let body: { topic?: string; userMessage?: string; previousFinal?: string; round?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body", code: "INVALID_BODY" }, { status: 400 });
  }
  const { topic, userMessage, previousFinal, round = 1 } = body;
  const logs: LogEntry[] = [];
  const isReRun = round > 1 && previousFinal;

  try {
    // STEP 0: Orchestrator plans (OpenAI)
    const planRes = await openaiClient.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are the Main Orchestrator managing a competitive multi-agent system. Three agents (A, B, C) will independently write a report, then critique each other, and you will decide the final version. Return JSON: { \"plan\": string, \"briefForAgents\": string }",
        },
        {
          role: "user",
          content: isReRun
            ? `Round ${round}. Previous output:\n${previousFinal}\n\nUser feedback: "${userMessage}"\n\nCreate a revised competition brief addressing the feedback.`
            : `Task: Industrial report on "${topic}".\nUser preferences: "${userMessage || "No specific preferences."}"\n\nPlan the competition and write a brief for all three agents.`,
        },
      ],
    });
    const plan = JSON.parse(planRes.choices[0].message.content ?? "{}");
    const brief = plan.briefForAgents ?? `Write a professional industrial report on "${topic}".`;
    logs.push(log("coordinator", "plan", plan.plan ?? "Launching competitive pipeline."));
    logs.push(log("coordinator", "assignment", `Briefing all agents: ${brief}`));

    // STEP 1: All three agents generate in parallel
    const promptA = `You are Agent A (ChatGPT). Style: Analytical and Structured.\nBrief: ${brief}\nWrite 250-300 words. Return ONLY the report text.`;
    const promptB = `You are Agent B (DeepSeek). Style: Narrative and Flowing.\nBrief: ${brief}\nWrite 250-300 words. Return ONLY the report text.`;
    const promptC = `You are Agent C (Groq Llama). Style: Critical and Concise.\nBrief: ${brief}\nWrite 250-300 words. Return ONLY the report text.`;

    const [outputA, outputB, outputC] = await Promise.all([
      openaiClient.chat.completions.create({
        model: "gpt-4o", temperature: 0.8,
        messages: [{ role: "user", content: promptA }],
      }).then(r => r.choices[0].message.content ?? "").catch(e => { throw new Error(`Agent A (ChatGPT) failed: ${e.message}`); }),
      deepseek([{ role: "user", content: promptB }], 0.8).catch(e => { throw new Error(`Agent B (DeepSeek) failed: ${e.message}`); }),
      groq([{ role: "user", content: promptC }], 0.8).catch(e => { throw new Error(`Agent C (Groq) failed: ${e.message}`); }),
    ]);

    logs.push(log("agent_a", "output", `Draft complete (${outputA.split(/\s+/).length} words) - ChatGPT's response.`));
    logs.push(log("agent_b", "output", `Draft complete (${outputB.split(/\s+/).length} words) - DeepSeek's response.`));
    logs.push(log("agent_c", "output", `Draft complete (${outputC.split(/\s+/).length} words) - Groq's response.`));

    // STEP 2: Critique round
    logs.push(log("coordinator", "assignment", "Starting critique round - each agent will evaluate the other two outputs."));

    const critiqueA_prompt = `You are Agent A. Critique Agent B and Agent C outputs (2-3 sentences each).\nAgent B:\n${outputB}\nAgent C:\n${outputC}`;
    const critiqueB_prompt = `You are Agent B. Critique Agent A and Agent C outputs (2-3 sentences each).\nAgent A:\n${outputA}\nAgent C:\n${outputC}`;
    const critiqueC_prompt = `You are Agent C. Critique Agent A and Agent B outputs (2-3 sentences each).\nAgent A:\n${outputA}\nAgent B:\n${outputB}`;

    const [critiqueA, critiqueB, critiqueC] = await Promise.all([
      openaiClient.chat.completions.create({
        model: "gpt-4o", temperature: 0.7,
        messages: [{ role: "user", content: critiqueA_prompt }],
      }).then(r => r.choices[0].message.content ?? ""),
      deepseek([{ role: "user", content: critiqueB_prompt }], 0.7),
      groq([{ role: "user", content: critiqueC_prompt }], 0.7),
    ]);

    logs.push(log("agent_a", "critique", `Agent A's critique: ${critiqueA}`));
    logs.push(log("agent_b", "critique", `Agent B's critique: ${critiqueB}`));
    logs.push(log("agent_c", "critique", `Agent C's critique: ${critiqueC}`));

    // STEP 3: Orchestrator decides final version (OpenAI)
    const decisionRes = await openaiClient.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.6,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are the Main Orchestrator. Review all three agent outputs and critiques, then decide the final version. Return JSON: { \"decision\": string, \"rationale\": string, \"finalVersion\": string }",
        },
        {
          role: "user",
          content: `Agent A (ChatGPT):\n${outputA}\n\nAgent B (DeepSeek):\n${outputB}\n\nAgent C (Groq):\n${outputC}\n\nCritiques:\nA: ${critiqueA}\nB: ${critiqueB}\nC: ${critiqueC}\n\nUser preferences: ${userMessage || "None."}\n\nReturn JSON.`,
        },
      ],
    });

    const decision = JSON.parse(decisionRes.choices[0].message.content ?? "{}");
    logs.push(log("coordinator", "decision", decision.decision ?? "Decision made based on agent outputs and critiques."));
    logs.push(log("coordinator", "final", decision.rationale ?? "Final version selected and ready for review."));

    return NextResponse.json({
      success: true,
      logs,
      agentOutputs: [
        { id: 1, name: "Agent A", style: "ChatGPT's Response",  output: outputA, critique: critiqueA },
        { id: 2, name: "Agent B", style: "DeepSeek's Response", output: outputB, critique: critiqueB },
        { id: 3, name: "Agent C", style: "Groq's Response",     output: outputC, critique: critiqueC },
      ],
      finalVersion: decision.finalVersion ?? outputA,
      coordinatorDecision: decision.decision ?? "",
      coordinatorRationale: decision.rationale ?? "",
      round,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Coordination failed";
    console.error("[competitive orchestrator]", message);
    return NextResponse.json({ error: message, logs }, { status: 500 });
  }
}
