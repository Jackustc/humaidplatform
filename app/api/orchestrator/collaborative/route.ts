import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { checkEnv } from "@/lib/env";
checkEnv();

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type LogEntry = {
  id: string;
  timestamp: string;
  actor: "orchestrator" | "agent_a" | "agent_b" | "agent_c";
  type: "plan" | "assignment" | "output" | "review" | "final";
  content: string;
};

export type Paper = {
  title: string;
  authors: string;
  year: number;
  journal: string;
  relevance: "High" | "Medium" | "Low";
  summary: string;
};

function log(actor: LogEntry["actor"], type: LogEntry["type"], content: string): LogEntry {
  return { id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, timestamp: new Date().toISOString(), actor, type, content };
}

export async function POST(req: NextRequest) {
  let body: { topic?: string; userMessage?: string; previousSummary?: string; round?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body", code: "INVALID_BODY" }, { status: 400 });
  }
  const { topic, userMessage, previousSummary, round = 1 } = body;
  const logs: LogEntry[] = [];
  const isReRun = round > 1 && previousSummary;

  try {
    // ── STEP 0: Orchestrator plans ──
    const planRes = await client.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are the Main Orchestrator coordinating three specialist agents to produce an industrial report:
• Agent A — Keyword Specialist
• Agent B — Source Specialist
• Agent C — Report Writer
Plan the work, brief each agent, and review their outputs. Be concise and professional.
Return JSON: { "plan": string, "agentABrief": string }`,
        },
        {
          role: "user",
          content: isReRun
            ? `Round ${round}. Previous report:\n${previousSummary}\n\nUser feedback: "${userMessage}"\n\nCreate a revised plan addressing this feedback. Return JSON.`
            : `Task: Industrial report on "${topic}".\nUser requirements: "${userMessage || "No specific requirements."}"\n\nCreate a plan and brief Agent A. Return JSON.`,
        },
      ],
    });
    const plan = JSON.parse(planRes.choices[0].message.content ?? "{}");
    logs.push(log("orchestrator", "plan", plan.plan ?? "Analysing task and dividing work across the agent pipeline."));
    logs.push(log("orchestrator", "assignment", `Assigning to Agent A — ${plan.agentABrief ?? "Generate search keywords for the report topic."}`));

    // ── STEP 1: Agent A — Keywords ──
    const kwRes = await client.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are Agent A, a Keyword Specialist in a multi-agent pipeline. Return JSON: { \"keywords\": string[] }" },
        { role: "user", content: `Orchestrator brief: ${plan.agentABrief ?? `Generate 12–15 precise search keywords for: "${topic}"`}` },
      ],
    });
    const keywords: string[] = JSON.parse(kwRes.choices[0].message.content ?? "{}").keywords ?? [];
    logs.push(log("agent_a", "output", `Generated ${keywords.length} keywords: ${keywords.slice(0, 5).join(", ")}${keywords.length > 5 ? ` +${keywords.length - 5} more` : ""}.`));

    // ── STEP 2: Orchestrator reviews A, briefs B ──
    const reviewARes = await client.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.5,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are the Main Orchestrator. Review Agent A's keywords, then brief Agent B (Source Specialist). Return JSON: { \"review\": string, \"agentBBrief\": string }" },
        { role: "user", content: `Agent A returned: ${keywords.join(", ")}.\nBrief Agent B to find 5–7 relevant industry sources.${userMessage ? `\nUser context: ${userMessage}` : ""}` },
      ],
    });
    const reviewA = JSON.parse(reviewARes.choices[0].message.content ?? "{}");
    logs.push(log("orchestrator", "review", reviewA.review ?? "Keywords reviewed — coverage looks solid. Passing to Agent B."));
    logs.push(log("orchestrator", "assignment", `Assigning to Agent B — ${reviewA.agentBBrief ?? "Find relevant industry sources using the provided keywords."}`));

    // ── STEP 3: Agent B — Papers/Sources ──
    const papersRes = await client.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `You are Agent B, a Source Specialist. Find relevant industry reports and research papers. Return JSON: { "papers": [{ "title": string, "authors": string, "year": number, "journal": string, "relevance": "High"|"Medium"|"Low", "summary": string }] }` },
        { role: "user", content: `Orchestrator brief: ${reviewA.agentBBrief ?? `Find 5–7 sources using: ${keywords.slice(0, 8).join(", ")}`}` },
      ],
    });
    const papers: Paper[] = JSON.parse(papersRes.choices[0].message.content ?? "{}").papers ?? [];
    logs.push(log("agent_b", "output", `Retrieved ${papers.length} sources: ${papers.slice(0, 2).map(p => `"${p.title}"`).join(", ")}${papers.length > 2 ? ` +${papers.length - 2} more` : ""}.`));

    // ── STEP 4: Orchestrator reviews B, briefs C ──
    const reviewBRes = await client.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.5,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are the Main Orchestrator. Review Agent B's sources, then brief Agent C (Report Writer). Return JSON: { \"review\": string, \"agentCBrief\": string }" },
        { role: "user", content: `Agent B retrieved ${papers.length} sources. Top: ${papers.slice(0, 3).map(p => `"${p.title}" (${p.year})`).join(", ")}.\nBrief Agent C.${userMessage ? `\nUser requirements: ${userMessage}` : ""}${isReRun ? `\nThis is a revision — user feedback: "${userMessage}"` : ""}` },
      ],
    });
    const reviewB = JSON.parse(reviewBRes.choices[0].message.content ?? "{}");
    logs.push(log("orchestrator", "review", reviewB.review ?? "Sources reviewed — good coverage and relevance. Passing to Agent C."));
    logs.push(log("orchestrator", "assignment", `Assigning to Agent C — ${reviewB.agentCBrief ?? "Synthesise the sources into a professional industrial report."}`));

    // ── STEP 5: Agent C — Report ──
    const paperList = papers.map(p => `- ${p.authors} (${p.year}). "${p.title}". ${p.journal}. [${p.summary}]`).join("\n");
    const summaryRes = await client.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.7,
      messages: [
        { role: "system", content: "You are Agent C, a professional Report Writer. Write clear, authoritative industrial reports synthesising multiple sources. Use in-text citations." },
        { role: "user", content: `Orchestrator brief: ${reviewB.agentCBrief ?? "Write a comprehensive industrial report."}\n\nSources:\n${paperList}\n\nWrite a 3-paragraph professional report (~400 words). Return ONLY the report text.` },
      ],
    });
    const summary = summaryRes.choices[0].message.content ?? "";
    logs.push(log("agent_c", "output", `Report drafted (${summary.split(/\s+/).length} words). Submitting to Orchestrator for final review.`));

    // ── STEP 6: Orchestrator final message ──
    const finalRes = await client.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.6,
      messages: [
        { role: "system", content: "You are the Main Orchestrator. Write a 2-sentence completion message to the user summarising what was produced. Be professional and concise." },
        { role: "user", content: `Pipeline complete. Round ${round}. Agent A: ${keywords.length} keywords. Agent B: ${papers.length} sources. Agent C: ${summary.split(/\s+/).length}-word report. Write the completion message.` },
      ],
    });
    const finalMessage = finalRes.choices[0].message.content ?? "The pipeline is complete. Please review the report below.";
    logs.push(log("orchestrator", "final", finalMessage));

    return NextResponse.json({ success: true, logs, keywords, papers, summary, orchestratorMessage: finalMessage, round });
  } catch (err) {
    console.error("[collaborative orchestrator]", err);
    return NextResponse.json({ error: "Orchestration failed", logs }, { status: 500 });
  }
}
