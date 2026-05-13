import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const AGENT_STYLES = [
  {
    id: 1,
    name: "Agent A",
    style: "ChatGPT's Response",
    description: "Powered by OpenAI's ChatGPT",
    systemPrompt:
      "You are an analytical academic writer. Write literature reviews with a clear, structured format. Use bullet points for key findings. Be precise and evidence-focused. Avoid flowery language — prioritize clarity and logical organization. Use in-text citations in Author (year) format.",
  },
  {
    id: 2,
    name: "Agent B",
    style: "DeepSeek's Response",
    description: "Powered by DeepSeek's language model",
    systemPrompt:
      "You are a narrative academic writer. Write literature reviews as flowing, engaging prose that tells the story of a research field. Weave citations naturally into the text. Build argument through smooth transitions rather than lists or headers. Use in-text citations in Author (year) format.",
  },
  {
    id: 3,
    name: "Agent C",
    style: "Claude's Response",
    description: "Powered by Anthropic's Claude",
    systemPrompt:
      "You are a critical academic writer. Write literature reviews that are concise and direct. Surface tensions, contradictions, and gaps in the literature. Be skeptical of consensus. Each paragraph should make a sharp point. Avoid filler phrases. Use in-text citations in Author (year) format.",
  },
];

export async function POST(req: NextRequest) {
  try {
    const { topic } = await req.json();

    const userPrompt = `Write a literature review on the topic: "${topic}"

Write approximately 250–300 words. Cover the key themes, findings, and debates in this field. Use realistic in-text citations (e.g. Smith & Jones, 2023) — they can be illustrative but should sound plausible. Return ONLY the review text, no headings or JSON.`;

    // Run all 3 agents in parallel
    const [resA, resB, resC] = await Promise.all(
      AGENT_STYLES.map((agent) =>
        client.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: agent.systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.8,
        })
      )
    );

    const outputs = [resA, resB, resC].map((res, i) => ({
      id: AGENT_STYLES[i].id,
      name: AGENT_STYLES[i].name,
      style: AGENT_STYLES[i].style,
      description: AGENT_STYLES[i].description,
      output: res.choices[0].message.content ?? "",
    }));

    return NextResponse.json({ agents: outputs });
  } catch (err) {
    console.error("[competitive route]", err);
    return NextResponse.json({ error: "Failed to generate competitive outputs" }, { status: 500 });
  }
}
