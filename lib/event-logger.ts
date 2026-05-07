export type AppEvent = {
  sessionId: string;
  timestamp: string;
  eventType: string;
  payload: Record<string, unknown>;
};

const STORAGE_KEY = "humaid_events";

export function logEvent(eventType: string, payload: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return;
  const sessionId = sessionStorage.getItem("humaid_session_id") ?? "unknown";
  const event: AppEvent = {
    sessionId,
    timestamp: new Date().toISOString(),
    eventType,
    payload,
  };
  const existing: AppEvent[] = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]");
  existing.push(event);
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
}

export function getEvents(): AppEvent[] {
  if (typeof window === "undefined") return [];
  return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]");
}

export function clearEvents(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
}
