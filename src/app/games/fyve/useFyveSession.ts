"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { GameSession } from "@/lib/game-sessions";
import { updateSessionFields } from "@/app/games/_gamecore";
import type {
  FyvePhase,
  FyveSessionState,
  FyveBoardCard,
  FyveTeam,
  FyveTeamRoster,
  FyveClue,
  FyvePendingTap,
  FyveHeistSetting,
} from "./fyveTypes";

// ─── Hook ───────────────────────────────────────────────────

interface UseFyveSessionOptions {
  sessionId: string | null;
  userId: string;
}

export function useFyveSession({ sessionId, userId }: UseFyveSessionOptions) {
  const [session, setSession] = useState<GameSession | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  // Subscribe to session
  useEffect(() => {
    if (!sessionId) return;
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
      unsubRef.current = null;
    };
  }, [sessionId]);

  // Derive FYVE-specific state from session doc extra fields
  const svState = useMemo<FyveSessionState>(() => {
    if (!session) {
      return defaultState;
    }
    const s = session as unknown as Record<string, unknown>;
    return {
      svPhase: (s["svPhase"] as FyvePhase) ?? "heist-select",

      selectedHeistId: (s["selectedHeistId"] as string) ?? null,
      selectedHeistTitle: (s["selectedHeistTitle"] as string) ?? null,
      selectedHeistBgUrl: (s["selectedHeistBgUrl"] as string) ?? null,
      selectedHeistTargetUrl: (s["selectedHeistTargetUrl"] as string) ?? null,

      heistBriefing: (s["heistBriefing"] as string) ?? null,
      heistSetting: (s["heistSetting"] as FyveHeistSetting) ?? null,
      teams: (s["teams"] as Record<FyveTeam, FyveTeamRoster>) ?? null,
      t1Name: (s["t1Name"] as string) ?? null,
      t2Name: (s["t2Name"] as string) ?? null,

      draftTeam1: (s["draftTeam1"] as string[]) ?? null,
      draftTeam2: (s["draftTeam2"] as string[]) ?? null,
      draftT1Logo: (s["draftT1Logo"] as string) ?? null,
      draftT2Logo: (s["draftT2Logo"] as string) ?? null,

      // (boss selection is host-only — no votes field)

      board: (s["board"] as FyveBoardCard[]) ?? null,

      activeTeam: (s["activeTeam"] as FyveTeam) ?? null,
      currentClue: (s["currentClue"] as FyveClue) ?? null,
      guessesRemaining: (s["guessesRemaining"] as number) ?? 0,
      guessesUsedThisTurn: (s["guessesUsedThisTurn"] as number) ?? 0,
      bonusGuessAvailable: (s["bonusGuessAvailable"] as boolean) ?? false,

      pendingTap: (s["pendingTap"] as FyvePendingTap) ?? null,

      t1Score: (s["t1Score"] as number) ?? 0,
      t2Score: (s["t2Score"] as number) ?? 0,
      t1RevealCount: (s["t1RevealCount"] as number) ?? 0,
      t2RevealCount: (s["t2RevealCount"] as number) ?? 0,

      t1RevealedAssets: (s["t1RevealedAssets"] as number[]) ?? [],
      t2RevealedAssets: (s["t2RevealedAssets"] as number[]) ?? [],

      winningTeam: (s["winningTeam"] as FyveTeam) ?? null,
      loseByBomb: (s["loseByBomb"] as boolean) ?? false,
      bombRevealedBy: (s["bombRevealedBy"] as string) ?? null,

      keyDocId: (s["keyDocId"] as string) ?? null,
    };
  }, [session]);

  const isHost = !!session && session.ownerId === userId;

  // Determine current user's team
  const myTeam = useMemo<FyveTeam | null>(() => {
    if (!svState.teams) return null;
    if (svState.teams.syndicate1.members.includes(userId)) return "syndicate1";
    if (svState.teams.syndicate2.members.includes(userId)) return "syndicate2";
    return null;
  }, [svState.teams, userId]);

  // Am I a boss?
  const isBoss = useMemo<boolean>(() => {
    if (!svState.teams || !myTeam) return false;
    return svState.teams[myTeam].bossUid === userId;
  }, [svState.teams, myTeam, userId]);

  // Is it my team's turn?
  const isMyTeamActive = svState.activeTeam === myTeam;

  // Host: advance phase
  const setPhase = useCallback(
    async (phase: FyvePhase) => {
      if (!sessionId || !isHost) return;
      await updateSessionFields(sessionId, { svPhase: phase });
    },
    [sessionId, isHost],
  );

  // Generic field update (bound to sessionId)
  const updateFields = useCallback(
    async (fields: Record<string, unknown>) => {
      if (!sessionId) return;
      await updateSessionFields(sessionId, fields);
    },
    [sessionId],
  );

  return {
    session,
    svState,
    isHost,
    myTeam,
    isBoss,
    isMyTeamActive,
    setPhase,
    updateFields,
  };
}

// ─── Default empty state ────────────────────────────────────

const defaultState: FyveSessionState = {
  svPhase: "heist-select",

  selectedHeistId: null,
  selectedHeistTitle: null,
  selectedHeistBgUrl: null,
  selectedHeistTargetUrl: null,

  heistBriefing: null,
  heistSetting: null,
  teams: null,
  t1Name: null,
  t2Name: null,

  draftTeam1: null,
  draftTeam2: null,
  draftT1Logo: null,
  draftT2Logo: null,

  // (no architectVotes — boss selection is host-only)

  board: null,

  activeTeam: null,
  currentClue: null,
  guessesRemaining: 0,
  guessesUsedThisTurn: 0,
  bonusGuessAvailable: false,

  pendingTap: null,

  t1Score: 0,
  t2Score: 0,
  t1RevealCount: 0,
  t2RevealCount: 0,

  t1RevealedAssets: [],
  t2RevealedAssets: [],

  winningTeam: null,
  loseByBomb: false,
  bombRevealedBy: null,

  keyDocId: null,
};
