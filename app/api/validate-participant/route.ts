import { NextRequest, NextResponse } from "next/server";
import { gateParticipant } from "@/lib/participant-gate";

/**
 * Validates a CloudResearch Connect participant ID before the participant is
 * allowed to start the study. Also reports whether the ID has already completed
 * a session (repeat participation).
 *
 * Always returns HTTP 200 with an `allowed` flag so the client can show a
 * specific message; the gate logic itself decides allow/deny based on the
 * CloudResearch result and the configured strict/repeat flags.
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body", code: "INVALID_BODY" }, { status: 400 });
  }

  const participantId = typeof body.participantId === "string" ? body.participantId.trim() : "";
  if (!participantId) {
    return NextResponse.json({ error: "Missing participantId", code: "MISSING_PARTICIPANT_ID" }, { status: 400 });
  }

  const decision = await gateParticipant(participantId);
  return NextResponse.json(decision);
}
