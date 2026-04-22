"use client";

/**
 * useGameFlow — Outer phase state machine for composed games.
 *
 * Manages the high-level flow: landing → game → result → replay.
 * The gate and lobby phases (GC1/GC2) are handled internally by
 * GameLandingPage + GameMultiplayerFlow for V1.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import { getContentBySlug } from "@/lib/content";
import type { JMContent } from "@/lib/content-types";
import { joinGameSessionById, subscribeToSession } from "@/lib/game-sessions";
import type { GameSession } from "@/lib/game-sessions";
import { updateSessionFields } from "../_gamecore/sessionHelpers";
import type { GameFlowPhase, GameEndResult, ComposeGameInput } from "./registry/types";

export interface GameFlowState {
  phase: GameFlowPhase;
  gameData: JMContent | null;
  activeSessionId: string | null;
  session: GameSession | null;
  isHost: boolean;
  gameResult: GameEndResult | null;
  isLoading: boolean;
}

export interface GameFlowActions {
  /** Called by GameLandingPage when multiplayer game starts. */
  handleMultiplayerStart: (sessionId: string) => void;
  /** Called by the GC3 game component when gameplay ends. */
  handleGameEnd: (result: GameEndResult) => void;
  /** Called by the GC4 result screen when the host taps Play Again. */
  handlePlayAgain: () => Promise<void>;
  /** Navigate away / back to home. */
  handleExit: () => void;
}

export function useGameFlow(config: ComposeGameInput): GameFlowState & GameFlowActions {
  const searchParams = useSearchParams();
  const { user, gamertag, avatarName, isLoading: authLoading } = useAuth();
  const initialSessionId = searchParams.get("sessionId");

  // ─── Core state ──────────────────────────────────────────
  const [phase, setPhase] = useState<GameFlowPhase>(
    initialSessionId ? "game" : "landing",
  );
  const [gameData, setGameData] = useState<JMContent | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
  const [session, setSession] = useState<GameSession | null>(null);
  const [gameResult, setGameResult] = useState<GameEndResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const autoJoinRef = useRef(false);

  // Prefer URL sessionId (handles client-side nav from My Games)
  const activeSessionId = initialSessionId ?? sessionId;

  // ─── Fetch game data ─────────────────────────────────────
  useEffect(() => {
    getContentBySlug("game", config.slug).then((data) => {
      setGameData(data);
      setIsLoading(false);
    });
  }, [config.slug]);

  // ─── Auto-join from invite link ──────────────────────────
  useEffect(() => {
    if (!initialSessionId || autoJoinRef.current || authLoading || !user || !gamertag) return;
    autoJoinRef.current = true;
    joinGameSessionById(initialSessionId, user.uid, gamertag, avatarName ?? undefined).catch(() => {});
  }, [initialSessionId, authLoading, user, gamertag, avatarName]);

  // ─── Subscribe to session when active ────────────────────
  useEffect(() => {
    if (!activeSessionId) return;
    let cancelled = false;
    let unsub: (() => void) | undefined;
    subscribeToSession(activeSessionId, (updated) => {
      if (!cancelled) setSession(updated);
    }).then((fn) => {
      if (cancelled) { fn(); } else { unsub = fn; }
    });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [activeSessionId]);

  // ─── Derive isHost ───────────────────────────────────────
  const isHost = !!(session && user && session.ownerId === user.uid);

  // ─── Actions ─────────────────────────────────────────────

  const handleMultiplayerStart = useCallback((sid: string) => {
    setSessionId(sid);
    setPhase("game");
  }, []);

  const handleGameEnd = useCallback((result: GameEndResult) => {
    setGameResult(result);
    setPhase("result");
  }, []);

  const handlePlayAgain = useCallback(async () => {
    if (!activeSessionId) return;
    const fields = config.resetFields(session!);
    await updateSessionFields(activeSessionId, fields);
    setGameResult(null);
    setPhase("game");
  }, [activeSessionId, config, session]);

  const handleExit = useCallback(() => {
    setSessionId(null);
    setSession(null);
    setGameResult(null);
    setPhase("landing");
  }, []);

  return {
    phase,
    gameData,
    activeSessionId,
    session,
    isHost,
    gameResult,
    isLoading,
    handleMultiplayerStart,
    handleGameEnd,
    handlePlayAgain,
    handleExit,
  };
}
