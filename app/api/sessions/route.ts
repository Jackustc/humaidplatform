import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { cookies } from "next/headers";

export async function GET() {
  // Auth check
  const cookieStore = await cookies();
  const token = cookieStore.get("humaid_admin_token")?.value;
  if (!token || token !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const raw = await kv.lrange<string>("sessions", 0, -1);
    const sessions = (raw ?? []).map((item) =>
      typeof item === "string" ? JSON.parse(item) : item
    );
    return NextResponse.json(sessions);
  } catch (err) {
    console.error("[humaid/sessions] KV read failed:", err);
    return NextResponse.json({ error: "Failed to load sessions", code: "KV_READ_FAILED" }, { status: 500 });
  }
}
