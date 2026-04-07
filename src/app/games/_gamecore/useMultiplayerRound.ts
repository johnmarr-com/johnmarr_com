"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  subscribeToSession,
  submitMove as firestoreSubmitMove,
  writeRoundResult,
  type GameSession,
  type RoundResult,
  type WriteRoundInput,
} from "@/lib/game-sessions";

export type MpPhase = "waiting" | "submitted" | "resolving" | "animating";

export interface ResolverOutput {
  roundEntry: RoundResult;
  transcriptLines: string[];
  gameOver: boolean;
  winner?: string | null;
  extras?: Record<string, unknown>;
}

export type RoundResolver = (
  moves: Record<string, string>,
  session: GameSession,
) => ResolverOutput;

interface UseMultiplayerRoundOptions {
  sessionId: string | null;
  userId: string;
  resolver: RoundResolver;
  onRoundResolved?: (result: RoundResult) => void;
}

export function useMultiplayerRound({
  sessionId,
  userId,
  resolver,
  onRoundResolved,
}: UseMultiplayerRoundOptions) {
  const [session, setSession] = useState<GameSession | null>(null);
  const [animatingRound, setAnimatingRound] = useState(-1);
  const [localSubmitted, setLocalSubmitted] = useState(false);

  const resolverRef = useRef(resolver);
  const onResolvedRef = useRef(onRoundResolved);

  useEffect(() => {
    resolverRef.current = resolver;
    onResolvedRef.current = onRoundResolved;
  });

  const resolvedRoundRef = useRef(-1);
  const dispatchedRoundRef = useRef(-1);

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

  const isHost = !!session && session.ownerId === userId;

  // Host resolves when all moves are in (only writes to Firestore, no local setState)
  useEffect(() => {
    if (!session || session.status !== "playing" || !session.pendingMoves) return;
    if (!isHost) return;

    const playerCount = session.players.length;
    const moveCount = Object.keys(session.pendingMoves).length;
    const allIn = moveCount >= playerCount && playerCount >= 2;
    const currentRound = session.currentRound ?? 0;

    if (allIn && resolvedRoundRef.current < currentRound) {
      resolvedRoundRef.current = currentRound;

      const output = resolverRef.current(session.pendingMoves, session);
      const input: WriteRoundInput = {
        roundEntry: output.roundEntry,
        transcriptLines: output.transcriptLines,
        nextRound: currentRound + 1,
        gameOver: output.gameOver,
        winner: output.winner ?? null,
        ...(output.extras ? { extras: output.extras } : {}),
      };

      writeRoundResult(session.id, input).catch(() => {
        resolvedRoundRef.current = currentRound - 1;
      });
    }
  }, [session, isHost]);

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
