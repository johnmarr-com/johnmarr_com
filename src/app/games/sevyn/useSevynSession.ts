"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { GameSession } from "@/lib/game-sessions";
import type {
  SevynPhase,
  SevynSessionState,
  SevynBoardCard,
  SevynTeam,
  SevynTeamRoster,
  SevynClue,
  SevynPendingTap,
  SevynHeistSetting,
  SevynClient,
} from "./sevynTypes";

// ─── Firestore Helpers ──────────────────────────────────────

async function getDb() {
  const { initializeFirebase } = await import("@/lib/firebase");
  const { getFirestore } = await import("firebase/firestore");
  const { app } = await initializeFirebase();
  return getFirestore(app);
}

export async function updateSessionFields(
  sessionId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const { doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
  const db = await getDb();
  await updateDoc(doc(db, "gameSessions", sessionId), {
    ...fields,
    updatedAt: serverTimestamp(),
  });
}

// ─── Hook ───────────────────────────────────────────────────

interface UseSevynSessionOptions {
  sessionId: string | null;
  userId: string;
}

export function useSevynSession({ sessionId, userId }: UseSevynSessionOptions) {
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

  // Derive SEVYN-specific state from session doc extra fields
  const svState = useMemo<SevynSessionState>(() => {
    if (!session) {
      return defaultState;
    }
    const s = session as unknown as Record<string, unknown>;
    return {
      svPhase: (s["svPhase"] as SevynPhase) ?? "heist-select",

      selectedHeistId: (s["selectedHeistId"] as string) ?? null,
      selectedHeistTitle: (s["selectedHeistTitle"] as string) ?? null,
      selectedHeistBgUrl: (s["selectedHeistBgUrl"] as string) ?? null,
      selectedHeistTargetUrl: (s["selectedHeistTargetUrl"] as string) ?? null,

      heistBriefing: (s["heistBriefing"] as string) ?? null,
      heistSetting: (s["heistSetting"] as SevynHeistSetting) ?? null,
      heistClients: (s["heistClients"] as { syndicate1: SevynClient; syndicate2: SevynClient }) ?? null,

      teams: (s["teams"] as Record<SevynTeam, SevynTeamRoster>) ?? null,
      teamMode: (s["teamMode"] as "random" | "pick") ?? null,
      t1Name: (s["t1Name"] as string) ?? null,
      t2Name: (s["t2Name"] as string) ?? null,

      architectVotes: (s["architectVotes"] as Record<string, string>) ?? null,

      board: (s["board"] as SevynBoardCard[]) ?? null,

      activeTeam: (s["activeTeam"] as SevynTeam) ?? null,
      currentClue: (s["currentClue"] as SevynClue) ?? null,
      guessesRemaining: (s["guessesRemaining"] as number) ?? 0,
      guessesUsedThisTurn: (s["guessesUsedThisTurn"] as number) ?? 0,
      bonusGuessAvailable: (s["bonusGuessAvailable"] as boolean) ?? false,

      pendingTap: (s["pendingTap"] as SevynPendingTap) ?? null,

      t1Score: (s["t1Score"] as number) ?? 0,
      t2Score: (s["t2Score"] as number) ?? 0,
      t1RevealCount: (s["t1RevealCount"] as number) ?? 0,
      t2RevealCount: (s["t2RevealCount"] as number) ?? 0,

      t1RevealedAssets: (s["t1RevealedAssets"] as number[]) ?? [],
      t2RevealedAssets: (s["t2RevealedAssets"] as number[]) ?? [],

      winningTeam: (s["winningTeam"] as SevynTeam) ?? null,
      loseByBomb: (s["loseByBomb"] as boolean) ?? false,
      bombRevealedBy: (s["bombRevealedBy"] as string) ?? null,

      bombSoundUrl: (s["bombSoundUrl"] as string) ?? null,
      keyDocId: (s["keyDocId"] as string) ?? null,
    };
  }, [session]);

  const isHost = !!session && session.ownerId === userId;

  // Determine current user's team
  const myTeam = useMemo<SevynTeam | null>(() => {
    if (!svState.teams) return null;
    if (svState.teams.syndicate1.members.includes(userId)) return "syndicate1";
    if (svState.teams.syndicate2.members.includes(userId)) return "syndicate2";
    return null;
  }, [svState.teams, userId]);

  // Am I an architect?
  const isArchitect = useMemo<boolean>(() => {
    if (!svState.teams || !myTeam) return false;
    return svState.teams[myTeam].architectUid === userId;
  }, [svState.teams, myTeam, userId]);

  // Is it my team's turn?
  const isMyTeamActive = svState.activeTeam === myTeam;

  // Host: advance phase
  const setPhase = useCallback(
    async (phase: SevynPhase) => {
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
    isArchitect,
    isMyTeamActive,
    setPhase,
    updateFields,
  };
}

// ─── Default empty state ────────────────────────────────────

const defaultState: SevynSessionState = {
  svPhase: "heist-select",

  selectedHeistId: null,
  selectedHeistTitle: null,
  selectedHeistBgUrl: null,
  selectedHeistTargetUrl: null,

  heistBriefing: null,
  heistSetting: null,
  heistClients: null,

  teams: null,
  teamMode: null,
  t1Name: null,
  t2Name: null,

  architectVotes: null,

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

  bombSoundUrl: null,
  keyDocId: null,
};
