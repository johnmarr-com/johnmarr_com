"use client";

import { getAIAuthHeaders } from "../_gamecore/getAIAuthHeaders";

/**
 * Client-side helpers that call the server-side BLARF API.
 * All game-critical writes go through the API so Firestore rules
 * enforce host-only control of game state.
 */

async function bfRequest(
  body: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const headers = await getAIAuthHeaders();
  const res = await fetch("/api/games/blarf", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) return { ok: false, error: data.error ?? "Unknown error" };
  return { ok: true };
}

/** Confirm that the player has seen their role (Blarfer or not). */
export async function confirmRole(
  sessionId: string,
): Promise<{ ok: boolean; error?: string }> {
  return bfRequest({ action: "confirm-role", sessionId });
}

/** Submit multi-vote array (can stack votes on same player). */
export async function submitVotes(
  sessionId: string,
  votes: string[],
): Promise<{ ok: boolean; error?: string }> {
  return bfRequest({ action: "submit-votes", sessionId, votes });
}
