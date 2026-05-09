import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

export async function GET() {
  try {
    const raw = await kv.lrange<string>("sessions", 0, -1);
    const sessions = raw.map((item) =>
      typeof item === "string" ? JSON.parse(item) : item
    );
    return NextResponse.json(sessions);
  } catch (err) {
    console.error("[sessions route] KV read failed:", err);
    return NextResponse.json([]);
  }
}
