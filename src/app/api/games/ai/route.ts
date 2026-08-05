import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import Replicate from "replicate";
import { verifyIdToken, getAdminStorage } from "@/lib/firebase-admin";
import { allowRequest, type RateLimitBucket } from "@/lib/server-rate-limit";
import { coerceStyleTypeForIdeogramGenerate } from "@/app/games/bluffbox/packs/ideogramStyleRules";

const AI_TIMEOUT_MS = 15_000;

/** Hard ceiling on client-requested max_tokens (cost cap). */
const MAX_TOKENS_CEILING = 1024;

const anthropic = new Anthropic({
  apiKey: process.env["ANTHROPIC_API_KEY"],
  timeout: AI_TIMEOUT_MS,
});

const replicate = new Replicate({
  auth: process.env["REPLICATE_API_TOKEN"] ?? "",
  useFileOutput: false,
});

// ─── Per-UID rate limiting (Firestore-backed, shared across instances) ──
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Text/vision calls: cheap but chatty during gameplay. */
const TEXT_BUCKETS: RateLimitBucket[] = [
  { bucket: "ai-text", windowMs: MINUTE, max: 30 },
];
/** Image generation (Ideogram/Replicate): expensive — much stricter. */
const IMAGE_BUCKETS: RateLimitBucket[] = [
  { bucket: "ai-image-hour", windowMs: HOUR, max: 30 },
  { bucket: "ai-image-day", windowMs: DAY, max: 150 },
];
/** Storage persists: cheap, but bound them too. */
const PERSIST_BUCKETS: RateLimitBucket[] = [
  { bucket: "ai-persist-hour", windowMs: HOUR, max: 60 },
];

/** Storage prefixes persist-image may write to (creator asset flows). */
const PERSIST_PATH_PREFIXES = ["fyve-heists/", "fyve-bombs/", "bullshiitake/"];

// ─── Ideogram v3 via Replicate ──────────────────────────────
// All image generation is billed to the one Replicate account (same as the
// sketch model). Replicate hosts Ideogram's official v3 models, so outputs
// are identical to the direct API — only the parameter shapes differ.

/** Our rendering_speed setting → which Ideogram v3 model to run. */
const IDEOGRAM_MODEL_BY_SPEED: Record<string, `${string}/${string}`> = {
  FLASH: "ideogram-ai/ideogram-v3-turbo",
  TURBO: "ideogram-ai/ideogram-v3-turbo",
  DEFAULT: "ideogram-ai/ideogram-v3-balanced",
  QUALITY: "ideogram-ai/ideogram-v3-quality",
};

/** Direct-API enum ("GENERAL") → Replicate wrapper enum ("General"). */
const capitalize = (v: string): string =>
  v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();

/** Preset const ("80S_ILLUSTRATION") → wrapper label ("80s Illustration").
 * Title-cases each word, with the wrapper's irregulars special-cased. */
function toReplicateStylePreset(preset: string): string {
  const SPECIAL: Record<string, string> = { CHILDRENS: "Children's", C4D: "C4D" };
  return preset
    .split("_")
    .map((w) => {
      if (SPECIAL[w]) return SPECIAL[w];
      if (/^\d+S$/.test(w)) return `${w.slice(0, -1)}s`; // 80S → 80s
      if (/^I{1,3}$/.test(w)) return w; // roman numerals stay uppercase
      return capitalize(w);
    })
    .join(" ");
}

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
  let isAdmin = false;
  try {
    const decoded = await verifyIdToken(authHeader.substring(7));
    uid = decoded.uid;
    isAdmin = decoded["admin"] === true;
  } catch {
    return NextResponse.json({ error: "Invalid auth token" }, { status: 401 });
  }

  // ─── Handle request ───────────────────────────────────────
  try {
    const body = await request.json();
    const { type } = body as { type: string };

    // Type-appropriate rate limiting (shared across instances). Admins are
    // exempt — the caps guard provider spend against ordinary authed users,
    // not the owner batch-authoring pack content (which trips 30 images/hr).
    if (!isAdmin) {
      const buckets =
        type === "generate-image" || type === "sketch"
          ? IMAGE_BUCKETS
          : type === "persist-image"
            ? PERSIST_BUCKETS
            : TEXT_BUCKETS;
      if (!(await allowRequest(uid, buckets))) {
        return NextResponse.json(
          { error: "Too many requests — try again shortly" },
          { status: 429 },
        );
      }
    }

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

      if (!process.env["REPLICATE_API_TOKEN"]) {
        console.error("[AI Image] REPLICATE_API_TOKEN not configured");
        return NextResponse.json({ error: "Image generation not configured" }, { status: 500 });
      }

      const presetTrimmed = b.style_preset?.trim();
      const styleType = coerceStyleTypeForIdeogramGenerate(b.style_type, presetTrimmed);
      const model =
        IDEOGRAM_MODEL_BY_SPEED[b.rendering_speed ?? "QUALITY"] ??
        IDEOGRAM_MODEL_BY_SPEED["QUALITY"]!;

      // Ideogram v3 on Replicate. Param shape differs from the direct API:
      // aspect_ratio "2x1" → "2:1", enums Title Case, rendering_speed → model.
      // negative_prompt has no wrapper equivalent and is dropped.
      const input: Record<string, unknown> = {
        prompt: imagePrompt,
        aspect_ratio: (b.aspect_ratio ?? "1x1").replace("x", ":"),
        style_type: capitalize(styleType),
        magic_prompt_option: capitalize(b.magic_prompt ?? "ON"),
        ...(typeof b.seed === "number" && !Number.isNaN(b.seed)
          ? { seed: Math.floor(b.seed) }
          : {}),
        ...(presetTrimmed ? { style_preset: toReplicateStylePreset(presetTrimmed) } : {}),
      };
      if (b.negative_prompt?.trim()) {
        console.log("[AI Image] negative_prompt not supported via Replicate — dropped");
      }

      try {
        const output = await replicate.run(model, { input });
        const rawUrl = Array.isArray(output) ? output[0] : output;
        const imageUrl = typeof rawUrl === "string" ? rawUrl : String(rawUrl ?? "");
        console.log(`[AI Image] uid=${uid} ${model}: ${imageUrl.slice(0, 80)}...`);

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
        console.error("[AI Image] Ideogram-via-Replicate error:", err);
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
      // Only creator asset prefixes — an arbitrary path could overwrite any
      // object in the bucket (content covers, avatars, …).
      if (
        storagePath.includes("..") ||
        !PERSIST_PATH_PREFIXES.some((p) => storagePath.startsWith(p))
      ) {
        return NextResponse.json({ error: "Invalid storagePath" }, { status: 400 });
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
        // Cache-buster: re-persisting to the same path must yield a NEW URL
        // string, or the doc update is a no-op and browsers keep serving the
        // year-cached old image (same convention as uploadSongAudio).
        const permanentUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media&t=${Date.now()}`;
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
      // Clamp client-supplied values — max_tokens is a direct cost knob.
      max_tokens: Math.min(
        Math.max(1, maxTokens ?? (type === "comment" ? 200 : 256)),
        MAX_TOKENS_CEILING,
      ),
      temperature: Math.min(Math.max(temperature ?? (type === "comment" ? 0.7 : 0.3), 0), 1),
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
