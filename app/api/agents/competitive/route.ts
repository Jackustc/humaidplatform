import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const maxDuration = 60;

const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function clean(text: string): string {
  return text.replace(/[^ -]/gu, (c) => {
    const map: Record<string, string> = {
      "—": "-", "–": "-",
      "'": "'", "'": "'",
      """: '"', """: '"',
      "…": "...",
    };
    return map[c] ?? "";
  });
}

type Msg = { role: string; content: string };

async function deepseek(messages: Msg[]): Promise<string> {
  const payload = JSON.stringify({ model: "deepseek-chat", messages: messages.map(m => ({ ...m, content: clean(m.content) })), temperature: 0.8 });
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8", "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}` },
    body: Buffer.from(payload, "utf8"),
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`DeepSeek error ${res.status}: ${t.slice(0, 200)}`); }
  const data = await res.json() as { choices: { message: { content: string } }[] };
  return data.choices[0].message.content ?? "";
}

async function groq(messages: Msg[]): Promise<string> {
  const payload = JSON.stringify({ model: "llama-3.3-70b-versatile", messages: messages.map(m => ({ ...m, content: clean(m.content) })), temperature: 0.8 });
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8", "Authorization": `Bearer ${process.env.GROQ_API_KEY}` },
    body: Buffer.from(payload, "utf8"),
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`Groq error ${res.status}: ${t.slice(0, 200)}`); }
  const data = await res.json() as { choices: { message: { content: string } }[] };
  return data.choices[0].message.content ?? "";
}

const AGENTS = [
  {
    id: 1, name: "Agent A", style: "ChatGPT's Response", description: "Powered by OpenAI's ChatGPT",
    systemPrompt: "You are an analytical academic writer. Write literature reviews with clear structure, bullet points for key findings, evidence-based reasoning, and in-text citations in Author (year) format.",
  },
  {
    id: 2, name: "Agent B", style: "DeepSeek's Response", description: "Powered by DeepSeek's language model",
    systemPrompt: "You are a narrative academic writer. Write literature reviews as flowing, engaging prose that tells the story of a research field. Use in-text citations in Author (year) format.",
  },
  {
    id: 3, name: "Agent C", style: "Groq's Response", description: "Powered by Groq (Llama)",
    systemPrompt: "You are a critical academic writer. Write concise and direct literature reviews. Surface tensions and gaps in the literature. Use in-text citations in Author (year) format.",
  },
];

export async function POST(req: NextRequest) {
  try {
    const { topic } = await req.json();

    const userPrompt = `Write a literature review on: "${topic}". Approximately 250-300 words. Cover key themes, findings, and debates. Use realistic in-text citations (e.g. Smith & Jones, 2023). Return ONLY the review text.`;

    const [resA, resB, resC] = await Promise.all([
      openaiClient.chat.completions.create({
        model: "gpt-4o", temperature: 0.8,
        messages: [
          { role: "system", content: AGENTS[0].systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }).then(r => r.choices[0].message.content ?? ""),
      deepseek([{ role: "system", content: AGENTS[1].systemPrompt }, { role: "user", content: userPrompt }]),
      groq([{ role: "system", content: AGENTS[2].systemPrompt }, { role: "user", content: userPrompt }]),
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
