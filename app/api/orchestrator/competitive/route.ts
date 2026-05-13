import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { checkEnv } from "@/lib/env";
checkEnv();

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
    // ── STEP 0: Coordinator plans ──
    const planRes = await client.chat.completions.create({
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

    // ── STEP 1: All three agents generate in parallel ──
    const agentPrompt = (style: string) => `You are an AI agent writing an industrial report. Style: ${style}.\nOrchestrator brief: ${plan.briefForAgents ?? `Write a professional industrial report on "${topic}".`}\nWrite ~250–300 words. Return ONLY the report text.`;

    const [resA, resB, resC] = await Promise.all([
      client.chat.completions.create({
        model: "gpt-4o", temperature: 0.8,
        messages: [
          { role: "system", content: "You are Agent A. Style: Analytical and Structured. Use clear headers, bullet points, and evidence-based reasoning." },
          { role: "user", content: agentPrompt("Analytical and Structured — use clear headers, bullet points, evidence-based reasoning") },
        ],
      }),
      client.chat.completions.create({
        model: "gpt-4o", temperature: 0.8,
        messages: [
          { role: "system", content: "You are Agent B. Style: Narrative and Flowing. Write in cohesive prose that tells a story." },
          { role: "user", content: agentPrompt("Narrative and Flowing — cohesive prose, storytelling, smooth transitions") },
        ],
      }),
      client.chat.completions.create({
        model: "gpt-4o", temperature: 0.8,
        messages: [
          { role: "system", content: "You are Agent C. Style: Critical and Concise. Be direct, surface tensions, highlight gaps." },
          { role: "user", content: agentPrompt("Critical and Concise — direct, surfaces tensions and gaps, no filler") },
        ],
      }),
    ]);

    const outputA = resA.choices[0].message.content ?? "";
    const outputB = resB.choices[0].message.content ?? "";
    const outputC = resC.choices[0].message.content ?? "";

    logs.push(log("agent_a", "output", `Draft complete (${outputA.split(/\s+/).length} words) — ChatGPT's response.`));
    logs.push(log("agent_b", "output", `Draft complete (${outputB.split(/\s+/).length} words) — DeepSeek's response.`));
    logs.push(log("agent_c", "output", `Draft complete (${outputC.split(/\s+/).length} words) — Claude's response.`));

    // ── STEP 2: Critique round — each agent critiques the other two (parallel) ──
    logs.push(log("coordinator", "assignment", "Starting critique round — each agent will evaluate the other two outputs."));

    const critiquePrompt = (myName: string, myOutput: string, others: { name: string; output: string }[]) =>
      `You are ${myName}. Read the other agents' outputs and provide a brief critique (2–3 sentences per agent) covering strengths and weaknesses. Be specific and constructive.\n\n${others.map(o => `${o.name} output:\n${o.output}`).join("\n\n")}`;

    const [critA, critB, critC] = await Promise.all([
      client.chat.completions.create({
        model: "gpt-4o", temperature: 0.7,
        messages: [
          { role: "system", content: "You are Agent A critiquing other agents. Be honest, specific, and constructive." },
          { role: "user", content: critiquePrompt("Agent A", outputA, [{ name: "Agent B", output: outputB }, { name: "Agent C", output: outputC }]) },
        ],
      }),
      client.chat.completions.create({
        model: "gpt-4o", temperature: 0.7,
        messages: [
          { role: "system", content: "You are Agent B critiquing other agents. Be honest, specific, and constructive." },
          { role: "user", content: critiquePrompt("Agent B", outputB, [{ name: "Agent A", output: outputA }, { name: "Agent C", output: outputC }]) },
        ],
      }),
      client.chat.completions.create({
        model: "gpt-4o", temperature: 0.7,
        messages: [
          { role: "system", content: "You are Agent C critiquing other agents. Be honest, specific, and constructive." },
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

    // ── STEP 3: Coordinator decides final version ──
    const decisionRes = await client.chat.completions.create({
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
          content: `Agent outputs:\n\nAgent A:\n${outputA}\n\nAgent B:\n${outputB}\n\nAgent C:\n${outputC}\n\nCritiques:\nAgent A on B&C: ${critiqueA}\nAgent B on A&C: ${critiqueB}\nAgent C on A&B: ${critiqueC}\n\nUser preferences: ${userMessage || "None specified."}\n\nDecide and produce the final version. Return JSON.`,
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
        { id: 1, name: "Agent A", style: "ChatGPT's Response", output: outputA, critique: critiqueA },
        { id: 2, name: "Agent B", style: "DeepSeek's Response", output: outputB, critique: critiqueB },
        { id: 3, name: "Agent C", style: "Claude's Response", output: outputC, critique: critiqueC },
      ],
      finalVersion: decision.finalVersion ?? outputB,
      coordinatorDecision: decision.decision ?? "",
      coordinatorRationale: decision.rationale ?? "",
      round,
    });
  } catch (err) {
    console.error("[competitive orchestrator]", err);
    return NextResponse.json({ error: "Coordination failed", logs }, { status: 500 });
  }
}
