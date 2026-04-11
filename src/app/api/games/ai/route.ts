import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import Replicate from "replicate";

const AI_TIMEOUT_MS = 15_000;

const anthropic = new Anthropic({
  apiKey: process.env["ANTHROPIC_API_KEY"],
  timeout: AI_TIMEOUT_MS,
});

const replicate = new Replicate({
  auth: process.env["REPLICATE_API_TOKEN"] ?? "",
  useFileOutput: false,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type } = body as { type: string };

    // ─── Vision: interpret a sketch image ───────────────────
    if (type === "vision") {
      const { imageUrl, prompt: textPrompt } = body as {
        imageUrl: string;
        prompt?: string;
      };

      const imageRes = await fetch(imageUrl);
      if (!imageRes.ok) {
        console.error("[AI Vision] Failed to fetch image:", imageRes.status);
        return NextResponse.json({ text: "" });
      }

      const arrayBuf = await imageRes.arrayBuffer();
      const base64 = Buffer.from(arrayBuf).toString("base64");

      const contentType = imageRes.headers.get("content-type") ?? "image/jpeg";
      const mediaType = contentType.startsWith("image/")
        ? (contentType as "image/jpeg" | "image/png" | "image/gif" | "image/webp")
        : "image/jpeg";

      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 100,
        temperature: 0.3,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mediaType, data: base64 },
              },
              {
                type: "text",
                text:
                  textPrompt ??
                  "You are a spy trying to decode a hand-drawn sketch. Describe what this drawing depicts in 2-5 words. Be concise and specific. Just output the description, nothing else.",
              },
            ],
          },
        ],
      });

      const content = response.content[0];
      const text = content?.type === "text" ? content.text.trim() : "";
      console.log(`[AI Vision] ${text}`);
      return NextResponse.json({ text });
    }

    // ─── Sketch: generate a drawing via Replicate ──────────
    if (type === "sketch") {
      const { subject } = body as { subject: string };

      try {
        const output = await replicate.run(
          "black-forest-labs/flux-schnell",
          {
            input: {
              prompt: `quick messy hand-drawn doodle on plain white paper of: ${subject}. Minimal lines, as few strokes as possible, uniform medium-weight black pen lines that do not taper, slightly wobbly imperfect strokes, no shading no color no fill no hatching, stick-figure level simplicity, napkin sketch, single object centered`,
              aspect_ratio: "1:1",
              num_outputs: 1,
              output_format: "jpg",
              output_quality: 80,
              num_inference_steps: 4,
              go_fast: true,
            },
          },
        );

        const rawUrl = Array.isArray(output) ? output[0] : output;
        const imageUrl = typeof rawUrl === "string" ? rawUrl : String(rawUrl ?? "");
        console.log(`[AI Sketch] Generated image for "${subject}": ${imageUrl.slice(0, 80)}...`);

        if (!imageUrl) {
          console.error("[AI Sketch] No image URL returned from Replicate");
          return NextResponse.json({ imageUrl: "", type: "image" });
        }

        return NextResponse.json({ imageUrl, type: "image" });
      } catch (err) {
        console.error("[AI Sketch] Replicate error:", err);
        return NextResponse.json({ imageUrl: "", type: "image" });
      }
    }

    // ─── Original: text move or comment ─────────────────────
    const { prompt, maxTokens, temperature } = body as {
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
