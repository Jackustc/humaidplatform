import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const entry = { ...body, loggedAt: new Date().toISOString() };

  console.log("[HUMAID LOG]", JSON.stringify(entry));

  try {
    await kv.lpush("sessions", JSON.stringify(entry));
  } catch (err) {
    console.error("[HUMAID LOG] KV write failed:", err);
  }

  return NextResponse.json({ success: true, sessionId: body.sessionId });
}
