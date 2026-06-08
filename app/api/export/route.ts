import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { cookies } from "next/headers";
import * as XLSX from "xlsx";

// ── helpers ────────────────────────────────────────────────────────────────
function esc(v: unknown): string {
  return `"${String(v ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
}

function fmtDate(iso: unknown): string {
  if (!iso) return "";
  return new Date(iso as string).toLocaleString("en-GB", { hour12: false }).replace(",", "");
}

function calcDurSec(start: unknown, end: unknown): string {
  if (!start || !end) return "";
  return String(Math.round((new Date(end as string).getTime() - new Date(start as string).getTime()) / 1000));
}

/** Strip markdown bold/italic markers for cleaner spreadsheet cells */
function stripMd(s: unknown): string {
  return String(s ?? "").replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1").replace(/\r?\n/g, " ").trim();
}

// ── auth + data fetch ──────────────────────────────────────────────────────
async function authorize(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("humaid_admin_token")?.value;
  return !!(token && token === process.env.ADMIN_SECRET);
}

async function getSessions(): Promise<Record<string, unknown>[]> {
  const raw = await kv.lrange<string>("sessions", 0, -1);
  if (!raw || raw.length === 0) return [];
  return raw.map((item) => (typeof item === "string" ? JSON.parse(item) : item));
}

// ── row builders ───────────────────────────────────────────────────────────
const SESSION_HEADERS = [
  "Session ID", "Logged At", "Mode", "Duration (sec)", "Rounds",
  "Was Edited", "Chars Added", "Chars Removed", "Selected Agent",
  "Confidence (1-5)", "Trust (1-5)", "Difficulty (1-5)", "Satisfaction (1-5)", "Effort (1-5)",
  "Age Range", "Education", "AI Familiarity", "Field of Study",
  "Agent Chars (provenance)", "User Chars (provenance)",
];

function buildSessionRow(s: Record<string, unknown>): (string | number)[] {
  const survey = (s.postTaskSurvey  ?? {}) as Record<string, number>;
  const demo   = (s.demographics    ?? {}) as Record<string, string>;
  const prov   = (s.provenanceSummary ?? {}) as Record<string, number>;
  const agentChars = Object.entries(prov).filter(([k]) => k !== "user_typed").reduce((a, [, v]) => a + v, 0);
  const rounds = Array.isArray(s.rounds) ? s.rounds.length : 1;
  return [
    String(s.sessionId ?? ""), fmtDate(s.loggedAt), String(s.mode ?? ""),
    calcDurSec(s.startTime, s.endTime), rounds,
    s.wasEdited ? "Yes" : "No",
    Number(s.charsAdded ?? 0), Number(s.charsRemoved ?? 0), String(s.selectedAgentName ?? ""),
    Number(s.confidenceRating ?? ""), Number(survey.trust ?? ""), Number(survey.difficulty ?? ""),
    Number(survey.satisfaction ?? ""), Number(survey.effort ?? ""),
    demo.ageRange ?? "", demo.education ?? "", demo.aiFamiliarity ?? "", demo.fieldOfStudy ?? "",
    agentChars, Number(prov["user_typed"] ?? 0),
  ];
}

const LOG_HEADERS = ["Session ID", "Mode", "Round", "Speaker", "Entry Type", "Content"];

const SPEAKER_MAP: Record<string, string> = {
  orchestrator: "Orchestrator", coordinator: "Orchestrator",
  agent_a: "Agent A", agent_b: "Agent B", agent_c: "Agent C",
};
const TYPE_MAP: Record<string, string> = {
  plan: "Plan", assignment: "Assignment", output: "Output",
  review: "Review", critique: "Critique", decision: "Decision", final: "Final",
};

function buildLogRows(sessions: Record<string, unknown>[]): (string | number)[][] {
  const rows: (string | number)[][] = [];
  for (const s of sessions) {
    const rounds = (s.rounds ?? []) as Record<string, unknown>[];
    for (const r of rounds) {
      const sid = String(s.sessionId ?? "");
      const mode = String(s.mode ?? "");
      const rNum = Number(r.roundNumber ?? 1);

      if (r.userMessage) {
        rows.push([sid, mode, rNum, "User",
          rNum === 1 ? "Initial Brief" : "Feedback",
          stripMd(r.userMessage)]);
      }

      for (const entry of (r.logs ?? []) as Record<string, unknown>[]) {
        rows.push([sid, mode, rNum,
          SPEAKER_MAP[entry.actor as string] ?? String(entry.actor),
          TYPE_MAP[entry.type as string]    ?? String(entry.type),
          stripMd(entry.content)]);
      }

      for (const ag of (r.agentOutputs ?? []) as Record<string, unknown>[]) {
        rows.push([sid, mode, rNum, String(ag.name ?? ""), "Output",  stripMd(ag.output)]);
        if (ag.critique)
          rows.push([sid, mode, rNum, String(ag.name ?? ""), "Critique", stripMd(ag.critique)]);
      }
      if (r.coordinatorDecision)
        rows.push([sid, mode, rNum, "Orchestrator", "Decision", stripMd(r.coordinatorDecision)]);
    }
  }
  return rows;
}

const EVENT_HEADERS = [
  "Session ID", "Mode", "Timestamp", "Event Type",
  "Panel", "Scroll Depth %", "Char Count", "Word Count", "Round", "Details",
];

/** Blank instead of 0 when a numeric field is absent, so empty cells read clearly */
function numOrBlank(v: unknown): number | string {
  return typeof v === "number" ? v : "";
}

function buildEventRows(sessions: Record<string, unknown>[]): (string | number)[][] {
  const rows: (string | number)[][] = [];
  // Fields that get their own columns; everything else goes into "Details"
  const KNOWN = new Set(["panel", "depthPct", "charCount", "wordCount", "round"]);
  for (const s of sessions) {
    for (const ev of (s.events ?? []) as Record<string, unknown>[]) {
      const p = (ev.payload ?? {}) as Record<string, unknown>;
      const extras = Object.entries(p)
        .filter(([k]) => !KNOWN.has(k))
        .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
        .join("; ");
      rows.push([
        String(s.sessionId ?? ""), String(s.mode ?? ""),
        String(ev.timestamp ?? ""), String(ev.eventType ?? ""),
        String(p.panel ?? ""),
        numOrBlank(p.depthPct),
        numOrBlank(p.charCount),
        numOrBlank(p.wordCount),
        numOrBlank(p.round),
        extras,
      ]);
    }
  }
  return rows;
}

// ── route handler ──────────────────────────────────────────────────────────
export async function GET(req: Request) {
  if (!(await authorize()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const sessions = await getSessions();
    if (sessions.length === 0)
      return new NextResponse("No data yet.", { status: 404 });

    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") ?? "csv";

    // ── JSON ───────────────────────────────────────────────────────────────
    if (format === "json") {
      return new NextResponse(JSON.stringify(sessions, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="humaid-export-${Date.now()}.json"`,
        },
      });
    }

    // ── XLSX (multiple sheets) ─────────────────────────────────────────────
    if (format === "xlsx") {
      const wb = XLSX.utils.book_new();

      // Sheet 1 — Sessions
      const sessionRows = sessions.map(buildSessionRow);
      const ws1 = XLSX.utils.aoa_to_sheet([SESSION_HEADERS, ...sessionRows]);
      // Set column widths
      ws1["!cols"] = [20, 18, 14, 14, 8, 10, 10, 12, 14, 14, 10, 10, 12, 8, 10, 16, 20, 16, 18, 18]
        .map((wch) => ({ wch }));
      XLSX.utils.book_append_sheet(wb, ws1, "Sessions");

      // Sheet 2 — Conversation Log
      const logRows = buildLogRows(sessions);
      const ws2 = XLSX.utils.aoa_to_sheet([LOG_HEADERS, ...logRows]);
      ws2["!cols"] = [20, 14, 7, 14, 14, 80].map((wch) => ({ wch }));
      XLSX.utils.book_append_sheet(wb, ws2, "Conversation Log");

      // Sheet 3 — Events
      const eventRows = buildEventRows(sessions);
      const ws3 = XLSX.utils.aoa_to_sheet([EVENT_HEADERS, ...eventRows]);
      ws3["!cols"] = [20, 12, 20, 18, 16, 12, 10, 10, 8, 40].map((wch) => ({ wch }));
      XLSX.utils.book_append_sheet(wb, ws3, "Events");

      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      return new NextResponse(buf, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="humaid-export-${Date.now()}.xlsx"`,
        },
      });
    }

    // ── CSV (single file, one row per entry) ───────────────────────────────
    const lines: string[] = [];

    lines.push("SESSIONS");
    lines.push(SESSION_HEADERS.map(esc).join(","));
    for (const s of sessions) lines.push(buildSessionRow(s).map(esc).join(","));

    lines.push("", "");
    lines.push("CONVERSATION LOG");
    lines.push(LOG_HEADERS.map(esc).join(","));
    for (const row of buildLogRows(sessions)) lines.push(row.map(esc).join(","));

    lines.push("", "");
    lines.push("EVENTS");
    lines.push(EVENT_HEADERS.map(esc).join(","));
    for (const row of buildEventRows(sessions)) lines.push(row.map(esc).join(","));

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
