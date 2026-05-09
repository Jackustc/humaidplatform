import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

function esc(v: unknown): string {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

export async function GET() {
  try {
    const raw = await kv.lrange<string>("sessions", 0, -1);
    if (!raw || raw.length === 0) {
      return new NextResponse("No data yet.", { status: 404 });
    }

    const sessions: Record<string, unknown>[] = raw.map((item) =>
      typeof item === "string" ? JSON.parse(item) : item
    );

    // --- Session-level CSV ---
    const sessionHeader = [
      "session_id", "logged_at", "mode", "start_time", "end_time",
      "duration_sec", "was_edited", "original_length", "final_length",
      "chars_added", "chars_removed", "selected_agent",
      "confidence_rating", "trust", "difficulty", "satisfaction", "effort",
      "age_range", "education", "ai_familiarity", "field_of_study",
      "provenance_agent_chars", "provenance_user_chars",
    ].map(esc).join(",");

    const sessionRows = sessions.map((s) => {
      const survey = (s.postTaskSurvey ?? {}) as Record<string, number>;
      const demo = (s.demographics ?? {}) as Record<string, string>;
      const prov = (s.provenanceSummary ?? {}) as Record<string, number>;
      const agentChars = Object.entries(prov).filter(([k]) => k !== "user_typed").reduce((a, [, v]) => a + v, 0);
      const userChars = prov["user_typed"] ?? 0;

      const startMs = s.startTime ? new Date(s.startTime as string).getTime() : 0;
      const endMs = s.endTime ? new Date(s.endTime as string).getTime() : 0;
      const durSec = startMs && endMs ? Math.round((endMs - startMs) / 1000) : "";

      return [
        s.sessionId, s.loggedAt, s.mode, s.startTime, s.endTime,
        durSec, s.wasEdited, s.originalLength, s.finalLength,
        s.charsAdded, s.charsRemoved, s.selectedAgentName,
        s.confidenceRating, survey.trust, survey.difficulty, survey.satisfaction, survey.effort,
        demo.ageRange, demo.education, demo.aiFamiliarity, demo.fieldOfStudy,
        agentChars, userChars,
      ].map(esc).join(",");
    });

    // --- Event-level CSV ---
    const eventHeader = [
      "session_id", "timestamp", "event_type", "mode",
      "agent_id", "scroll_depth_pct", "dwell_ms", "text_length", "source", "extra",
    ].map(esc).join(",");

    const eventRows: string[] = [];
    for (const s of sessions) {
      const events = (s.events ?? []) as Record<string, unknown>[];
      for (const ev of events) {
        const p = (ev.payload ?? {}) as Record<string, unknown>;
        eventRows.push([
          s.sessionId, ev.timestamp, ev.eventType, s.mode,
          p.agentId ?? "", p.scrollDepthPct ?? "", p.dwellMs ?? "",
          p.textLength ?? "", p.source ?? "",
          JSON.stringify(p).replace(/"/g, "'"),
        ].map(esc).join(","));
      }
    }

    const csv = [
      "# SESSION SUMMARY",
      sessionHeader,
      ...sessionRows,
      "",
      "# EVENT STREAM",
      eventHeader,
      ...eventRows,
    ].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="humaid-export-${Date.now()}.csv"`,
      },
    });
  } catch (e) {
    return new NextResponse(`Export error: ${e}`, { status: 500 });
  }
}
