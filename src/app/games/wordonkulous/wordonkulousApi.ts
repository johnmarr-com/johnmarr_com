"use client";

import { getAIAuthHeaders } from "../_gamecore/getAIAuthHeaders";

/**
 * Client-side helpers that call the server-side Wordonkulous API.
 * All game-critical writes go through the API so Firestore rules
 * enforce host-only control of game state.
 */

async function wkRequest(
  body: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const headers = await getAIAuthHeaders();
  const res = await fetch("/api/games/wordonkulous", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) return { ok: false, error: data.error ?? "Unknown error" };
  return { ok: true };
}

/** Host: choose the word pack + round count (server selects defs + inits scores). */
export async function selectPack(
  sessionId: string,
  pack: { id: string; name?: string; coverURL?: string | null; definitions: string[] },
  rounds: number,
): Promise<{ ok: boolean; error?: string }> {
  return wkRequest({
    action: "select-pack",
    sessionId,
    packId: pack.id,
    packName: pack.name ?? null,
    packCoverURL: pack.coverURL ?? null,
    definitions: pack.definitions,
    rounds,
  });
}

/** Submit a made-up word for the current round. */
export async function submitWord(
  sessionId: string,
  word: string,
): Promise<{ ok: boolean; error?: string }> {
  return wkRequest({ action: "submit-word", sessionId, word });
}

/** Vote for another player's word. */
export async function submitVote(
  sessionId: string,
  votedForUid: string,
): Promise<{ ok: boolean; error?: string }> {
  return wkRequest({ action: "submit-vote", sessionId, votedForUid });
}
