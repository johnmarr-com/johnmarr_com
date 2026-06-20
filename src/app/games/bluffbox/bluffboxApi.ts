"use client";

import { getAIAuthHeaders } from "../_gamecore/getAIAuthHeaders";

/**
 * Client helpers for the server-authoritative BluffBox API. All game-critical
 * writes go through the route so the engine owns progression and the sharer's
 * truth/lie answer stays in a server-only secret doc.
 */
async function bbRequest(
  body: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const headers = await getAIAuthHeaders();
  const res = await fetch("/api/games/bluffbox", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error ?? "Unknown error" };
  return { ok: true };
}

/** Host: choose the card pack + round count (server shuffles into the secret pool + inits the game). */
export async function selectPack(
  sessionId: string,
  pack: { id: string; name?: string; coverURL?: string | null; cards: string[] },
  rounds: number,
): Promise<{ ok: boolean; error?: string }> {
  return bbRequest({
    action: "select-pack",
    sessionId,
    packId: pack.id,
    packName: pack.name ?? null,
    packCoverURL: pack.coverURL ?? null,
    cards: pack.cards,
    rounds,
  });
}

/** Current sharer: lock the hidden truth/lie answer (stored server-side). */
export async function submitSharerChoice(
  sessionId: string,
  choice: "truth" | "lie",
): Promise<{ ok: boolean; error?: string }> {
  return bbRequest({ action: "sharer-choice", sessionId, choice });
}

/** Guesser: cast a truth/lie guess. */
export async function submitGuess(
  sessionId: string,
  guess: "truth" | "lie",
): Promise<{ ok: boolean; error?: string }> {
  return bbRequest({ action: "submit-guess", sessionId, guess });
}
