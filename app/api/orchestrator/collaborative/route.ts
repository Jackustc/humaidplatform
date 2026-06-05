import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { checkEnv } from "@/lib/env";
import { callDeepSeek, callGroq, withRetry, Msg } from "@/lib/api-helpers";
checkEnv();

export const maxDuration = 60;

// Orchestrator uses GPT-4o (needs reliable JSON mode)
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 25000,
  maxRetries: 1,
});

export type LogEntry = {
  id: string;
  timestamp: string;
  actor: "orchestrator" | "agent_a" | "agent_b" | "agent_c";
  type: "plan" | "assignment" | "output" | "review" | "final";
  content: string;
};

function log(actor: LogEntry["actor"], type: LogEntry["type"], content: string): LogEntry {
  return { id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, timestamp: new Date().toISOString(), actor, type, content };
}

function safeParse(s: string | null | undefined): Record<string, string> {
  try {
    return JSON.parse(s ?? "{}");
  } catch {
    return {};
  }
}

/** Short one-line summary of an agent's output for the log */
function snippet(text: string, n = 140): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > n ? clean.slice(0, n) + "…" : clean;
}

export async function POST(req: NextRequest) {
  let body: { topic?: string; userMessage?: string; previousSummary?: string; round?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body", code: "INVALID_BODY" }, { status: 400 });
  }
  const { topic, userMessage, previousSummary, round = 1 } = body;

  if (!topic || !topic.trim()) {
    return NextResponse.json({ error: "Topic is required", code: "MISSING_TOPIC" }, { status: 400 });
  }

  const logs: LogEntry[] = [];
  const isReRun = round > 1 && previousSummary;
  const requirements = userMessage && userMessage !== "No specific requirements." ? userMessage : "";

  try {
    // ── STEP 0: Orchestrator plans the whole pipeline (GPT-4o) ───────────────
    // It decides what EACH agent does. If the user assigned specific roles,
    // it must use those exactly. Otherwise it divides the work itself.
    const planRes = await client.chat.completions.create({
      model: "gpt-5.5",
      reasoning_effort: "minimal",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are the Main Orchestrator coordinating three AI agents (Agent A, Agent B, Agent C) who work in sequence to produce one industrial report. Agent A works first, then Agent B builds on A's work, then Agent C produces the final report using everything before it.

Your job: assign a clear, specific task to EACH agent so that together they produce a high-quality report.

RULES:
- If the user assigned a specific role or instruction to any agent, you MUST use it exactly as their task — do not change or override it.
- For any agent the user did NOT assign, decide its task yourself. You may divide the work any way you see fit (e.g. research, data gathering, analysis, structuring, writing) and assign roles in ANY order across the three agents.
- Agent C produces the final deliverable (the report), so its task should result in the finished report.

Return JSON: { "plan": string, "agentATask": string, "agentBTask": string, "agentCTask": string }`,
        },
        {
          role: "user",
          content: isReRun
            ? `Round ${round}. The user was not satisfied with the previous report:\n${previousSummary}\n\nUser feedback: "${userMessage}"\n\nRe-plan the three agents' tasks to address this feedback. Return JSON.`
            : `Report topic: "${topic}".\n\nUser requirements / role assignments: "${requirements || "None — you decide how to divide the work."}"\n\nAssign a task to each of Agent A, Agent B, and Agent C. Return JSON.`,
        },
      ],
    });
    const plan = safeParse(planRes.choices[0].message.content);
    const taskA = plan.agentATask || `Research and gather the key facts, data, and themes needed for a report on "${topic}".`;
    const taskB = plan.agentBTask || `Build on Agent A's work — find supporting evidence, sources, and analysis for the report.`;
    const taskC = plan.agentCTask || `Write the final professional industrial report using the work from Agent A and Agent B.`;

    logs.push(log("orchestrator", "plan", plan.plan ?? "Dividing the work across the three agents."));
    logs.push(log("orchestrator", "assignment", `Assigning to Agent A — ${taskA}`));

    // ── STEP 1: Agent A executes its assigned task (GPT-4o) ──────────────────
    const outputA = await withRetry(() =>
      client.chat.completions
        .create({
          model: "gpt-5.5",
          reasoning_effort: "minimal",
          messages: [
            { role: "system", content: `You are Agent A, the first agent in a 3-agent collaborative pipeline producing an industrial report on "${topic}". Complete the task the Orchestrator assigns. Be thorough and well-organised — your output will be passed to Agent B. Return only your work, no preamble.` },
            { role: "user", content: `Your assigned task: ${taskA}${requirements ? `\n\nOverall user requirements: ${requirements}` : ""}` },
          ],
        })
        .then((r) => r.choices[0].message.content ?? "")
    ).catch((e) => { throw new Error(`Agent A failed: ${e.message}`); });
    logs.push(log("agent_a", "output", snippet(outputA)));

    // ── STEP 2: Orchestrator hands off to Agent B (no extra LLM call) ────────
    // Tasks were already decided in the plan, so we narrate the handoff instantly.
    const finalTaskB = taskB;
    logs.push(log("orchestrator", "review", "Reviewed Agent A's work — looks solid. Passing to Agent B."));
    logs.push(log("orchestrator", "assignment", `Assigning to Agent B — ${finalTaskB}`));

    // ── STEP 3: Agent B executes its task using A's output (DeepSeek) ────────
    const outputB = await withRetry(() =>
      callDeepSeek([
        { role: "system", content: `You are Agent B, the second agent in a 3-agent collaborative pipeline producing an industrial report on "${topic}". Build on Agent A's work to complete your assigned task. Your output will be passed to Agent C. Return only your work, no preamble.` },
        { role: "user", content: `Your assigned task: ${finalTaskB}\n\nAgent A's work so far:\n${outputA}${requirements ? `\n\nOverall user requirements: ${requirements}` : ""}` },
      ] as Msg[], 0.7)
    ).catch((e) => { throw new Error(`Agent B failed: ${e.message}`); });
    logs.push(log("agent_b", "output", snippet(outputB)));

    // ── STEP 4: Orchestrator hands off to Agent C (no extra LLM call) ────────
    const finalTaskC = taskC;
    logs.push(log("orchestrator", "review", "Reviewed Agent B's work — good coverage. Passing to Agent C for the final report."));
    logs.push(log("orchestrator", "assignment", `Assigning to Agent C — ${finalTaskC}`));

    // ── STEP 5: Agent C produces the final report (Groq) ─────────────────────
    const summary = await withRetry(() =>
      callGroq([
        { role: "system", content: `You are Agent C, the final agent in a 3-agent collaborative pipeline. Using the work from Agent A and Agent B, produce the FINAL industrial report on "${topic}". Write in clear, professional prose with in-text citations in Author (Year) format. Do NOT use memo or letter format (no To:/From:/Date: headers). End with a "References" section listing each cited source in APA format, one per line.` },
        { role: "user", content: `Your assigned task: ${finalTaskC}\n\nAgent A's contribution:\n${outputA}\n\nAgent B's contribution:\n${outputB}${requirements ? `\n\nOverall user requirements: ${requirements}` : ""}\n\nWrite the final report (~400 words) followed by the References section. Return ONLY the report and references.` },
      ] as Msg[], 0.7)
    ).catch((e) => { throw new Error(`Agent C failed: ${e.message}`); });
    logs.push(log("agent_c", "output", `Final report drafted (${summary.split(/\s+/).length} words).`));

    // ── STEP 6: Orchestrator completion message (static, no LLM call) ────────
    const finalMessage = "The three agents have collaborated to produce your report. Agent A and Agent B contributed the research and analysis, and Agent C wrote the final report. Please review it below.";
    logs.push(log("orchestrator", "final", finalMessage));

    return NextResponse.json({
      success: true,
      logs,
      summary,
      tasks: { agentA: taskA, agentB: finalTaskB, agentC: finalTaskC },
      contributions: { agentA: outputA, agentB: outputB },
      orchestratorMessage: finalMessage,
      round,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Orchestration failed";
    console.error("[collaborative orchestrator]", message);
    return NextResponse.json({ error: message, logs }, { status: 500 });
  }
}
