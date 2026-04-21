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

// ─── AI Word Submission ─────────────────────────────────────

/**
 * AI invents a funny made-up word for the given definition.
 * Returns the word in UPPERCASE (1-40 chars).
 */
export async function aiSubmitWord(
  definition: string,
  persona: { prompt: string; voice: string },
): Promise<string> {
  const text = await aiRequest({
    type: "move",
    prompt: `You are playing a word-invention party game. You are given a definition for something that doesn't have a real word yet. Your job is to invent a single funny, creative, made-up word for it.

Definition: "${definition}"

Rules:
- Invent ONE made-up word (1-3 words max, like a compound word or portmanteau)
- Make it funny, catchy, and memorable
- It should sound like it COULD be a real word
- No real words — this must be invented

Your personality: ${persona.prompt}
Your speaking style: ${persona.voice}

Respond with ONLY the invented word, nothing else. No quotes, no explanation.`,
    temperature: 0.9,
    maxTokens: 30,
  });

  if (!text) return "BLORPITUDE";

  // Clean up: take first line, trim, uppercase, limit length
  const cleaned = text.split("\n")[0]!.trim().replace(/['"]/g, "").toUpperCase();
  return cleaned.slice(0, 40) || "BLORPITUDE";
}

// ─── AI Vote ────────────────────────────────────────────────

/**
 * AI picks their favourite word from the list (excluding their own).
 * Returns the authorId of the word they voted for.
 */
export async function aiVote(
  definition: string,
  words: Array<{ authorId: string; word: string }>,
  ownAuthorId: string,
  persona: { prompt: string; voice: string },
): Promise<string> {
  const voteable = words.filter((w) => w.authorId !== ownAuthorId);
  if (voteable.length === 0) return words[0]?.authorId ?? "";
  if (voteable.length === 1) return voteable[0]!.authorId;

  const wordList = voteable
    .map((w, i) => `${i + 1}. ${w.word}`)
    .join("\n");

  const text = await aiRequest({
    type: "move",
    prompt: `You are playing a word-invention party game. Players invented words for this definition:

"${definition}"

The submitted words are:
${wordList}

Pick your FAVOURITE word — the one that's the funniest, most creative, or most fitting. Your personality: ${persona.prompt}

Respond with ONLY the number of your choice (e.g. "2"), nothing else.`,
    temperature: 0.5,
    maxTokens: 10,
  });

  if (!text) {
    // Random fallback
    return voteable[Math.floor(Math.random() * voteable.length)]!.authorId;
  }

  const num = parseInt(text.trim(), 10);
  if (num >= 1 && num <= voteable.length) {
    return voteable[num - 1]!.authorId;
  }

  // Fallback: random
  return voteable[Math.floor(Math.random() * voteable.length)]!.authorId;
}
