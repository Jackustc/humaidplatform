import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

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

  const entry = { ...body, loggedAt: new Date().toISOString() };
  console.log("[humaid/log]", body.sessionId);

  try {
    await kv.lpush("sessions", JSON.stringify(entry));
  } catch (err) {
    console.error("[humaid/log] KV write failed:", err);
    return NextResponse.json({ error: "Failed to persist session", code: "KV_WRITE_FAILED" }, { status: 500 });
  }

  return NextResponse.json({ success: true, sessionId: body.sessionId });
}
