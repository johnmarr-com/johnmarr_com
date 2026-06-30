"use client";

import { getAIAuthHeaders } from "../_gamecore/getAIAuthHeaders";

/**
 * Client-side helpers that call the server-side Lineup API. All game-critical
 * writes go through the API (Admin SDK) so the fact text lands in a secret doc
 * and the engine owns every phase transition.
 */

async function luRequest(
  body: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const headers = await getAIAuthHeaders();
  const res = await fetch("/api/games/lineup", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) return { ok: false, error: data.error ?? "Unknown error" };
  return { ok: true };
}

/** Submit your fun fact (written to the owner-readable secret doc). */
export async function submitFact(
  sessionId: string,
  fact: string,
): Promise<{ ok: boolean; error?: string }> {
  return luRequest({ action: "submit-fact", sessionId, fact });
}

/** Guess who wrote the current fact. */
export async function submitVote(
  sessionId: string,
  votedForUid: string,
): Promise<{ ok: boolean; error?: string }> {
  return luRequest({ action: "submit-vote", sessionId, votedForUid });
}
