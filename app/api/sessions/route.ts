import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const logFile = path.join(process.cwd(), "logs", "sessions.json");
    if (!fs.existsSync(logFile)) {
      return NextResponse.json([]);
    }
    const sessions = JSON.parse(fs.readFileSync(logFile, "utf-8"));
    return NextResponse.json(sessions);
  } catch {
    return NextResponse.json([]);
  }
}
