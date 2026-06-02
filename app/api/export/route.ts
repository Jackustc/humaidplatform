import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { cookies } from "next/headers";

function esc(v: unknown): string {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

function fmtDate(iso: unknown): string {
  if (!iso) return "";
  return new Date(iso as string).toLocaleString("en-GB", { hour12: false }).replace(",", "");
}

function calcDurSec(start: unknown, end: unknown): string {
  if (!start || !end) return "";
  return String(Math.round((new Date(end as string).getTime() - new Date(start as string).getTime()) / 1000));
}

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get("humaid_admin_token")?.value;
  if (!token || token !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const raw = await kv.lrange<string>("sessions", 0, -1);
    if (!raw || raw.length === 0) {
      return new NextResponse("No data yet.", { status: 404 });
    }

    const sessions: Record<string, unknown>[] = raw.map((item) =>
      typeof item === "string" ? JSON.parse(item) : item
    );

    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") ?? "csv";

    // ── JSON export ──────────────────────────────────────────────────────────
    if (format === "json") {
      return new NextResponse(JSON.stringify(sessions, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="humaid-export-${Date.now()}.json"`,
        },
      });
    }

    // ── CSV export ───────────────────────────────────────────────────────────
    const lines: string[] = [];

    // TABLE 1: Sessions — mirrors dashboard columns
    lines.push("SESSIONS");
    lines.push([
      "Session ID", "Logged At", "Mode",
      "Duration (sec)", "Rounds",
      "Was Edited", "Chars Added", "Chars Removed", "Selected Agent",
      "Confidence (1-5)", "Trust (1-5)", "Difficulty (1-5)", "Satisfaction (1-5)", "Effort (1-5)",
      "Age Range", "Education", "AI Familiarity", "Field of Study",
      "Agent Chars (provenance)", "User Chars (provenance)",
    ].map(esc).join(","));

    for (const s of sessions) {
      const survey = (s.postTaskSurvey  ?? {}) as Record<string, number>;
      const demo   = (s.demographics    ?? {}) as Record<string, string>;
      const prov   = (s.provenanceSummary ?? {}) as Record<string, number>;
      const agentChars = Object.entries(prov).filter(([k]) => k !== "user_typed").reduce((a, [, v]) => a + v, 0);
      const rounds = Array.isArray(s.rounds) ? s.rounds.length : 1;
      lines.push([
        s.sessionId, fmtDate(s.loggedAt), s.mode,
        calcDurSec(s.startTime, s.endTime), rounds,
        s.wasEdited ? "Yes" : "No", s.charsAdded ?? "", s.charsRemoved ?? "", s.selectedAgentName ?? "",
        s.confidenceRating ?? "", survey.trust ?? "", survey.difficulty ?? "", survey.satisfaction ?? "", survey.effort ?? "",
        demo.ageRange ?? "", demo.education ?? "", demo.aiFamiliarity ?? "", demo.fieldOfStudy ?? "",
        agentChars, prov["user_typed"] ?? 0,
      ].map(esc).join(","));
    }

    // TABLE 2: Conversation Log — one row per message / log entry
    lines.push("", "");
    lines.push("CONVERSATION LOG");
    lines.push([
      "Session ID", "Mode", "Round", "Speaker", "Entry Type", "Content",
    ].map(esc).join(","));

    for (const s of sessions) {
      const rounds = (s.rounds ?? []) as Record<string, unknown>[];
      for (const r of rounds) {
        const rNum = r.roundNumber ?? "";

        // User message for this round
        if (r.userMessage) {
          lines.push([
            s.sessionId, s.mode, rNum, "User",
            r.roundNumber === 1 ? "Initial Brief" : "Feedback",
            r.userMessage,
          ].map(esc).join(","));
        }

        // Orchestrator / agent log entries
        const logs = (r.logs ?? []) as Record<string, unknown>[];
        for (const entry of logs) {
          const speakerMap: Record<string, string> = {
            orchestrator: "Orchestrator", coordinator: "Orchestrator",
            agent_a: "Agent A", agent_b: "Agent B", agent_c: "Agent C",
          };
          const typeMap: Record<string, string> = {
            plan: "Plan", assignment: "Assignment", output: "Output",
            review: "Review", critique: "Critique", decision: "Decision", final: "Final",
          };
          lines.push([
            s.sessionId, s.mode, rNum,
            speakerMap[entry.actor as string] ?? String(entry.actor),
            typeMap[entry.type as string]  ?? String(entry.type),
            entry.content,
          ].map(esc).join(","));
        }

        // Competitive: agent outputs & critiques
        const agentOutputs = (r.agentOutputs ?? []) as Record<string, unknown>[];
        for (const ag of agentOutputs) {
          lines.push([s.sessionId, s.mode, rNum, ag.name, "Output", ag.output].map(esc).join(","));
          if (ag.critique) {
            lines.push([s.sessionId, s.mode, rNum, ag.name, "Critique", ag.critique].map(esc).join(","));
          }
        }
        if (r.coordinatorDecision) {
          lines.push([s.sessionId, s.mode, rNum, "Orchestrator", "Decision", r.coordinatorDecision].map(esc).join(","));
        }
      }
    }

    // TABLE 3: Events
    lines.push("", "");
    lines.push("EVENTS");
    lines.push([
      "Session ID", "Mode", "Timestamp", "Event Type",
      "Agent ID", "Scroll Depth %", "Dwell ms", "Text Length", "Source", "Extra",
    ].map(esc).join(","));

    for (const s of sessions) {
      const events = (s.events ?? []) as Record<string, unknown>[];
      for (const ev of events) {
        const p = (ev.payload ?? {}) as Record<string, unknown>;
        lines.push([
          s.sessionId, s.mode, ev.timestamp, ev.eventType,
          p.agentId ?? "", p.scrollDepthPct ?? "", p.dwellMs ?? "",
          p.textLength ?? "", p.source ?? "",
          JSON.stringify(p).replace(/"/g, "'"),
        ].map(esc).join(","));
      }
    }

    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="humaid-export-${Date.now()}.csv"`,
      },
    });
  } catch (err) {
    console.error("[humaid/export] failed:", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
