"use client";

import { getAIAuthHeaders } from "../_gamecore/getAIAuthHeaders";

const AI_TIMEOUT_MS = 15_000;

async function aiRequest(body: Record<string, unknown>): Promise<string | null> {
  const headers = await getAIAuthHeaders();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const res = await fetch("/api/games/ai", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await res.json();
    return data.text ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ─── AI as Sharer ────────────────────────────────────────────

export interface AIShareResult {
  choice: "truth" | "lie";
  shareText: string;
}

/**
 * AI decides whether to tell truth or lie, then generates share text.
 * Uses vision API for truth (sees the card), text API for lies (makes something up).
 */
export async function aiShare(
  cardImageURL: string,
  persona: { prompt: string; voice: string },
): Promise<AIShareResult> {
  const tellTruth = Math.random() < 0.5;

  if (tellTruth) {
    const text = await aiRequest({
      type: "vision",
      imageUrl: cardImageURL,
      prompt: `You are playing a bluffing game. You opened a box and found the object shown. You've decided to TELL THE TRUTH about what's inside. Describe the object in 1-2 fun, dramatic sentences. Be specific about what you see but make it entertaining. Your personality: ${persona.prompt}. Your speaking style: ${persona.voice}. Just output the description, nothing else.`,
    });
    return {
      choice: "truth",
      shareText: text || "I see something incredible in this box... something truly bizarre!",
    };
  }

  const text = await aiRequest({
    type: "move",
    prompt: `You are playing a bluffing game. You opened a box containing a secret object, but you've decided to LIE about what's inside. Make up a completely different, believable but fun object. Describe it in 1-2 dramatic sentences. Your personality: ${persona.prompt}. Your speaking style: ${persona.voice}. Just output the fake description, nothing else.`,
  });
  return {
    choice: "lie",
    shareText: text || "You won't believe what's in here... it's absolutely wild!",
  };
}

// ─── AI as Opponent ──────────────────────────────────────────

/**
 * AI guesses whether the sharer told the truth or lied.
 */
export async function aiGuess(
  shareText: string,
  persona: { prompt: string; voice: string },
): Promise<"truth" | "lie"> {
  const text = await aiRequest({
    type: "move",
    prompt: `You are playing a bluffing game. Your opponent opened a mystery box and told you what's inside. They said:\n\n"${shareText}"\n\nThey might be telling the truth, or they might be lying. Based on how their description sounds, decide: are they telling the TRUTH or a LIE?\n\nYour personality: ${persona.prompt}\n\nRespond with ONLY the word "TRUTH" or "LIE", nothing else.`,
  });

  if (!text) return Math.random() < 0.5 ? "truth" : "lie";

  const upper = text.toUpperCase().trim();
  if (upper.includes("TRUTH")) return "truth";
  if (upper.includes("LIE")) return "lie";
  return Math.random() < 0.5 ? "truth" : "lie";
}
