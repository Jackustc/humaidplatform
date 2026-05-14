import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { checkEnv } from "@/lib/env";
checkEnv();

export const maxDuration = 60; // Vercel max for hobby plan

const openaiClient   = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const deepseekClient = new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: "https://api.deepseek.com" });
const groqClient     = new OpenAI({ apiKey: process.env.GROQ_API_KEY,     baseURL: "https://api.groq.com/openai/v1" });

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
    // ── STEP 0: Orchestrator plans (OpenAI) ──
    const planRes = await openaiClient.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are the Main Orchestrator managing a competitive multi-agent system. Three agents (A, B, C) will independently write a report, then critique each other, and you will decide the final version.
Return JSON: { "plan": string, "briefForAgents": string }`,
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
    logs.push(log("coordinator", "plan", plan.plan ?? "Launching competitive pipeline — three agents will work independently then critique each other."));
    logs.push(log("coordinator", "assignment", `Briefing all agents — ${plan.briefForAgents ?? "Write an independent industrial report. Each agent will use a distinct style."}`));

    // ── STEP 1: All three agents generate in parallel (each using their own model) ──
    const agentPrompt = (style: string) =>
      `You are an AI agent writing an industrial report. Style: ${style}.\nOrchestrator brief: ${plan.briefForAgents ?? `Write a professional industrial report on "${topic}".`}\nWrite ~250–300 words. Return ONLY the report text.`;

    const [resA, resB, resC] = await Promise.all([
      openaiClient.chat.completions.create({
        model: "gpt-4o", temperature: 0.8,
        messages: [
          { role: "system", content: "You are Agent A (ChatGPT). Style: Analytical and Structured. Use clear headers, bullet points, and evidence-based reasoning." },
          { role: "user", content: agentPrompt("Analytical and Structured — use clear headers, bullet points, evidence-based reasoning") },
        ],
      }).catch((e) => { throw new Error(`Agent A (ChatGPT) failed: ${e.message}`); }),
      deepseekClient.chat.completions.create({
        model: "deepseek-chat", temperature: 0.8,
        messages: [
          { role: "system", content: "You are Agent B (DeepSeek). Style: Narrative and Flowing. Write in cohesive prose that tells a story." },
          { role: "user", content: agentPrompt("Narrative and Flowing — cohesive prose, storytelling, smooth transitions") },
        ],
      }).catch((e) => { throw new Error(`Agent B (DeepSeek) failed: ${e.message}`); }),
      groqClient.chat.completions.create({
        model: "llama-3.3-70b-versatile", temperature: 0.8,
        messages: [
          { role: "system", content: "You are Agent C (Groq Llama). Style: Critical and Concise. Be direct, surface tensions, highlight gaps." },
          { role: "user", content: agentPrompt("Critical and Concise — direct, surfaces tensions and gaps, no filler") },
        ],
      }).catch((e) => { throw new Error(`Agent C (Groq) failed: ${e.message}`); }),
    ]);

    const outputA = resA.choices[0].message.content ?? "";
    const outputB = resB.choices[0].message.content ?? "";
    const outputC = resC.choices[0].message.content ?? "";

    logs.push(log("agent_a", "output", `Draft complete (${outputA.split(/\s+/).length} words) — ChatGPT's response.`));
    logs.push(log("agent_b", "output", `Draft complete (${outputB.split(/\s+/).length} words) — DeepSeek's response.`));
    logs.push(log("agent_c", "output", `Draft complete (${outputC.split(/\s+/).length} words) — Groq's response.`));

    // ── STEP 2: Critique round — each agent critiques using their own model ──
    logs.push(log("coordinator", "assignment", "Starting critique round — each agent will evaluate the other two outputs."));

    const critiquePrompt = (myName: string, myOutput: string, others: { name: string; output: string }[]) =>
      `You are ${myName}. Read the other agents' outputs and provide a brief critique (2–3 sentences per agent) covering strengths and weaknesses. Be specific and constructive.\n\n${others.map(o => `${o.name} output:\n${o.output}`).join("\n\n")}`;

    const [critA, critB, critC] = await Promise.all([
      openaiClient.chat.completions.create({
        model: "gpt-4o", temperature: 0.7,
        messages: [
          { role: "system", content: "You are Agent A (ChatGPT) critiquing other agents. Be honest, specific, and constructive." },
          { role: "user", content: critiquePrompt("Agent A", outputA, [{ name: "Agent B", output: outputB }, { name: "Agent C", output: outputC }]) },
        ],
      }),
      deepseekClient.chat.completions.create({
        model: "deepseek-chat", temperature: 0.7,
        messages: [
          { role: "system", content: "You are Agent B (DeepSeek) critiquing other agents. Be honest, specific, and constructive." },
          { role: "user", content: critiquePrompt("Agent B", outputB, [{ name: "Agent A", output: outputA }, { name: "Agent C", output: outputC }]) },
        ],
      }),
      groqClient.chat.completions.create({
        model: "llama-3.3-70b-versatile", temperature: 0.7,
        messages: [
          { role: "system", content: "You are Agent C (Groq Llama) critiquing other agents. Be honest, specific, and constructive." },
          { role: "user", content: critiquePrompt("Agent C", outputC, [{ name: "Agent A", output: outputA }, { name: "Agent B", output: outputB }]) },
        ],
      }),
    ]);

    const critiqueA = critA.choices[0].message.content ?? "";
    const critiqueB = critB.choices[0].message.content ?? "";
    const critiqueC = critC.choices[0].message.content ?? "";

    logs.push(log("agent_a", "critique", `Agent A's critique of B & C: ${critiqueA}`));
    logs.push(log("agent_b", "critique", `Agent B's critique of A & C: ${critiqueB}`));
    logs.push(log("agent_c", "critique", `Agent C's critique of A & B: ${critiqueC}`));

    // ── STEP 3: Orchestrator decides final version (OpenAI) ──
    const decisionRes = await openaiClient.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.6,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are the Main Orchestrator. Having reviewed all three agent outputs and their critiques, decide the final version to deliver to the user. You may select the best output as-is, or synthesise elements from multiple agents.
Return JSON: { "decision": string, "rationale": string, "finalVersion": string }`,
        },
        {
          role: "user",
          content: `Agent outputs:\n\nAgent A (ChatGPT):\n${outputA}\n\nAgent B (DeepSeek):\n${outputB}\n\nAgent C (Groq):\n${outputC}\n\nCritiques:\nAgent A on B&C: ${critiqueA}\nAgent B on A&C: ${critiqueB}\nAgent C on A&B: ${critiqueC}\n\nUser preferences: ${userMessage || "None specified."}\n\nDecide and produce the final version. Return JSON.`,
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
