"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { GameSession } from "@/lib/game-sessions";

// ─── Types ───────────────────────────────────────────────────

export type BluffBoxPhase =
  | "pack-select"
  | "round-intro"
  | "sharing"
  | "ai-share-display"
  | "human-to-ai-input"
  | "guessing"
  | "result"
  | "game-over";

export interface BluffBoxState {
  session: GameSession | null;
  bbPhase: BluffBoxPhase;
  selectedPackId: string | null;
  selectedPackName: string | null;
  selectedPackCoverURL: string | null;
  cardPool: string[];
  roundNumber: number;
  totalRounds: number;
  /** Shuffled UIDs — one sharer per index for the current round. */
  turnOrder: string[];
  /** Index into turnOrder for the current sharer. */
  currentTurnIndex: number;
  /** Current card being shared (flat, not nested in matchup). */
  cardURL: string | null;
  /** The sharer's choice after they share. */
  sharerChoice: "truth" | "lie" | null;
  /** Every non-sharer's guess keyed by UID. */
  guesses: Record<string, "truth" | "lie">;
  /** AI sharer's generated text. */
  aiShareText: string | null;
  /** Human sharer's typed text (for AI guessers). */
  humanShareText: string | null;
  /** Points per player UID. */
  scores: Record<string, number>;
  /** Winner UID(s) at game end. */
  winners: string[];
  /** The winning point total. */
  winnerPoints: number;
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
    totalRounds: (data?.["totalRounds"] as number) ?? 1,
    turnOrder: (data?.["turnOrder"] as string[]) ?? [],
    currentTurnIndex: (data?.["currentTurnIndex"] as number) ?? 0,
    cardURL: (data?.["cardURL"] as string) ?? null,
    sharerChoice: (data?.["sharerChoice"] as "truth" | "lie") ?? null,
    guesses: (data?.["guesses"] as Record<string, "truth" | "lie">) ?? {},
    aiShareText: (data?.["aiShareText"] as string) ?? null,
    humanShareText: (data?.["humanShareText"] as string) ?? null,
    scores: (data?.["scores"] as Record<string, number>) ?? {},
    winners: (data?.["winners"] as string[]) ?? [],
    winnerPoints: (data?.["winnerPoints"] as number) ?? 0,
    isHost,
  };

  return { state, updateFields, setPhase };
}
