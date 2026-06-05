import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { checkEnv } from "@/lib/env";
import { callDeepSeek, callGroq, withRetry, Msg } from "@/lib/api-helpers";
checkEnv();

export const maxDuration = 60;

// OpenAI client with 25s per-call timeout
const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 25000,
  maxRetries: 1,
});

export type LogEntry = {
  id: string;
  timestamp: string;
  actor: "orchestrator" | "agent_a" | "agent_b" | "agent_c";
  type: "plan" | "assignment" | "output" | "critique" | "decision" | "final";
  content: string;
};

function log(actor: LogEntry["actor"], type: LogEntry["type"], content: string): LogEntry {
  return {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    actor,
    type,
    content,
  };
}

export async function POST(req: NextRequest) {
  let body: { topic?: string; userMessage?: string; previousFinal?: string; round?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body", code: "INVALID_BODY" }, { status: 400 });
  }

  const { topic, userMessage, previousFinal, round = 1 } = body;

  if (!topic || !topic.trim()) {
    return NextResponse.json({ error: "Topic is required", code: "MISSING_TOPIC" }, { status: 400 });
  }

  const logs: LogEntry[] = [];
  const isReRun = round > 1 && previousFinal;

  try {
    // ── STEP 0: Build brief directly (no extra LLM call) ─────────────────────
    const brief = isReRun
      ? `Revise your report based on this feedback: "${userMessage}". Previous version:\n${previousFinal}`
      : `${topic}${userMessage && userMessage !== "No specific requirements."
          ? `\n\nAdditional requirements: ${userMessage}`
          : ""}`;

    logs.push(log("orchestrator", "plan", `Launching competitive pipeline for: "${topic}".`));
    logs.push(log("orchestrator", "assignment", `Briefing all agents: ${brief.slice(0, 120)}${brief.length > 120 ? "…" : ""}`));

    // ── STEP 1: All three agents generate in parallel (with retry) ────────────
    const reportInstruction = `Write a professional industry report, 200 words max, with in-text citations in Author (Year) format. Do NOT use memo or letter format (no To:/From:/Date: headers). Write in plain prose paragraphs. End with a "References" section listing each cited source in APA format on a separate line. Return ONLY the report text followed by the References section.`;
    const promptA = `You are Agent A. Brief: ${brief}\n${reportInstruction}`;
    const promptB = `You are Agent B. Brief: ${brief}\n${reportInstruction}`;
    const promptC = `You are Agent C. Brief: ${brief}\n${reportInstruction}`;

    const [outputA, outputB, outputC] = await Promise.all([
      withRetry(() =>
        openaiClient.chat.completions
          .create({ model: "gpt-5.5", messages: [{ role: "user", content: promptA }] })
          .then((r) => r.choices[0].message.content ?? "")
      ).catch((e) => { throw new Error(`Agent A failed: ${e.message}`); }),

      withRetry(() => callGroq([{ role: "user", content: promptB }] as Msg[], 0.8))
        .catch((e) => { throw new Error(`Agent B failed: ${e.message}`); }),

      withRetry(() => callDeepSeek([{ role: "user", content: promptC }] as Msg[], 0.8))
        .catch((e) => { throw new Error(`Agent C failed: ${e.message}`); }),
    ]);

    logs.push(log("agent_a", "output", `Draft complete (${outputA.split(/\s+/).length} words).`));
    logs.push(log("agent_b", "output", `Draft complete (${outputB.split(/\s+/).length} words).`));
    logs.push(log("agent_c", "output", `Draft complete (${outputC.split(/\s+/).length} words).`));

    // ── STEP 2: Critique round (parallel, with retry) ─────────────────────────
    logs.push(log("orchestrator", "assignment", "Starting critique round — each agent evaluates the other two outputs."));

    const critiqueSystem = `You are a professional peer reviewer. Write a concise, objective critique.
Use plain prose only — no markdown, no bold, no headers, no bullet points.
Format: One short paragraph on the first report, then one short paragraph on the second. Keep each paragraph to 2 sentences maximum.`;

    const [critiqueA, critiqueB, critiqueC] = await Promise.all([
      withRetry(() =>
        openaiClient.chat.completions
          .create({
            model: "gpt-5.5",
            messages: [
              { role: "system", content: critiqueSystem },
              { role: "user", content: `Review these two reports and write a brief professional critique of each.\n\nReport B:\n${outputB}\n\nReport C:\n${outputC}` },
            ],
          })
          .then((r) => r.choices[0].message.content ?? "")
      ),
      withRetry(() =>
        callGroq([
          { role: "system", content: critiqueSystem },
          { role: "user", content: `Review these two reports and write a brief professional critique of each.\n\nReport A:\n${outputA}\n\nReport C:\n${outputC}` },
        ] as Msg[], 0.6)
      ),
      withRetry(() =>
        callDeepSeek([
          { role: "system", content: critiqueSystem },
          { role: "user", content: `Review these two reports and write a brief professional critique of each.\n\nReport A:\n${outputA}\n\nReport B:\n${outputB}` },
        ] as Msg[], 0.6)
      ),
    ]);

    // Truncate critique for the log (full text is in agentOutputs)
    const truncate = (s: string, n = 120) => s.replace(/\*\*/g, "").slice(0, n) + (s.length > n ? "…" : "");
    logs.push(log("agent_a", "critique", truncate(critiqueA)));
    logs.push(log("agent_b", "critique", truncate(critiqueB)));
    logs.push(log("agent_c", "critique", truncate(critiqueC)));

    // ── STEP 3: Orchestrator decides final version ─────────────────────────────
    const decisionRes = await withRetry(() =>
      openaiClient.chat.completions.create({
        model: "gpt-5.5",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'You are the Main Orchestrator. Review all three agent outputs and critiques, then select the best version. Return JSON: { "decision": string, "rationale": string, "finalVersion": string }',
          },
          {
            role: "user",
            content: `Agent A:\n${outputA}\n\nAgent B:\n${outputB}\n\nAgent C:\n${outputC}\n\nCritiques:\nA: ${critiqueA}\nB: ${critiqueB}\nC: ${critiqueC}\n\nUser preferences: ${userMessage || "None."}\n\nReturn JSON.`,
          },
        ],
      })
    );

    let decision: Record<string, string> = {};
    try {
      decision = JSON.parse(decisionRes.choices[0].message.content ?? "{}");
    } catch {
      decision = {};
    }
    // Validate finalVersion — fall back to first non-empty agent output
    if (!decision.finalVersion || !decision.finalVersion.trim()) {
      decision.finalVersion = [outputA, outputB, outputC].find(o => o && o.trim()) ?? outputA;
    }
    logs.push(log("orchestrator", "decision", decision.decision ?? "Decision made based on agent outputs and critiques."));
    logs.push(log("orchestrator", "final", decision.rationale ?? "Final version selected and ready for review."));

    return NextResponse.json({
      success: true,
      logs,
      agentOutputs: [
        { id: 1, name: "Agent A", style: "Agent A's Response", output: outputA, critique: critiqueA },
        { id: 2, name: "Agent B", style: "Agent B's Response", output: outputB, critique: critiqueB },
        { id: 3, name: "Agent C", style: "Agent C's Response", output: outputC, critique: critiqueC },
      ],
      finalVersion: decision.finalVersion,
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
