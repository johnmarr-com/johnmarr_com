"use client";

import { getAIAuthHeaders } from "../_gamecore/getAIAuthHeaders";
import {
  aiHistoryTierForLevel,
  sliceHistoryByTier,
  TIER_PROMPT_DIRECTIVE,
} from "../_gamecore/aiSkillDice";

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

// ─── Types ───────────────────────────────────────────────────

/** One completed turn — what the AI sees as "history". */
export interface BluffBoxTurnRecord {
  round: number;
  /** Index into the round's turn order. */
  turn: number;
  sharerUid: string;
  /** What the sharer SAID about the box (truth or lie). */
  shareText: string;
  /** What was actually true (the sharer's choice this turn). */
  sharerChoice: "truth" | "lie";
  /** uid → guess for every non-sharer. */
  guesses: Record<string, "truth" | "lie">;
  /** How many guessers were fooled. */
  fooledCount: number;
}

interface AIPersonaForBluff {
  prompt: string;
  voice: string;
  skillLevel?: number | undefined;
}

type Player = { uid: string; gamertag: string };

// ─── History formatter ───────────────────────────────────────

/** Render a sliced turn history into prompt text. Empty slice → empty string. */
function formatHistoryForPrompt(
  history: readonly BluffBoxTurnRecord[],
  players: readonly Player[],
): string {
  if (history.length === 0) return "";
  const nameFor = (uid: string) =>
    players.find((p) => p.uid === uid)?.gamertag ?? "Unknown";

  return history
    .map((h) => {
      const sharer = nameFor(h.sharerUid);
      const guessLines = Object.entries(h.guesses).map(([uid, g]) => {
        const correct = g === h.sharerChoice;
        return `  - ${nameFor(uid)} guessed ${g.toUpperCase()} (${correct ? "correct" : "fooled"})`;
      });
      return [
        `Round ${h.round}, turn ${h.turn + 1}: ${sharer} said "${h.shareText}"`,
        `  → It was actually a ${h.sharerChoice.toUpperCase()}. (${h.fooledCount} fooled)`,
        ...guessLines,
      ].join("\n");
    })
    .join("\n\n");
}

// ─── AI as Sharer ────────────────────────────────────────────

export interface AIShareResult {
  choice: "truth" | "lie";
  shareText: string;
}

/**
 * AI's turn to share. Two LLM calls:
 *   1. Decide TRUTH or LIE (text-only, history-aware per skill tier).
 *   2. Generate the description (vision for truth, text-only for lie).
 *
 * Skill differentiation lives entirely in step 1: lower tiers see no
 * voting history, so they can't pattern-match on what fools opponents.
 */
export async function aiShare(args: {
  cardImageURL: string;
  persona: AIPersonaForBluff;
  history: readonly BluffBoxTurnRecord[];
  players: readonly Player[];
}): Promise<AIShareResult> {
  const { cardImageURL, persona, history, players } = args;
  const tier = aiHistoryTierForLevel(persona.skillLevel);
  const directive = TIER_PROMPT_DIRECTIVE[tier];
  const slicedHistory = sliceHistoryByTier(history, tier);
  const historyText = formatHistoryForPrompt(slicedHistory, players);

  // ─── Step 1: decide truth or lie ───
  const decisionPrompt = [
    `You are playing BluffBox, a bluffing card game.`,
    `On your turn you open a mystery box and share what's inside — but you can choose to TELL THE TRUTH or LIE.`,
    `You score points when guessers are fooled (you said TRUTH and they guess LIE, or you said LIE and they guess TRUTH). Your goal is to win.`,
    ``,
    directive,
    ``,
    historyText
      ? `Game history available to you:\n${historyText}\n`
      : `(You have no history available — decide based on personality and instinct.)\n`,
    `Your personality: ${persona.prompt}`,
    ``,
    `Decide strategically: TRUTH or LIE? Respond with ONLY the word "TRUTH" or "LIE".`,
  ].join("\n");

  const decision = await aiRequest({ type: "move", prompt: decisionPrompt });
  const choice: "truth" | "lie" = (() => {
    if (!decision) return Math.random() < 0.5 ? "truth" : "lie";
    const upper = decision.toUpperCase().trim();
    if (upper.includes("LIE")) return "lie";
    if (upper.includes("TRUTH")) return "truth";
    return Math.random() < 0.5 ? "truth" : "lie";
  })();

  // ─── Step 2: generate the description ───
  const sharePrompt =
    choice === "truth"
      ? `You are playing a bluffing game. You opened a box and found the object shown. You've decided to TELL THE TRUTH about what's inside. Describe the object in 1-2 fun, dramatic sentences. Be specific about what you see but make it entertaining. Your personality: ${persona.prompt}. Your speaking style: ${persona.voice}. Just output the description, nothing else.`
      : `You are playing a bluffing game. You opened a box containing a secret object, but you've decided to LIE about what's inside. Make up a completely different, believable but fun object. Describe it in 1-2 dramatic sentences. Your personality: ${persona.prompt}. Your speaking style: ${persona.voice}. Just output the fake description, nothing else.`;

  const text =
    choice === "truth"
      ? await aiRequest({ type: "vision", imageUrl: cardImageURL, prompt: sharePrompt })
      : await aiRequest({ type: "move", prompt: sharePrompt });

  return {
    choice,
    shareText:
      text ||
      (choice === "truth"
        ? "I see something incredible in this box... something truly bizarre!"
        : "You won't believe what's in here... it's absolutely wild!"),
  };
}

// ─── AI as Guesser ───────────────────────────────────────────

/**
 * AI guesses whether the sharer told the truth or lied.
 * Skill tier gates how much history the AI can pattern-match against.
 */
export async function aiGuess(args: {
  shareText: string;
  sharerName: string;
  persona: AIPersonaForBluff;
  history: readonly BluffBoxTurnRecord[];
  players: readonly Player[];
}): Promise<"truth" | "lie"> {
  const { shareText, sharerName, persona, history, players } = args;
  const tier = aiHistoryTierForLevel(persona.skillLevel);
  const directive = TIER_PROMPT_DIRECTIVE[tier];
  const sliced = sliceHistoryByTier(history, tier);
  const historyText = formatHistoryForPrompt(sliced, players);

  const prompt = [
    `You are playing BluffBox, a bluffing card game.`,
    `${sharerName} opened a mystery box and described what's inside. They might be telling the truth, or they might be lying.`,
    ``,
    `What ${sharerName} said:`,
    `"${shareText}"`,
    ``,
    directive,
    ``,
    historyText
      ? `Game history (use it to spot patterns — who lies, what gets believed, what fools people):\n${historyText}\n`
      : `(You have no history available — decide based on the description alone and your personality.)\n`,
    `Your personality: ${persona.prompt}`,
    ``,
    `Decide: TRUTH or LIE? Respond with ONLY the word "TRUTH" or "LIE".`,
  ].join("\n");

  const text = await aiRequest({ type: "move", prompt });

  if (!text) return Math.random() < 0.5 ? "truth" : "lie";
  const upper = text.toUpperCase().trim();
  if (upper.includes("TRUTH")) return "truth";
  if (upper.includes("LIE")) return "lie";
  return Math.random() < 0.5 ? "truth" : "lie";
}
