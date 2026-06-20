"use client";

import { getAIAuthHeaders } from "@/app/games/_gamecore";

/**
 * Client helpers for the server-authoritative MegaSketchy API. All game-critical
 * writes go through the route so the engine owns progression (chain seeding +
 * the draw/guess loop with a 60s hourglass) and the LLM judge/scoring run as
 * server effects — no host client in the loop.
 */
async function msRequest(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  const headers = await getAIAuthHeaders();
  const res = await fetch("/api/games/megasketchy", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error ?? "Unknown error" };
  return { ok: true };
}

/** Host: begin the mission (engine seeds the chains + starts the hourglass). */
export function beginMission(sessionId: string, missionId: string) {
  return msRequest({ action: "begin-mission", sessionId, missionId });
}

/** Host: reorder the play order in briefing. */
export function reorder(sessionId: string, order: string[]) {
  return msRequest({ action: "reorder", sessionId, order });
}

/** Player: submit a sketch URL or text guess for the current task. */
export function transmit(sessionId: string, elementIndex: number, value: string) {
  return msRequest({ action: "transmit", sessionId, elementIndex, value });
}

/** Player: cast a vote (advanced/expert modes). */
export function vote(sessionId: string, targetUid: string) {
  return msRequest({ action: "vote", sessionId, targetUid });
}

/** Host: advance a result/display phase (madlibs/reveal/scoring/voting/done). */
export function advance(sessionId: string) {
  return msRequest({ action: "advance", sessionId });
}

/** Host: reset for another round (engine re-shuffles → briefing). */
export function playAgain(sessionId: string) {
  return msRequest({ action: "play-again", sessionId });
}
