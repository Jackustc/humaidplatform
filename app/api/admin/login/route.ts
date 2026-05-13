import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body", code: "INVALID_BODY" }, { status: 400 });
  }

  const { password } = body;
  if (!password || typeof password !== "string") {
    return NextResponse.json({ error: "Missing password", code: "MISSING_PASSWORD" }, { status: 400 });
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminSecret = process.env.ADMIN_SECRET;

  if (!adminPassword || !adminSecret) {
    return NextResponse.json({ error: "Server misconfigured", code: "SERVER_MISCONFIGURED" }, { status: 500 });
  }

  if (password !== adminPassword) {
    return NextResponse.json({ error: "Incorrect password", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set("humaid_admin_token", adminSecret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });
  return res;
}
