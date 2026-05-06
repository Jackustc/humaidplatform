import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const entry = { ...body, loggedAt: new Date().toISOString() };

  console.log("[HUMAID LOG]", JSON.stringify(entry, null, 2));

  try {
    const logsDir = path.join(process.cwd(), "logs");
    const logFile = path.join(logsDir, "sessions.json");

    let sessions: unknown[] = [];
    if (fs.existsSync(logFile)) {
      sessions = JSON.parse(fs.readFileSync(logFile, "utf-8"));
    }
    sessions.push(entry);
    fs.writeFileSync(logFile, JSON.stringify(sessions, null, 2));
  } catch {
    // File write fails gracefully in production/read-only environments
  }

  return NextResponse.json({ success: true, sessionId: body.sessionId });
}
