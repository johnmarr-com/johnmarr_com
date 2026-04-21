"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { GameSession } from "@/lib/game-sessions";
import { updateSessionFields } from "@/app/games/_gamecore";
import type { WordonkulousPhase, WordonkulousState } from "./wordonkulousTypes";

export function useWordonkulousSession(
  sessionId: string,
  userId: string,
): {
  state: WordonkulousState;
  updateFields: (fields: Record<string, unknown>) => Promise<void>;
  setPhase: (phase: WordonkulousPhase) => Promise<void>;
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

  const updateFields = useCallback(
    async (fields: Record<string, unknown>) => {
      await updateSessionFields(sessionId, fields);
    },
    [sessionId],
  );

  const setPhase = useCallback(
    async (phase: WordonkulousPhase) => {
      await updateFields({ wkPhase: phase });
    },
    [updateFields],
  );

  // Derive state from the raw session document
  const data = session as (GameSession & Record<string, unknown>) | null;
  const isHost = session?.ownerId === userId;

  const state: WordonkulousState = {
    session,
    wkPhase: (data?.["wkPhase"] as WordonkulousPhase) ?? "pack-select",
    wkPackId: (data?.["wkPackId"] as string) ?? null,
    wkPackName: (data?.["wkPackName"] as string) ?? null,
    wkPackCoverURL: (data?.["wkPackCoverURL"] as string) ?? null,
    wkDefinitions: (data?.["wkDefinitions"] as string[]) ?? [],
    wkCurrentRound: (data?.["wkCurrentRound"] as number) ?? 1,
    wkTotalRounds: (data?.["wkTotalRounds"] as number) ?? 1,
    wkSubmissions: (data?.["wkSubmissions"] as Record<string, string>) ?? {},
    wkVotes: (data?.["wkVotes"] as Record<string, string>) ?? {},
    wkScores: (data?.["wkScores"] as Record<string, number>) ?? {},
    wkWinners: (data?.["wkWinners"] as string[]) ?? [],
    wkWinnerPoints: (data?.["wkWinnerPoints"] as number) ?? 0,
    wkSubmitDeadline: (data?.["wkSubmitDeadline"] as number) ?? 0,
    wkVoteDeadline: (data?.["wkVoteDeadline"] as number) ?? 0,
    wkShuffledAuthors: (data?.["wkShuffledAuthors"] as string[]) ?? [],
    wkLobbyPackId: (data?.["wkLobbyPackId"] as string) ?? null,
    wkLobbyPackName: (data?.["wkLobbyPackName"] as string) ?? null,
    wkLobbyRounds: (data?.["wkLobbyRounds"] as number) ?? null,
    isHost,
  };

  return { state, updateFields, setPhase };
}
