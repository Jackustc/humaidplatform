import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { keywords, topic } = await req.json();

    const keywordList = (keywords as string[]).slice(0, 8).join(", ");

    const completion = await client.chat.completions.create({
      model: "gpt-5.5",
      messages: [
        {
          role: "system",
          content:
            "You are an academic research assistant. Generate realistic, plausible academic paper references for literature reviews. Papers should be grounded in real research areas but may be illustrative rather than verbatim citations.",
        },
        {
          role: "user",
          content: `Using these search keywords: ${keywordList}

Generate 5–7 relevant academic papers for a literature review on "${topic}". Each paper should be realistic with plausible authors, journal names, and years (2018–2024). Include a brief summary of each paper's contribution.

Return ONLY a JSON object with a "papers" array. Each paper should have:
- title (string)
- authors (string, e.g. "Smith, J., & Jones, K.")
- year (number)
- journal (string)
- relevance ("High" | "Medium" | "Low")
- summary (string, 1–2 sentences describing the paper's key finding)`,
        },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0].message.content ?? "{}";
    const parsed = JSON.parse(raw);
    const papers = parsed.papers ?? [];

    return NextResponse.json({ papers });
  } catch (err) {
    console.error("[papers route]", err);
    return NextResponse.json({ error: "Failed to retrieve papers" }, { status: 500 });
  }
}
