/**
 * Server-side gate that decides whether a participant may start or submit.
 *
 * Combines two checks:
 *   1. Repeat participation — has this ID already completed a session? (KV set)
 *   2. CloudResearch validation — is this a valid Connect participant ID?
 *
 * Behaviour is configurable via env flags so study settings can change without
 * a code change:
 *   STRICT_PARTICIPANT_VALIDATION=true  → fail closed (block when validation
 *      can't run or the ID can't be verified). Default: fail open (allow).
 *   ALLOW_REPEAT_PARTICIPATION=true     → allow a participant to complete more
 *      than once. Default: block repeats.
 */

import { kv } from "@vercel/kv";
import { validateParticipant, type ParticipantStatus } from "@/lib/cloudresearch";

export const COMPLETED_PARTICIPANTS_KEY = "completed_participants";

export type GateReason =
  | "ok"
  | "already_completed"
  | "invalid_id"
  | "unverified"
  | "validation_unavailable";

export type GateDecision = {
  allowed: boolean;
  status: ParticipantStatus | "unchecked";
  alreadyCompleted: boolean;
  reason: GateReason;
  message: string;
};

function isStrict(): boolean {
  return process.env.STRICT_PARTICIPANT_VALIDATION === "true";
}

function allowsRepeat(): boolean {
  return process.env.ALLOW_REPEAT_PARTICIPATION === "true";
}

export async function hasCompleted(participantId: string): Promise<boolean> {
  if (!participantId) return false;
  try {
    return (await kv.sismember(COMPLETED_PARTICIPANTS_KEY, participantId)) === 1;
  } catch {
    // KV unavailable — treat as not completed rather than blocking a legit user.
    return false;
  }
}

export async function markCompleted(participantId: string): Promise<void> {
  if (!participantId) return;
  try {
    await kv.sadd(COMPLETED_PARTICIPANTS_KEY, participantId);
  } catch {
    // Non-fatal: the session was still logged; we just couldn't record the
    // completion marker for repeat detection.
  }
}

/**
 * Evaluate a participant ID against repeat + CloudResearch validation checks.
 * Never throws — always resolves to a decision the caller can act on.
 */
export async function gateParticipant(participantId: string): Promise<GateDecision> {
  const id = (participantId ?? "").trim();

  const alreadyCompleted = await hasCompleted(id);
  let allowed = true;
  let reason: GateReason = "ok";
  let message = "Participant ID accepted.";

  if (alreadyCompleted && !allowsRepeat()) {
    allowed = false;
    reason = "already_completed";
    message = "This participant ID has already completed the study.";
  }

  const outcome = await validateParticipant(id);
  let status: GateDecision["status"] = "unchecked";

  if (outcome.ok) {
    status = outcome.results[0]?.status ?? "unknown";
    if (status === "invalid") {
      allowed = false;
      if (reason === "ok") {
        reason = "invalid_id";
        message = "This participant ID is not valid.";
      }
    } else if (status === "unknown" && isStrict()) {
      allowed = false;
      if (reason === "ok") {
        reason = "unverified";
        message = "This participant ID could not be verified.";
      }
    }
  } else if (isStrict()) {
    // not_configured or api_error, and we're in strict (fail-closed) mode.
    allowed = false;
    if (reason === "ok") {
      reason = "validation_unavailable";
      message = "Participant validation is temporarily unavailable. Please try again shortly.";
    }
  }

  return { allowed, status, alreadyCompleted, reason, message };
}
