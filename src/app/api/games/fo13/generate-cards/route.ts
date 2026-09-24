import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { verifyIdToken } from "@/lib/firebase-admin";
import { allowRequest, type RateLimitBucket } from "@/lib/server-rate-limit";
import {
  FO13_GENERATION_COUNT,
  fo13Prompt,
  isGeneratedCardType,
} from "@/app/games/fo13/packs/fo13Prompts";
import { FO13_MAX_TEXT_LENGTH } from "@/app/games/fo13/packs/fo13CardSpec";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Write 10 candidate cards of one kind.
 * POST /api/games/fo13/generate-cards  { cardType, existing? } -> { cards }
 *
 * Nothing is saved here — the builder shows the candidates for review and
 * only writes the ones the author checks.
 */

const AI_TIMEOUT_MS = 90_000;

const anthropic = new Anthropic({
  apiKey: process.env["ANTHROPIC_API_KEY"],
  timeout: AI_TIMEOUT_MS,
});

/** One call writes a whole batch, so the cap is per batch, not per card. */
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const BUCKETS: RateLimitBucket[] = [
  { bucket: "fo13-gen-min", windowMs: MINUTE, max: 6 },
  { bucket: "fo13-gen-hour", windowMs: HOUR, max: 80 },
];

/**
 * Pull the JSON array out of a model response.
 *
 * The prompts ask for a bare array, but a stray code fence or a line of
 * preamble shouldn't cost the author the whole batch — so fall back to the
 * outermost bracketed span before giving up.
 */
function parseCardArray(raw: string): string[] | null {
  const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
  const candidates = [text];
  const first = text.indexOf("[");
  const last = text.lastIndexOf("]");
  if (first !== -1 && last > first) candidates.push(text.slice(first, last + 1));

  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (!Array.isArray(parsed)) continue;
      const strings = parsed
        .filter((v): v is string => typeof v === "string")
        .map((v) => v.trim())
        .filter(Boolean);
      if (strings.length > 0) return strings;
    } catch {
      // Try the next candidate.
    }
  }
  return null;
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

  if (!process.env["ANTHROPIC_API_KEY"]) {
    console.error("[fo13/generate] ANTHROPIC_API_KEY is not set");
    return NextResponse.json(
      { error: "Card generation is not configured on this server." },
      { status: 500 },
    );
  }

  // Admins are exempt — the cap guards provider spend against ordinary
  // authed users, not the owner authoring a pack in one sitting.
  if (!isAdmin && !(await allowRequest(uid, BUCKETS))) {
    return NextResponse.json(
      { error: "Too many generations — give it a minute." },
      { status: 429 },
    );
  }

  const body = (await request.json()) as {
    cardType?: unknown;
    existing?: unknown;
  };

  const cardType = typeof body.cardType === "string" ? body.cardType : "";
  if (!isGeneratedCardType(cardType)) {
    return NextResponse.json(
      { error: "cardType must be Subject, Research, or Footnote" },
      { status: 400 },
    );
  }

  const existing = Array.isArray(body.existing)
    ? body.existing.filter((v): v is string => typeof v === "string")
    : [];

  try {
    const response = await anthropic.messages.create({
      model: "claude-opus-5",
      max_tokens: 16000,
      // The prompts are constraint satisfaction — per-batch quotas, character
      // limits, and no repeats — which is exactly what thinking is for.
      thinking: { type: "adaptive" },
      messages: [{ role: "user", content: fo13Prompt(cardType, existing) }],
    });

    if (response.stop_reason === "refusal") {
      console.warn(
        `[fo13/generate] refused: ${response.stop_details?.category ?? "unknown"}`,
      );
      return NextResponse.json(
        { error: "The model declined this request. Try again." },
        { status: 502 },
      );
    }

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    const parsed = parseCardArray(text);
    if (!parsed) {
      console.error("[fo13/generate] unparseable response:", text.slice(0, 400));
      return NextResponse.json(
        { error: "The model returned something unreadable. Try again." },
        { status: 502 },
      );
    }

    // Over-length lines are kept, not dropped — they are usually one word
    // too long and faster to trim by hand than to regenerate.
    const cards = parsed.slice(0, FO13_GENERATION_COUNT);
    const overLong = cards.filter((c) => c.length > FO13_MAX_TEXT_LENGTH).length;
    if (overLong > 0) {
      console.warn(`[fo13/generate] ${overLong} card(s) over ${FO13_MAX_TEXT_LENGTH} chars`);
    }

    return NextResponse.json({ cards });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "The model is rate limited right now. Try again shortly." },
        { status: 429 },
      );
    }
    if (err instanceof Anthropic.APIError) {
      console.error(`[fo13/generate] Anthropic ${err.status}:`, err.message);
      return NextResponse.json(
        { error: "Card generation failed. Try again." },
        { status: 502 },
      );
    }
    console.error("[fo13/generate] error:", err);
    return NextResponse.json({ error: "Card generation failed." }, { status: 500 });
  }
}
