"use client";

import { getAIAuthHeaders } from "@/app/games/_gamecore";
import type { CardType } from "./fyveTypes";

/**
 * Client helpers for the server-authoritative FYVE API. All game-critical writes
 * go through the route so the engine owns progression (board/key generation, the
 * reveal loop, turns, win/loss) and the secret key never reaches a client.
 */
async function fyveRequest(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  const headers = await getAIAuthHeaders();
  const res = await fetch("/api/games/fyve", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error ?? "Unknown error" };
  return { ok: true };
}

// ─── Host setup ─────────────────────────────────────────────

export function selectHeist(sessionId: string, heistId: string) {
  return fyveRequest({ action: "select-heist", sessionId, heistId });
}

export function continueBriefing(sessionId: string) {
  return fyveRequest({ action: "continue-briefing", sessionId });
}

export function updateDraft(
  sessionId: string,
  draft: { draftTeam1?: string[]; draftTeam2?: string[]; draftT1Logo?: string | null; draftT2Logo?: string | null },
) {
  return fyveRequest({ action: "update-draft", sessionId, ...draft });
}

export function confirmTeams(
  sessionId: string,
  args: { team1: string[]; team2: string[]; t1Name: string; t2Name: string; t1Logo?: string | null; t2Logo?: string | null },
) {
  return fyveRequest({ action: "confirm-teams", sessionId, ...args });
}

export function backToTeams(sessionId: string) {
  return fyveRequest({ action: "back-to-teams", sessionId });
}

export function selectBosses(sessionId: string, s1Boss: string, s2Boss: string) {
  return fyveRequest({ action: "select-bosses", sessionId, s1Boss, s2Boss });
}

export function playAgain(sessionId: string) {
  return fyveRequest({ action: "play-again", sessionId });
}

// ─── Player moves (engine resolves) ─────────────────────────

export function submitClue(sessionId: string, clueWord: string, number: number) {
  return fyveRequest({ action: "submit-clue", sessionId, clueWord, number });
}

export function tapCard(sessionId: string, cardIndex: number) {
  return fyveRequest({ action: "tap-card", sessionId, cardIndex });
}

export function passTurn(sessionId: string) {
  return fyveRequest({ action: "pass-turn", sessionId });
}

// ─── Boss color map (read; never stored) ────────────────────

export async function getBossView(sessionId: string): Promise<CardType[] | null> {
  const headers = await getAIAuthHeaders();
  const res = await fetch("/api/games/fyve", {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "get-boss-view", sessionId }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { colorMap?: CardType[] };
  return data.colorMap ?? null;
}
