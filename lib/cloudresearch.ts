/**
 * CloudResearch Connect API adapter.
 *
 * Wraps the Validate Participant IDs endpoint:
 *   POST https://connect-api.cloudresearch.com/api/v1/account/validate-participants
 * Authentication is via the `X-API-KEY` request header.
 *
 * The exact request/response field names are not published openly, so the
 * response parsing here is deliberately defensive — it accepts several plausible
 * shapes and normalises them. Tighten `normaliseResults()` once we observe a
 * real response from the live API.
 */

import { sanitizeKey, withTimeout } from "@/lib/api-helpers";

const BASE_URL = "https://connect-api.cloudresearch.com";
const VALIDATE_PATH = "/api/v1/account/validate-participants";

export type ParticipantStatus = "valid" | "invalid" | "unknown";

export type ParticipantValidation = {
  participantId: string;
  status: ParticipantStatus;
  /** The raw per-participant object returned by the API, for logging/debugging. */
  raw?: unknown;
};

export type ValidateOutcome =
  | { ok: true; results: ParticipantValidation[] }
  | { ok: false; reason: "not_configured" | "api_error"; message: string };

/** Maps a single raw participant entry into our normalised shape. */
function normaliseEntry(entry: unknown, fallbackId: string): ParticipantValidation {
  if (entry && typeof entry === "object") {
    const obj = entry as Record<string, unknown>;
    const id =
      (obj.participantId as string) ??
      (obj.participant_id as string) ??
      (obj.id as string) ??
      fallbackId;

    // Status may arrive as a string ("valid"/"invalid"/"Active"...) or a boolean flag.
    const rawStatus =
      (obj.status as string) ??
      (obj.validity as string) ??
      (typeof obj.valid === "boolean" ? (obj.valid ? "valid" : "invalid") : undefined) ??
      (typeof obj.isValid === "boolean" ? (obj.isValid ? "valid" : "invalid") : undefined);

    return { participantId: id, status: coerceStatus(rawStatus), raw: entry };
  }
  return { participantId: fallbackId, status: "unknown", raw: entry };
}

function coerceStatus(value: unknown): ParticipantStatus {
  if (typeof value !== "string") return "unknown";
  const v = value.trim().toLowerCase();
  if (["valid", "active", "eligible", "true", "ok"].includes(v)) return "valid";
  if (["invalid", "inactive", "ineligible", "false", "blocked"].includes(v)) return "invalid";
  return "unknown";
}

/** Pull the participant array out of whatever envelope the API returns. */
function normaliseResults(data: unknown, requestedIds: string[]): ParticipantValidation[] {
  let arr: unknown[] = [];
  if (Array.isArray(data)) {
    arr = data;
  } else if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const candidate =
      obj.participants ?? obj.results ?? obj.data ?? obj.statuses ?? obj.validations;
    if (Array.isArray(candidate)) arr = candidate;
  }

  if (arr.length === 0) {
    // Couldn't find a recognisable array — return everything as unknown so the
    // caller can decide (fail open / fail closed) rather than silently passing.
    return requestedIds.map((id) => ({ participantId: id, status: "unknown" as const, raw: data }));
  }

  return arr.map((entry, i) => normaliseEntry(entry, requestedIds[i] ?? ""));
}

/**
 * Validate one or more CloudResearch Connect participant IDs.
 *
 * Returns `{ ok: false, reason: "not_configured" }` when no API key is set, so
 * callers can choose how to behave (e.g. fail open in dev) without throwing.
 */
export async function validateParticipants(
  participantIds: string[],
  timeoutMs = 10000
): Promise<ValidateOutcome> {
  const key = sanitizeKey(process.env.CLOUDRESEARCH_API_KEY ?? "");
  if (!key) {
    return { ok: false, reason: "not_configured", message: "CLOUDRESEARCH_API_KEY is not set." };
  }

  const ids = participantIds.map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) {
    return { ok: true, results: [] };
  }

  try {
    const res = await withTimeout(
      () =>
        fetch(`${BASE_URL}${VALIDATE_PATH}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-KEY": key,
          },
          body: JSON.stringify({ participantIds: ids }),
        }),
      timeoutMs,
      "CloudResearch validate"
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        reason: "api_error",
        message: `CloudResearch validate failed (HTTP ${res.status}): ${body.slice(0, 200)}`,
      };
    }

    const data = await res.json().catch(() => null);
    return { ok: true, results: normaliseResults(data, ids) };
  } catch (err) {
    const message = err instanceof Error ? err.message : "CloudResearch request failed";
    return { ok: false, reason: "api_error", message };
  }
}

/** Convenience wrapper for the common single-ID case. */
export async function validateParticipant(
  participantId: string,
  timeoutMs?: number
): Promise<ValidateOutcome> {
  return validateParticipants([participantId], timeoutMs);
}
