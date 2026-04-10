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
          "bytedance/sdxl-lightning-4step:5599ed30703defd1d160a25a63321b4dec97101d98b4674bcc56e41f62f35637",
          {
            input: {
              prompt: `black marker line drawing on solid white background of: ${subject}. Simple thick black outlines only, like a whiteboard doodle drawn with a marker, no shading no color no fill no detail, stick-figure level simplicity, clipart style, flat 2D`,
              negative_prompt: "photorealistic, photo, 3d render, detailed, complex, shading, gradient, shadow, color, colored, painting, watercolor, text, watermark, realistic, multiple, mirror, reflection, duplicate",
              width: 720,
              height: 720,
              num_inference_steps: 4,
              scheduler: "K_EULER",
              guidance_scale: 0,
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
