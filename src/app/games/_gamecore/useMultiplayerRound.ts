"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  subscribeToSession,
  submitMove as firestoreSubmitMove,
  type GameSession,
  type RoundResult,
} from "@/lib/game-sessions";
import { useTrackKnownPlayers } from "./useTrackKnownPlayers";

export type MpPhase = "waiting" | "submitted" | "resolving" | "animating";

interface UseMultiplayerRoundOptions {
  sessionId: string | null;
  userId: string;
  onRoundResolved?: (result: RoundResult) => void;
}

/**
 * Render-only round loop for the legacy simultaneous-move games (SweepTheLeg,
 * TapSmashArena). Rounds are resolved SERVER-SIDE by the engine's
 * simultaneous-move adapter (`resolverKey`); this hook subscribes, submits the
 * player's own move, and dispatches resolved rounds to the game component.
 * (The old client-side host-resolution path was removed once both consumers
 * went server-authoritative — see docs/SERVER-AUTHORITY-ENGINE.md.)
 */
export function useMultiplayerRound({
  sessionId,
  userId,
  onRoundResolved,
}: UseMultiplayerRoundOptions) {
  const [session, setSession] = useState<GameSession | null>(null);
  const [animatingRound, setAnimatingRound] = useState(-1);
  const [localSubmitted, setLocalSubmitted] = useState(false);

  const onResolvedRef = useRef(onRoundResolved);

  useEffect(() => {
    onResolvedRef.current = onRoundResolved;
  });

  const dispatchedRoundRef = useRef(-1);
  const prevRoundsLenRef = useRef(0);

  // Detect game restart (rounds array emptied, currentRound reset to 0)
  useEffect(() => {
    if (!session || session.status !== "playing") return;
    const roundsLen = session.rounds?.length ?? 0;
    if (roundsLen === 0 && prevRoundsLenRef.current > 0 && session.currentRound === 0) {
      dispatchedRoundRef.current = -1;
      requestAnimationFrame(() => {
        setAnimatingRound(-1);
        setLocalSubmitted(false);
      });
    }
    prevRoundsLenRef.current = roundsLen;
  }, [session]);

  // Subscribe to session
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    let unsub: (() => void) | null = null;

    subscribeToSession(sessionId, (s) => {
      if (!cancelled) setSession(s);
    }).then((u) => {
      if (cancelled) u();
      else unsub = u;
    });

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [sessionId]);

  // Reciprocal known-players: each subscribed client asks the server to
  // cross-write the relationship (Admin SDK, immune to iOS Safari client-
  // side write failures).
  useTrackKnownPlayers(session, userId || undefined);

  const isHost = !!session && session.ownerId === userId;

  // Dispatch round results via callback (no setState — game component handles its own state)
  useEffect(() => {
    if (!session?.rounds?.length) return;

    const latest = session.rounds[session.rounds.length - 1]!;
    if (latest.round > dispatchedRoundRef.current) {
      dispatchedRoundRef.current = latest.round;
      requestAnimationFrame(() => {
        setAnimatingRound(latest.round);
        setLocalSubmitted(false);
        onResolvedRef.current?.(latest);
      });
    }
  }, [session?.rounds]);

  // Reset localSubmitted when pendingMoves clears (new round)
  useEffect(() => {
    if (!session || session.status !== "playing") return;
    const moves = session.pendingMoves ?? {};
    if (Object.keys(moves).length === 0 && localSubmitted) {
      requestAnimationFrame(() => setLocalSubmitted(false));
    }
  }, [session, localSubmitted]);

  const submitMove = useCallback(
    async (move: string) => {
      if (!sessionId) return;
      setLocalSubmitted(true);
      await firestoreSubmitMove(sessionId, userId, move);
    },
    [sessionId, userId],
  );

  const markAnimationDone = useCallback(() => {
    setAnimatingRound(-1);
  }, []);

  // Derive phase from state instead of setting it in effects
  const myMoveSubmitted = localSubmitted || !!(session?.pendingMoves?.[userId]);
  const allMovesIn =
    !!session?.pendingMoves &&
    Object.keys(session.pendingMoves).length >= (session?.players.length ?? 0) &&
    (session?.players.length ?? 0) >= 2;

  let phase: MpPhase = "waiting";
  if (animatingRound >= 0) {
    phase = "animating";
  } else if (allMovesIn) {
    phase = "resolving";
  } else if (myMoveSubmitted) {
    phase = "submitted";
  }

  return {
    session,
    phase,
    isHost,
    submitMove,
    markAnimationDone,
    myMoveSubmitted,
    allMovesIn,
  };
}
