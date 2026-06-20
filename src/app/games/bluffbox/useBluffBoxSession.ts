"use client";

import { useState, useEffect, useRef } from "react";
import type { GameSession } from "@/lib/game-sessions";

// ─── Types ───────────────────────────────────────────────────

export type BluffBoxPhase =
  | "pack-select"
  | "round-intro"
  | "sharing"
  | "guessing"
  | "result"
  | "game-over";

/** A completed turn, appended to bbHistory by the engine (recap/history). */
export interface BluffBoxTurnRecord {
  sharerUid: string;
  cardURL: string | null;
  sharerChoice: "truth" | "lie";
  guesses: Record<string, "truth" | "lie">;
  roundNumber: number;
}

export interface BluffBoxState {
  session: GameSession | null;
  bbPhase: BluffBoxPhase;
  selectedPackId: string | null;
  selectedPackName: string | null;
  selectedPackCoverURL: string | null;
  roundNumber: number;
  totalRounds: number;
  /** Shuffled UIDs — one sharer per index for the current round. */
  turnOrder: string[];
  /** Index into turnOrder for the current sharer. */
  currentTurnIndex: number;
  /** Current card being shared (dealt by the engine, public). */
  cardURL: string | null;
  /** Every non-sharer's guess keyed by UID (public; just truth/lie). */
  guesses: Record<string, "truth" | "lie">;
  /** The sharer's choice, published by the engine at `result` (hidden before). */
  bbRevealChoice: "truth" | "lie" | null;
  /** Points per player UID. */
  scores: Record<string, number>;
  /** Completed turns (recap). */
  bbHistory: BluffBoxTurnRecord[];
  winners: string[];
  winnerPoints: number;
  isHost: boolean;
}

// ─── Hook ────────────────────────────────────────────────────
// Read-only session subscription. All game writes go through /api/games/bluffbox
// (the engine owns progression); the client never writes game state directly.

export function useBluffBoxSession(sessionId: string, userId: string): {
  state: BluffBoxState;
} {
  const [session, setSession] = useState<GameSession | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { subscribeToSession } = await import("@/lib/game-sessions");
      const unsub = await subscribeToSession(sessionId, (s) => {
        if (!cancelled) setSession(s);
      });
      if (cancelled) unsub();
      else unsubRef.current = unsub;
    })();
    return () => {
      cancelled = true;
      unsubRef.current?.();
    };
  }, [sessionId]);

  const data = session as (GameSession & Record<string, unknown>) | null;
  const isHost = session?.ownerId === userId;

  const state: BluffBoxState = {
    session,
    bbPhase: (data?.["bbPhase"] as BluffBoxPhase) ?? "pack-select",
    selectedPackId: (data?.["selectedPackId"] as string) ?? null,
    selectedPackName: (data?.["selectedPackName"] as string) ?? null,
    selectedPackCoverURL: (data?.["selectedPackCoverURL"] as string) ?? null,
    roundNumber: (data?.["roundNumber"] as number) ?? 1,
    totalRounds: (data?.["totalRounds"] as number) ?? 1,
    turnOrder: (data?.["turnOrder"] as string[]) ?? [],
    currentTurnIndex: (data?.["currentTurnIndex"] as number) ?? 0,
    cardURL: (data?.["cardURL"] as string) ?? null,
    guesses: (data?.["guesses"] as Record<string, "truth" | "lie">) ?? {},
    bbRevealChoice: (data?.["bbRevealChoice"] as "truth" | "lie") ?? null,
    scores: (data?.["scores"] as Record<string, number>) ?? {},
    bbHistory: (data?.["bbHistory"] as BluffBoxTurnRecord[]) ?? [],
    winners: (data?.["winners"] as string[]) ?? [],
    winnerPoints: (data?.["winnerPoints"] as number) ?? 0,
    isHost,
  };

  return { state };
}
