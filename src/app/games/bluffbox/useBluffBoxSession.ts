"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { GameSession } from "@/lib/game-sessions";
import type { PlayerStatus } from "./tournament";

// ─── Types ───────────────────────────────────────────────────

export type BluffBoxPhase =
  | "pack-select"
  | "round-intro"
  | "matchup-reveal"
  | "sharer-box"
  | "sharer-decide"
  | "ai-share-display"
  | "human-to-ai-input"
  | "opponent-guess"
  | "turn-result"
  | "matchup-complete"
  | "round-end"
  | "game-over";

export interface MatchupState {
  sharer: string;
  opponent: string;
  turn: 1 | 2;
  isStandIn: boolean;
  cardURL: string | null;
  sharerChoice: "truth" | "lie" | null;
  opponentGuess: "truth" | "lie" | null;
  aiShareText: string | null;
  humanShareText: string | null;
}

export interface MatchupLogEntry {
  sharer: string;
  opponent: string;
  sharerChoice: "truth" | "lie";
  opponentGuess: "truth" | "lie";
  sharerEliminated: boolean;
  isStandIn: boolean;
  round: number;
}

export interface BluffBoxState {
  session: GameSession | null;
  bbPhase: BluffBoxPhase;
  selectedPackId: string | null;
  selectedPackName: string | null;
  selectedPackCoverURL: string | null;
  cardPool: string[];
  roundNumber: number;
  bonusRoundCount: number;
  /** Sorted UIDs who survived the prior round-end (for stalemate detection). */
  prevRoundSurvivorIds: string[];
  playerStatuses: Record<string, PlayerStatus>;
  matchup: MatchupState | null;
  matchupLog: MatchupLogEntry[];
  bbWinner: string | null;
  bbTiedWinners: string[];
  bbEndType: "winner" | "tie" | "tpk" | null;
  isHost: boolean;
}

// ─── Hook ────────────────────────────────────────────────────

export function useBluffBoxSession(sessionId: string, userId: string): {
  state: BluffBoxState;
  updateFields: (fields: Record<string, unknown>) => Promise<void>;
  setPhase: (phase: BluffBoxPhase) => Promise<void>;
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
      if (cancelled) {
        unsub();
      } else {
        unsubRef.current = unsub;
      }
    })();
    return () => {
      cancelled = true;
      unsubRef.current?.();
    };
  }, [sessionId]);

  const updateFields = useCallback(async (fields: Record<string, unknown>) => {
    const { updateDoc, doc, serverTimestamp } = await import("firebase/firestore");
    const { initializeFirebase } = await import("@/lib/firebase");
    const { getFirestore } = await import("firebase/firestore");
    const { app } = await initializeFirebase();
    const db = getFirestore(app);

    await updateDoc(doc(db, "gameSessions", sessionId), {
      ...fields,
      updatedAt: serverTimestamp(),
    });
  }, [sessionId]);

  const setPhase = useCallback(async (phase: BluffBoxPhase) => {
    await updateFields({ bbPhase: phase });
  }, [updateFields]);

  // Derive state from the raw session document
  const data = session as (GameSession & Record<string, unknown>) | null;
  const isHost = session?.ownerId === userId;

  const state: BluffBoxState = {
    session,
    bbPhase: (data?.["bbPhase"] as BluffBoxPhase) ?? "pack-select",
    selectedPackId: (data?.["selectedPackId"] as string) ?? null,
    selectedPackName: (data?.["selectedPackName"] as string) ?? null,
    selectedPackCoverURL: (data?.["selectedPackCoverURL"] as string) ?? null,
    cardPool: (data?.["cardPool"] as string[]) ?? [],
    roundNumber: (data?.["roundNumber"] as number) ?? 1,
    bonusRoundCount: (data?.["bonusRoundCount"] as number) ?? 0,
    prevRoundSurvivorIds: (data?.["prevRoundSurvivorIds"] as string[]) ?? [],
    playerStatuses: (data?.["playerStatuses"] as Record<string, PlayerStatus>) ?? {},
    matchup: (data?.["matchup"] as MatchupState) ?? null,
    matchupLog: (data?.["matchupLog"] as MatchupLogEntry[]) ?? [],
    bbWinner: (data?.["bbWinner"] as string) ?? null,
    bbTiedWinners: (data?.["bbTiedWinners"] as string[]) ?? [],
    bbEndType: (data?.["bbEndType"] as "winner" | "tie" | "tpk") ?? null,
    isHost,
  };

  return { state, updateFields, setPhase };
}
