import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import Replicate from "replicate";
import { verifyIdToken, getAdminStorage } from "@/lib/firebase-admin";
import { coerceStyleTypeForIdeogramGenerate } from "@/app/games/bluffbox/packs/ideogramStyleRules";

const AI_TIMEOUT_MS = 15_000;

const anthropic = new Anthropic({
  apiKey: process.env["ANTHROPIC_API_KEY"],
  timeout: AI_TIMEOUT_MS,
});

const replicate = new Replicate({
  auth: process.env["REPLICATE_API_TOKEN"] ?? "",
  useFileOutput: false,
});

// ─── Per-UID rate limiting ──────────────────────────────────
const RATE_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 30;

const requestLog = new Map<string, number[]>();

function isRateLimited(uid: string): boolean {
  const now = Date.now();
  const timestamps = requestLog.get(uid) ?? [];
  const recent = timestamps.filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= MAX_REQUESTS_PER_WINDOW) return true;
  recent.push(now);
  requestLog.set(uid, recent);
  return false;
}

// Periodically prune stale entries so the map doesn't grow forever
setInterval(() => {
  const now = Date.now();
  for (const [uid, timestamps] of requestLog) {
    const recent = timestamps.filter((t) => now - t < RATE_WINDOW_MS);
    if (recent.length === 0) requestLog.delete(uid);
    else requestLog.set(uid, recent);
  }
}, RATE_WINDOW_MS);

export async function POST(request: NextRequest) {
  // ─── Authenticate ─────────────────────────────────────────
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Missing or invalid authorization header" },
      { status: 401 },
    );
  }

  let uid: string;
  try {
    const decoded = await verifyIdToken(authHeader.substring(7));
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: "Invalid auth token" }, { status: 401 });
  }

  if (isRateLimited(uid)) {
    return NextResponse.json(
      { error: "Too many requests — try again shortly" },
      { status: 429 },
    );
  }

  // ─── Handle request ───────────────────────────────────────
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
        return NextResponse.json(
          { error: "Failed to fetch image for vision" },
          { status: 502 },
        );
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
      console.log(`[AI Vision] uid=${uid} ${text}`);
      return NextResponse.json({ text });
    }

    // ─── High-quality image generation (Bluff Box) via Ideogram v3 ─────────
    if (type === "generate-image") {
      const b = body as {
        prompt: string;
        rendering_speed?: string;
        style_type?: string;
        magic_prompt?: string;
        aspect_ratio?: string;
        negative_prompt?: string;
        seed?: number;
        style_preset?: string;
      };
      const { prompt: imagePrompt } = b;

      if (!imagePrompt) {
        return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
      }

      const ideogramKey = process.env["IDEOGRAM_API_KEY"];
      if (!ideogramKey) {
        console.error("[AI Image] IDEOGRAM_API_KEY not configured");
        return NextResponse.json({ error: "Image generation not configured" }, { status: 500 });
      }

      const presetTrimmed = b.style_preset?.trim();
      const styleType = coerceStyleTypeForIdeogramGenerate(b.style_type, presetTrimmed);

      // Generate v3: multipart/form-data (see Ideogram docs). FICTION is not accepted by the live API.
      const form = new FormData();
      form.append("prompt", imagePrompt);
      form.append("aspect_ratio", b.aspect_ratio ?? "1x1");
      form.append("rendering_speed", b.rendering_speed ?? "QUALITY");
      form.append("style_type", styleType);
      form.append("magic_prompt", b.magic_prompt ?? "ON");
      form.append("num_images", "1");
      if (b.negative_prompt?.trim()) {
        form.append("negative_prompt", b.negative_prompt.trim());
      }
      if (typeof b.seed === "number" && !Number.isNaN(b.seed)) {
        form.append("seed", String(Math.floor(b.seed)));
      }
      if (presetTrimmed) {
        form.append("style_preset", presetTrimmed);
      }

      try {
        const ideogramRes = await fetch("https://api.ideogram.ai/v1/ideogram-v3/generate", {
          method: "POST",
          headers: {
            "Api-Key": ideogramKey,
          },
          body: form,
        });

        if (!ideogramRes.ok) {
          const errBody = await ideogramRes.text();
          console.error(`[AI Image] Ideogram ${ideogramRes.status}: ${errBody}`);
          return NextResponse.json({ error: "Image generation failed" }, { status: 502 });
        }

        const ideogramData = (await ideogramRes.json()) as {
          data?: { url?: string }[];
        };
        const imageUrl = ideogramData.data?.[0]?.url ?? "";
        console.log(`[AI Image] uid=${uid} Ideogram v3: ${imageUrl.slice(0, 80)}...`);

        if (!imageUrl) {
          return NextResponse.json({ error: "Image generation returned no URL" }, { status: 502 });
        }

        // Localhost: auto-save generated image to Desktop as backup
        if (process.env.NODE_ENV === "development") {
          try {
            const fs = await import("fs");
            const path = await import("path");
            const os = await import("os");
            const desktop = path.join(os.homedir(), "Desktop");
            const filename = `fyve-ai-${Date.now()}.png`;
            const imgRes = await fetch(imageUrl);
            if (imgRes.ok) {
              const buf = Buffer.from(await imgRes.arrayBuffer());
              fs.writeFileSync(path.join(desktop, filename), buf);
              console.log(`[AI Image] Saved backup: ~/Desktop/${filename}`);
            }
          } catch (e) {
            console.warn("[AI Image] Desktop backup failed:", e);
          }
        }

        return NextResponse.json({ imageUrl, type: "image" });
      } catch (err) {
        console.error("[AI Image] Ideogram error:", err);
        return NextResponse.json({ error: "Image generation failed" }, { status: 502 });
      }
    }

    // ─── Persist image: download URL, resize/compress, upload to Firebase Storage ──
    if (type === "persist-image") {
      const { url, storagePath, maxDimension, jpegQuality } = body as {
        url: string;
        storagePath: string;
        maxDimension?: number;
        jpegQuality?: number;
      };
      if (!url || !storagePath) {
        return NextResponse.json({ error: "Missing url or storagePath" }, { status: 400 });
      }

      try {
        const imgRes = await fetch(url);
        if (!imgRes.ok) {
          return NextResponse.json({ error: "Failed to download image" }, { status: 502 });
        }
        const rawBuffer = Buffer.from(await imgRes.arrayBuffer());

        // Resize + compress to JPEG
        const sharp = (await import("sharp")).default;
        const maxDim = maxDimension ?? 720;
        const quality = jpegQuality ?? 25;
        const buffer = await sharp(rawBuffer)
          .resize(maxDim, maxDim, { fit: "inside", withoutEnlargement: true })
          .jpeg({ quality })
          .toBuffer();

        const bucket = getAdminStorage();
        const file = bucket.file(storagePath);
        await file.save(buffer, {
          metadata: {
            contentType: "image/jpeg",
            cacheControl: "public, max-age=31536000",
          },
        });
        // Build permanent public URL
        const bucketName = bucket.name;
        const permanentUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media`;
        return NextResponse.json({ imageUrl: permanentUrl });
      } catch (err) {
        console.error("[Persist Image]", err);
        return NextResponse.json({ error: "Failed to persist image" }, { status: 500 });
      }
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
        console.log(`[AI Sketch] uid=${uid} Generated image for "${subject}": ${imageUrl.slice(0, 80)}...`);

        if (!imageUrl) {
          console.error("[AI Sketch] No image URL returned from Replicate");
          return NextResponse.json(
            { error: "Sketch generation failed" },
            { status: 502 },
          );
        }

        return NextResponse.json({ imageUrl, type: "image" });
      } catch (err) {
        console.error("[AI Sketch] Replicate error:", err);
        return NextResponse.json(
          { error: "Sketch generation failed" },
          { status: 502 },
        );
      }
    }

    // ─── Text: move or comment ──────────────────────────────
    const { prompt, maxTokens, temperature, model } = body as {
      prompt: string;
      type: "move" | "comment";
      maxTokens?: number;
      temperature?: number;
      model?: string;
    };

    if (!prompt) {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }

    const ALLOWED_MODELS: Record<string, string> = {
      haiku: "claude-haiku-4-5-20251001",
      sonnet: "claude-sonnet-4-6",
    };
    const resolvedModel = (model && ALLOWED_MODELS[model]) || "claude-haiku-4-5-20251001";

    const response = await anthropic.messages.create({
      model: resolvedModel,
      max_tokens: maxTokens ?? (type === "comment" ? 200 : 256),
      temperature: temperature ?? (type === "comment" ? 0.7 : 0.3),
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content[0];
    if (!content || content.type !== "text") {
      console.log("[AI] No text response");
      return NextResponse.json(
        { error: "AI returned no text" },
        { status: 502 },
      );
    }

    const text = content.text.trim();
    console.log(`[AI] uid=${uid} ${text}`);
    return NextResponse.json({ text });
  } catch (err) {
    console.error("[AI] Error:", err);
    return NextResponse.json(
      { error: "Internal AI error" },
      { status: 500 },
    );
  }
}
