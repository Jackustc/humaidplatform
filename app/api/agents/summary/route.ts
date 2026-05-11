import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { papers, topic } = await req.json();

    const paperList = (papers as Array<{
      title: string;
      authors: string;
      year: number;
      journal: string;
      summary: string;
    }>)
      .map((p) => `- ${p.authors} (${p.year}). "${p.title}". ${p.journal}. [${p.summary}]`)
      .join("\n");

    const completion = await client.chat.completions.create({
      model: "gpt-5.5",
      messages: [
        {
          role: "system",
          content:
            "You are an expert academic writer. Write clear, rigorous literature review summaries that synthesize multiple sources into a coherent narrative. Use in-text citations in the format Author (year).",
        },
        {
          role: "user",
          content: `Write a literature review summary on the topic: "${topic}"

Based on these papers:
${paperList}

Write 3 well-developed paragraphs (around 350–450 words total) that:
1. Introduce the field and main themes
2. Synthesize the key findings and tensions across papers
3. Conclude with implications and gaps in the literature

Use in-text citations (e.g. Smith & Jones, 2023). Return ONLY the summary text, no headings or JSON.`,
        },
      ],
      temperature: 0.7,
    });

    const summary = completion.choices[0].message.content ?? "";
    return NextResponse.json({ summary });
  } catch (err) {
    console.error("[summary route]", err);
    return NextResponse.json({ error: "Failed to generate summary" }, { status: 500 });
  }
}
