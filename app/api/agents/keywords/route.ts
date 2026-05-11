import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { topic } = await req.json();

    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are a research librarian specializing in academic literature searches. Generate precise, academically useful search keywords for literature reviews.",
        },
        {
          role: "user",
          content: `Generate a list of 12–15 specific search keywords and phrases for a literature review on the topic: "${topic}". Return ONLY a JSON array of strings, no explanation. Example format: ["keyword one", "keyword two"]`,
        },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0].message.content ?? "{}";
    const parsed = JSON.parse(raw);

    // Handle both { keywords: [...] } and bare array wrapped in any key
    const keywords: string[] =
      Array.isArray(parsed.keywords)
        ? parsed.keywords
        : Array.isArray(parsed)
        ? parsed
        : Object.values(parsed).find(Array.isArray) ?? [];

    return NextResponse.json({ keywords });
  } catch (err) {
    console.error("[keywords route]", err);
    return NextResponse.json({ error: "Failed to generate keywords" }, { status: 500 });
  }
}
