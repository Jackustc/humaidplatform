import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { checkEnv } from "@/lib/env";
import { callDeepSeek, callGroq, Msg } from "@/lib/api-helpers";
checkEnv();

export const maxDuration = 300;

// Orchestrator uses GPT-5.5 (needs reliable JSON mode)
// maxRetries: 0 — auto-retry doubles latency on a sequential pipeline, which we can't afford.
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 40000,
  maxRetries: 0,
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

// Randomly chosen each run so the orchestrator varies how it divides the work
// across the three agents instead of always using the same pattern.
const DIVISION_STRATEGIES = [
  "Agent A gathers data and evidence, Agent B analyses it and draws insights, Agent C writes the report.",
  "Agent A defines scope and structure, Agent B researches and gathers sources, Agent C writes the report.",
  "Agent A researches market context, Agent B researches challenges/risks and case studies, Agent C synthesises the report.",
  "Agent A drafts an outline and key arguments, Agent B fills in evidence and counterpoints, Agent C polishes the final report.",
  "Agent A identifies trends and opportunities, Agent B identifies barriers and financial implications, Agent C writes the report.",
  "Agent A handles qualitative analysis, Agent B handles quantitative data and statistics, Agent C writes the report.",
];

function safeParse(s: string | null | undefined): Record<string, string> {
  try {
    return JSON.parse(s ?? "{}");
  } catch {
    return {};
  }
}

/** Short one-line summary of an agent's output for the log (markdown stripped) */
function snippet(text: string, n = 140): string {
  const clean = text
    .replace(/^#{1,6}\s+/gm, "")   // strip heading markers (##)
    .replace(/\*\*(.+?)\*\*/g, "$1") // strip bold (**)
    .replace(/\*(.+?)\*/g, "$1")     // strip italic (*)
    .replace(/^[-*•]\s+/gm, "")      // strip bullet markers
    .replace(/`+/g, "")              // strip code ticks
    .replace(/\s+/g, " ")            // collapse whitespace
    .trim();
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
    // ── STEP 0: Orchestrator plans the pipeline (GPT-5.5) ────────────────────
    const planRes = await client.chat.completions.create({
      model: "gpt-5.5",
      reasoning_effort: "none",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are the Main Orchestrator coordinating three AI agents (Agent A, Agent B, Agent C) who work in sequence to produce one industrial report on "${topic}". Agent A works first, then Agent B builds on A's work, then Agent C produces the final report.

Assign a clear, specific task to EACH agent. If the user assigned a specific role/instruction to any agent, you MUST use it exactly. For unassigned agents, decide the division of work yourself — there is NO fixed convention, so vary the roles based on the specific topic and the suggested strategy below. The only fixed rule is that Agent C produces the final report.

Return JSON: { "plan": string, "agentATask": string, "agentBTask": string, "agentCTask": string }`,
        },
        {
          role: "user",
          content: isReRun
            ? `Round ${round}. The user was not satisfied with the previous report:\n${previousSummary}\n\nUser feedback: "${userMessage}"\n\nRe-plan the three agents' tasks to address this feedback. Return JSON.`
            : `Report topic: "${topic}".\n\nUser requirements / role assignments: "${requirements || "None — you decide how to divide the work."}"\n\nSuggested division strategy for this run (adapt it to the topic): ${DIVISION_STRATEGIES[Math.floor(Math.random() * DIVISION_STRATEGIES.length)]}\n\nAssign tasks to A, B, and C. Return JSON.`,
        },
      ],
    }, { timeout: 30000 });
    const plan = safeParse(planRes.choices[0].message.content);
    const taskA = plan.agentATask || `Research the key facts and themes for a report on "${topic}".`;
    let taskB = plan.agentBTask || `Build on Agent A's work — find supporting evidence, sources, and analysis.`;
    let taskC = plan.agentCTask || `Write the final professional industrial report using the work from Agent A and Agent B.`;
    logs.push(log("orchestrator", "plan", plan.plan ?? "Dividing the work across the three agents."));
    logs.push(log("orchestrator", "assignment", `Assigning to Agent A — ${taskA}`));

    // ── STEP 1: Agent A executes its task (GPT-5.5) ──────────────────────────
    const outputA = await client.chat.completions
      .create({
        model: "gpt-5.5",
        reasoning_effort: "none",
        messages: [
          { role: "system", content: `You are Agent A, the first agent in a 3-agent collaborative pipeline producing an industrial report on "${topic}". Complete your assigned task — focused and concise (under 250 words). Your output will be passed to Agent B. Return only your work, no preamble.` },
          { role: "user", content: `Your assigned task: ${taskA}${requirements ? `\n\nOverall user requirements: ${requirements}` : ""}` },
        ],
      }, { timeout: 40000 })
      .then((r) => r.choices[0].message.content ?? "")
      .catch((e) => { throw new Error(`Agent A failed: ${e.message}`); });
    logs.push(log("agent_a", "output", snippet(outputA)));

    // ── STEP 2: Orchestrator reviews A and finalises Agent B's task (GPT-5.5) ──
    const reviewARes = await client.chat.completions.create({
      model: "gpt-5.5",
      reasoning_effort: "none",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are the Main Orchestrator. In one or two sentences, genuinely review Agent A's actual output below, then finalise Agent B's task. IMPORTANT: if the user assigned a specific role to Agent B, keep it exactly. Return JSON: { \"review\": string, \"agentBTask\": string }" },
        { role: "user", content: `Agent A's task was: ${taskA}\n\nAgent A's actual output:\n${outputA}\n\nAgent B's planned task: ${taskB}${requirements ? `\nUser requirements (follow any Agent B instruction exactly): ${requirements}` : ""}\n\nReview A and finalise B's task. Return JSON.` },
      ],
    }, { timeout: 20000 });
    const reviewA = safeParse(reviewARes.choices[0].message.content);
    if (reviewA.agentBTask) taskB = reviewA.agentBTask;
    logs.push(log("orchestrator", "review", reviewA.review || "Reviewed Agent A's work. Passing to Agent B."));
    logs.push(log("orchestrator", "assignment", `Assigning to Agent B — ${taskB}`));

    // ── STEP 3: Agent B executes its task using A's output (DeepSeek) ────────
    const outputB = await callDeepSeek([
      { role: "system", content: `You are Agent B, the second agent in a 3-agent collaborative pipeline producing an industrial report on "${topic}". Build on Agent A's work to complete your assigned task. Be focused and concise (under 250 words). Where relevant, reference real, named industry sources (e.g. McKinsey, Deloitte, Gartner, World Economic Forum, named companies/reports) with approximate years so the final report can cite them. Your output will be passed to Agent C. Return only your work, no preamble.` },
      { role: "user", content: `Your assigned task: ${taskB}\n\nAgent A's work so far:\n${outputA}${requirements ? `\n\nOverall user requirements: ${requirements}` : ""}` },
    ] as Msg[], 0.7, 16000)
      .catch((e) => { throw new Error(`Agent B failed: ${e.message}`); });
    logs.push(log("agent_b", "output", snippet(outputB)));

    // ── STEP 4: Orchestrator reviews B and finalises Agent C's task (GPT-5.5) ──
    const reviewBRes = await client.chat.completions.create({
      model: "gpt-5.5",
      reasoning_effort: "none",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are the Main Orchestrator. In one or two sentences, genuinely review Agent B's actual output below, then finalise Agent C's task. Agent C produces the FINAL report. IMPORTANT: if the user assigned a specific role to Agent C, keep it exactly. Return JSON: { \"review\": string, \"agentCTask\": string }" },
        { role: "user", content: `Agent B's task was: ${taskB}\n\nAgent B's actual output:\n${outputB}\n\nAgent C's planned task: ${taskC}${requirements ? `\nUser requirements (follow any Agent C instruction exactly): ${requirements}` : ""}${isReRun ? `\nThis is a revision — user feedback: "${userMessage}"` : ""}\n\nReview B and finalise C's task. Return JSON.` },
      ],
    }, { timeout: 20000 });
    const reviewB = safeParse(reviewBRes.choices[0].message.content);
    if (reviewB.agentCTask) taskC = reviewB.agentCTask;
    logs.push(log("orchestrator", "review", reviewB.review || "Reviewed Agent B's work. Passing to Agent C."));
    logs.push(log("orchestrator", "assignment", `Assigning to Agent C — ${taskC}`));

    // ── STEP 5: Agent C produces the final report (Groq) ─────────────────────
    const summary = await callGroq([
      { role: "system", content: `You are Agent C, the final agent in a 3-agent collaborative pipeline. Using the work from Agent A and Agent B, produce the FINAL industrial report on "${topic}". Write in clear, professional prose with in-text citations in Author (Year) format. Do NOT use memo or letter format (no To:/From:/Date: headers).

CRITICAL CITATION RULES:
- NEVER cite "Agent A", "Agent B", or "Agent C" as a source. They are your teammates, not references.
- Cite only the real organizations, companies, reports, or authors that appear within Agent A's and Agent B's contributions (e.g. McKinsey, Deloitte, Siemens, Gartner, World Economic Forum, etc.).
- End with a "References" section listing each cited real source in APA format, one per line. Do not include any entry that refers to an Agent.` },
      { role: "user", content: `Your assigned task: ${taskC}\n\nAgent A's contribution:\n${outputA}\n\nAgent B's contribution:\n${outputB}${requirements ? `\n\nOverall user requirements: ${requirements}` : ""}\n\nWrite the final report (~400 words) with in-text citations to the REAL sources mentioned above (never to "Agent A/B/C"), followed by the References section. Return ONLY the report and references.` },
    ] as Msg[], 0.7, 15000)
      .catch((e) => { throw new Error(`Agent C failed: ${e.message}`); });
    logs.push(log("agent_c", "output", `Final report drafted (${summary.split(/\s+/).length} words).`));

    // ── STEP 6: Orchestrator writes the completion message (GPT-5.5) ─────────
    const finalRes = await client.chat.completions.create({
      model: "gpt-5.5",
      reasoning_effort: "none",
      messages: [
        { role: "system", content: "You are the Main Orchestrator. In 2 sentences, summarise to the user how the three agents collaborated to produce this report. Be professional and specific to what each agent did." },
        { role: "user", content: `Agent A task: ${taskA}\nAgent B task: ${taskB}\nAgent C task: ${taskC}\nFinal report length: ${summary.split(/\s+/).length} words. Write the completion message.` },
      ],
    }, { timeout: 20000 });
    const finalMessage = finalRes.choices[0].message.content ?? "The three agents have collaborated to produce your report. Please review it below.";
    logs.push(log("orchestrator", "final", finalMessage));

    return NextResponse.json({
      success: true,
      logs,
      summary,
      tasks: { agentA: taskA, agentB: taskB, agentC: taskC },
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
