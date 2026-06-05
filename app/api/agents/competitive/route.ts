import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { callDeepSeek, callGroq, withRetry, Msg } from "@/lib/api-helpers";

export const maxDuration = 60;

const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 25000,
  maxRetries: 1,
});

const AGENTS = [
  {
    id: 1, name: "Agent A", style: "Agent A's Response", description: "AI Agent A",
    systemPrompt: "You are an analytical academic writer. Write literature reviews with clear structure, evidence-based reasoning, and in-text citations in Author (year) format.",
  },
  {
    id: 2, name: "Agent B", style: "Agent B's Response", description: "AI Agent B",
    systemPrompt: "You are a narrative academic writer. Write literature reviews as flowing, engaging prose that tells the story of a research field. Use in-text citations in Author (year) format.",
  },
  {
    id: 3, name: "Agent C", style: "Agent C's Response", description: "AI Agent C",
    systemPrompt: "You are a critical academic writer. Write concise and direct literature reviews. Surface tensions and gaps in the literature. Use in-text citations in Author (year) format.",
  },
];

export async function POST(req: NextRequest) {
  try {
    const { topic } = await req.json();
    const userPrompt = `Write a report on: "${topic}". Approximately 200-250 words. Cover key themes, findings, and debates. Return ONLY the report text.`;

    const [resA, resB, resC] = await Promise.all([
      withRetry(() =>
        openaiClient.chat.completions
          .create({
            model: "gpt-5.5", temperature: 0.8,
            messages: [
              { role: "system", content: AGENTS[0].systemPrompt },
              { role: "user", content: userPrompt },
            ],
          })
          .then((r) => r.choices[0].message.content ?? "")
      ).catch((e) => { throw new Error(`Agent A failed: ${e.message}`); }),

      withRetry(() =>
        callGroq([
          { role: "system", content: AGENTS[1].systemPrompt },
          { role: "user", content: userPrompt },
        ] as Msg[], 0.8)
      ).catch((e) => { throw new Error(`Agent B failed: ${e.message}`); }),

      withRetry(() =>
        callDeepSeek([
          { role: "system", content: AGENTS[2].systemPrompt },
          { role: "user", content: userPrompt },
        ] as Msg[], 0.8)
      ).catch((e) => { throw new Error(`Agent C failed: ${e.message}`); }),
    ]);

    const outputs = [resA, resB, resC].map((output, i) => ({
      id: AGENTS[i].id,
      name: AGENTS[i].name,
      style: AGENTS[i].style,
      description: AGENTS[i].description,
      output,
    }));

    return NextResponse.json({ agents: outputs });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate outputs";
    console.error("[competitive agents route]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
