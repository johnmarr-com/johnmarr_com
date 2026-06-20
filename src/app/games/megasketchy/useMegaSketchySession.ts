"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  subscribeToSession,
  type GameSession,
} from "@/lib/game-sessions";
import {
  getPlayerQueue,
  isPlayerFullyDone,
  allChainsComplete,
  type Chains,
  type PlayerTask,
} from "./chainEngine";

// ─── Types ───────────────────────────────────────────────────

export type SkPhase =
  | "lobby"
  | "briefing"
  | "active"
  | "madlibs"
  | "reveal"
  | "scoring"
  | "voting"
  | "done"
  | "share";

export interface ScoringResult {
  passed: boolean;
  narrative: string;
}

export interface MegaSketchyState {
  playOrder: string[];
  aiPlayerId: string | null;
  message: { id: string; template: string; elements: string[] } | null;
  chains: Chains;
  /** Per-chain hourglass deadline (epoch ms) for the current pending step. */
  chainDeadlines: Record<string, number>;
  skPhase: SkPhase;
  gameMode: "basic" | "advanced" | "expert";
  moleId: string | null;
  eliminatedPlayers: string[];
  missionNumber: number;
  votes: Record<string, string>;
  elementMatches: boolean[] | null;
  scoringResult: ScoringResult | null;
}

// ─── Hook ────────────────────────────────────────────────────

interface UseMegaSketchySessionOptions {
  sessionId: string | null;
  userId: string;
}

export function useMegaSketchySession({
  sessionId,
  userId,
}: UseMegaSketchySessionOptions) {
  const [session, setSession] = useState<GameSession | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  // Subscribe to session
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    subscribeToSession(sessionId, (s) => {
      if (!cancelled) setSession(s);
    }).then((unsub) => {
      if (cancelled) unsub();
      else unsubRef.current = unsub;
    });

    return () => {
      cancelled = true;
      unsubRef.current?.();
      unsubRef.current = null;
    };
  }, [sessionId]);

  // Derive Mega Sketchy-specific state from the session doc's extra fields
  const skState = useMemo<MegaSketchyState>(() => {
    if (!session) {
      return {
        playOrder: [],
        aiPlayerId: null,
        message: null,
        chains: {},
        chainDeadlines: {},
        skPhase: "lobby" as SkPhase,
        gameMode: "basic" as const,
        moleId: null,
        eliminatedPlayers: [],
        missionNumber: 0,
        votes: {},
        elementMatches: null,
        scoringResult: null,
      };
    }
    // Session doc has extra fields written by Mega Sketchy that aren't in the GameSession type.
    // Access via bracket notation to satisfy TS index-signature rules.
    const s = session as unknown as Record<string, unknown>;
    return {
      playOrder: (s["playOrder"] as string[]) ?? [],
      aiPlayerId: (s["aiPlayerId"] as string) ?? null,
      message: (s["message"] as MegaSketchyState["message"]) ?? null,
      chains: (s["chains"] as Chains) ?? {},
      chainDeadlines: (s["chainDeadlines"] as Record<string, number>) ?? {},
      skPhase: (s["skPhase"] as SkPhase) ?? "lobby",
      gameMode: (s["gameMode"] as MegaSketchyState["gameMode"]) ?? "basic",
      moleId: (s["moleId"] as string) ?? null,
      eliminatedPlayers: (s["eliminatedPlayers"] as string[]) ?? [],
      missionNumber: (s["missionNumber"] as number) ?? 0,
      votes: (s["votes"] as Record<string, string>) ?? {},
      elementMatches: (s["elementMatches"] as boolean[]) ?? null,
      scoringResult: (s["scoringResult"] as ScoringResult) ?? null,
    };
  }, [session]);

  const isHost = !!session && session.ownerId === userId;

  // Player queue
  const myQueue = useMemo<PlayerTask[]>(() => {
    if (skState.skPhase !== "active" || skState.playOrder.length === 0) return [];
    return getPlayerQueue(userId, skState.chains, skState.playOrder);
  }, [userId, skState.chains, skState.playOrder, skState.skPhase]);

  const currentTask = myQueue[0] ?? null;

  const queueLength = myQueue.length;

  // Check if this player has finished all their steps (no more work coming)
  const playerDone = useMemo(() => {
    if (skState.skPhase !== "active" || skState.playOrder.length === 0) return false;
    return isPlayerFullyDone(userId, skState.chains, skState.playOrder);
  }, [userId, skState.chains, skState.playOrder, skState.skPhase]);

  // Check if all chains are done
  const chainsComplete = useMemo(() => {
    if (skState.playOrder.length === 0) return false;
    return allChainsComplete(skState.chains, skState.playOrder.length);
  }, [skState.chains, skState.playOrder]);

  // Read-only: the engine (via /api/games/megasketchy) owns ALL writes.
  return {
    session,
    skState,
    isHost,
    myQueue,
    currentTask,
    queueLength,
    playerDone,
    chainsComplete,
  };
}
