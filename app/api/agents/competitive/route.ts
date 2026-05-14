import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const maxDuration = 60;

const openaiClient   = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const deepseekClient = new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: "https://api.deepseek.com" });
const groqClient     = new OpenAI({ apiKey: process.env.GROQ_API_KEY,     baseURL: "https://api.groq.com/openai/v1" });

const AGENTS = [
  {
    id: 1,
    name: "Agent A",
    style: "ChatGPT's Response",
    description: "Powered by OpenAI's ChatGPT",
    model: "gpt-4o",
    client: openaiClient,
    systemPrompt:
      "You are an analytical academic writer. Write literature reviews with a clear, structured format. Use bullet points for key findings. Be precise and evidence-focused. Avoid flowery language — prioritize clarity and logical organization. Use in-text citations in Author (year) format.",
  },
  {
    id: 2,
    name: "Agent B",
    style: "DeepSeek's Response",
    description: "Powered by DeepSeek's language model",
    model: "deepseek-chat",
    client: deepseekClient,
    systemPrompt:
      "You are a narrative academic writer. Write literature reviews as flowing, engaging prose that tells the story of a research field. Weave citations naturally into the text. Build argument through smooth transitions rather than lists or headers. Use in-text citations in Author (year) format.",
  },
  {
    id: 3,
    name: "Agent C",
    style: "Groq's Response",
    description: "Powered by Groq (Llama)",
    model: "llama-3.3-70b-versatile",
    client: groqClient,
    systemPrompt:
      "You are a critical academic writer. Write literature reviews that are concise and direct. Surface tensions, contradictions, and gaps in the literature. Be skeptical of consensus. Each paragraph should make a sharp point. Avoid filler phrases. Use in-text citations in Author (year) format.",
  },
];

export async function POST(req: NextRequest) {
  try {
    const { topic } = await req.json();

    const userPrompt = `Write a literature review on the topic: "${topic}"

Write approximately 250–300 words. Cover the key themes, findings, and debates in this field. Use realistic in-text citations (e.g. Smith & Jones, 2023) — they can be illustrative but should sound plausible. Return ONLY the review text, no headings or JSON.`;

    const [resA, resB, resC] = await Promise.all(
      AGENTS.map((agent) =>
        agent.client.chat.completions.create({
          model: agent.model,
          messages: [
            { role: "system", content: agent.systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.8,
        })
      )
    );

    const outputs = [resA, resB, resC].map((res, i) => ({
      id: AGENTS[i].id,
      name: AGENTS[i].name,
      style: AGENTS[i].style,
      description: AGENTS[i].description,
      output: res.choices[0].message.content ?? "",
    }));

    return NextResponse.json({ agents: outputs });
  } catch (err) {
    console.error("[competitive route]", err);
    return NextResponse.json({ error: "Failed to generate competitive outputs" }, { status: 500 });
  }
}
