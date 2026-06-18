import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { gateParticipant, markCompleted } from "@/lib/participant-gate";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body", code: "INVALID_BODY" }, { status: 400 });
  }

  if (!body.sessionId || typeof body.sessionId !== "string") {
    return NextResponse.json({ error: "Missing sessionId", code: "MISSING_SESSION_ID" }, { status: 400 });
  }

  // Re-validate the participant server-side at submission time. Skipped when no
  // participantId is present so manual/local testing still works.
  const participantId = typeof body.participantId === "string" ? body.participantId.trim() : "";
  if (participantId) {
    const decision = await gateParticipant(participantId);
    if (!decision.allowed) {
      return NextResponse.json(
        { error: decision.message, code: decision.reason.toUpperCase() },
        { status: 403 }
      );
    }
  }

  const entry = { ...body, loggedAt: new Date().toISOString() };
  console.log("[humaid/log]", body.sessionId);

  try {
    await kv.lpush("sessions", JSON.stringify(entry));
  } catch (err) {
    console.error("[humaid/log] KV write failed:", err);
    return NextResponse.json({ error: "Failed to persist session", code: "KV_WRITE_FAILED" }, { status: 500 });
  }

  // Record completion for repeat-participation detection (non-fatal if it fails).
  if (participantId) await markCompleted(participantId);

  return NextResponse.json({ success: true, sessionId: body.sessionId });
}
