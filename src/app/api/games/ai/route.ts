import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env["ANTHROPIC_API_KEY"],
});

export async function POST(request: NextRequest) {
  try {
    const { prompt, type, maxTokens, temperature } = (await request.json()) as {
      prompt: string;
      type: "move" | "comment";
      maxTokens?: number;
      temperature?: number;
    };

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: maxTokens ?? (type === "comment" ? 200 : 256),
      temperature: temperature ?? (type === "comment" ? 0.7 : 0.3),
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content[0];
    if (!content || content.type !== "text") {
      console.log("[AI] No text response");
      return NextResponse.json({ text: "" });
    }

    const text = content.text.trim();
    console.log(`[AI] ${text}`);
    return NextResponse.json({ text });
  } catch (err) {
    console.error("[AI] Error:", err);
    return NextResponse.json({ text: "" });
  }
}
