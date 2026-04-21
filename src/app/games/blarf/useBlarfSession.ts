"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { GameSession } from "@/lib/game-sessions";
import { updateSessionFields } from "@/app/games/_gamecore";
import type { BlarfPhase, BlarfState, BlarfRoundData, VoiceStyle } from "./blarfTypes";

export function useBlarfSession(
  sessionId: string,
  userId: string,
): {
  state: BlarfState;
  updateFields: (fields: Record<string, unknown>) => Promise<void>;
  setPhase: (phase: BlarfPhase) => Promise<void>;
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
    async (phase: BlarfPhase) => {
      await updateFields({ bfPhase: phase });
    },
    [updateFields],
  );

  // Derive state from the raw session document
  const data = session as (GameSession & Record<string, unknown>) | null;
  const isHost = session?.ownerId === userId;

  const state: BlarfState = {
    session,
    bfPhase: (data?.["bfPhase"] as BlarfPhase) ?? "pack-select",
    bfPackId: (data?.["bfPackId"] as string) ?? null,
    bfPackName: (data?.["bfPackName"] as string) ?? null,
    bfPackCoverURL: (data?.["bfPackCoverURL"] as string) ?? null,
    bfRounds: (data?.["bfRounds"] as BlarfRoundData[]) ?? [],
    bfCurrentRound: (data?.["bfCurrentRound"] as number) ?? 1,
    bfTotalRounds: (data?.["bfTotalRounds"] as number) ?? 1,
    bfBlarfers: (data?.["bfBlarfers"] as string[]) ?? [],
    bfAssignments: (data?.["bfAssignments"] as Record<string, string>) ?? {},
    bfBlarferLetter: (data?.["bfBlarferLetter"] as string) ?? "",
    bfVoiceStyle: (data?.["bfVoiceStyle"] as VoiceStyle) ?? null,
    bfRoleConfirmed: (data?.["bfRoleConfirmed"] as Record<string, boolean>) ?? {},
    bfSpeakingOrder: (data?.["bfSpeakingOrder"] as string[]) ?? [],
    bfCurrentSpeaker: (data?.["bfCurrentSpeaker"] as number) ?? 0,
    bfVotes: (data?.["bfVotes"] as Record<string, string[]>) ?? {},
    bfVoteDeadline: (data?.["bfVoteDeadline"] as number) ?? 0,
    bfScores: (data?.["bfScores"] as Record<string, number>) ?? {},
    bfRoundDeltas: (data?.["bfRoundDeltas"] as Record<string, number>) ?? {},
    bfVoteCounts: (data?.["bfVoteCounts"] as Record<string, number>) ?? {},
    bfWinners: (data?.["bfWinners"] as string[]) ?? [],
    bfWinnerPoints: (data?.["bfWinnerPoints"] as number) ?? 0,
    bfLobbyPackId: (data?.["bfLobbyPackId"] as string) ?? null,
    bfLobbyPackName: (data?.["bfLobbyPackName"] as string) ?? null,
    bfLobbyPackCoverURL: (data?.["bfLobbyPackCoverURL"] as string) ?? null,
    bfLobbyRounds: (data?.["bfLobbyRounds"] as number) ?? null,
    bfRevealed: (data?.["bfRevealed"] as boolean) ?? false,
    isHost,
  };

  return { state, updateFields, setPhase };
}
