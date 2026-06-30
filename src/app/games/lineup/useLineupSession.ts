"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { GameSession } from "@/lib/game-sessions";
import { updateSessionFields } from "@/app/games/_gamecore";
import type { LineupPhase, LineupReveal, LineupState } from "./lineupTypes";

export function useLineupSession(
  sessionId: string,
  userId: string,
): {
  state: LineupState;
  updateFields: (fields: Record<string, unknown>) => Promise<void>;
} {
  const [session, setSession] = useState<GameSession | null>(null);
  const [myFact, setMyFact] = useState<string | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const factUnsubRef = useRef<(() => void) | null>(null);

  // Session: resilient read-to-render + poll-backed live push.
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

  // This player's OWN secret fact doc (owner-readable). Lets the client know
  // when the fact on screen is theirs — so the author sits out their own round
  // — without ever exposing other players' facts.
  useEffect(() => {
    if (!sessionId || !userId) return;
    let cancelled = false;
    (async () => {
      const { initializeFirebase } = await import("@/lib/firebase");
      const { getFirestore, doc, onSnapshot } = await import("firebase/firestore");
      const { app } = await initializeFirebase();
      const db = getFirestore(app);
      const ref = doc(db, "lineupFacts", sessionId, "facts", userId);
      const unsub = onSnapshot(
        ref,
        (snap) => {
          if (!cancelled) {
            const fact = snap.exists() ? (snap.data()["fact"] as string) : null;
            setMyFact(fact ?? null);
          }
        },
        () => {}, // pre-submission: no doc — ignore
      );
      if (cancelled) unsub();
      else factUnsubRef.current = unsub;
    })();
    return () => {
      cancelled = true;
      factUnsubRef.current?.();
      factUnsubRef.current = null;
    };
  }, [sessionId, userId]);

  const updateFields = useCallback(
    async (fields: Record<string, unknown>) => {
      await updateSessionFields(sessionId, fields);
    },
    [sessionId],
  );

  // Derive state from the raw session document.
  const data = session as (GameSession & Record<string, unknown>) | null;
  const isHost = session?.ownerId === userId;

  const state: LineupState = {
    session,
    luPhase: (data?.["luPhase"] as LineupPhase) ?? "collecting",
    luSubmitted: (data?.["luSubmitted"] as Record<string, boolean>) ?? {},
    luCurrentIndex: (data?.["luCurrentIndex"] as number) ?? 0,
    luCurrentFact: (data?.["luCurrentFact"] as string) ?? "",
    luTotalRounds: (data?.["luTotalRounds"] as number) ?? 0,
    luVotes: (data?.["luVotes"] as Record<string, string>) ?? {},
    luScores: (data?.["luScores"] as Record<string, number>) ?? {},
    luReveal: (data?.["luReveal"] as LineupReveal | null) ?? null,
    luWinners: (data?.["luWinners"] as string[]) ?? [],
    luWinnerPoints: (data?.["luWinnerPoints"] as number) ?? 0,
    phaseDeadlineAt: (data?.["phaseDeadlineAt"] as number) ?? 0,
    myFact,
    isHost,
  };

  return { state, updateFields };
}
