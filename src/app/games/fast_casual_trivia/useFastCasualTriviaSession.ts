"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameSession } from "@/lib/game-sessions";
import { updateSessionFields } from "@/app/games/_gamecore";
import {
  FCT_DEFAULT_PHASE,
  FCT_DEFAULT_TEAM_COUNT,
  type FctMode,
  type FctPhase,
  type FctState,
  type FctTeam,
} from "./fastCasualTriviaTypes";

/**
 * Live FCT session hook. Subscribes to the GameSession Firestore doc and
 * exposes a derived FctState plus typed setters. Only the host should call
 * the setters (callers enforce, not this hook).
 */
export function useFastCasualTriviaSession(
  sessionId: string,
  userId: string,
  initialSkinId: string,
): {
  state: FctState;
  setPhase: (phase: FctPhase) => Promise<void>;
  setMode: (mode: FctMode) => Promise<void>;
  setTeamCount: (n: number) => Promise<void>;
  setTeams: (teams: FctTeam[]) => Promise<void>;
  setSkinId: (skinId: string) => Promise<void>;
  setActiveTags: (tags: string[]) => Promise<void>;
  updateFields: (fields: Record<string, unknown>) => Promise<void>;
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
    (fields: Record<string, unknown>) => updateSessionFields(sessionId, fields),
    [sessionId],
  );

  const setPhase = useCallback(
    (phase: FctPhase) => updateFields({ fctPhase: phase }),
    [updateFields],
  );
  const setMode = useCallback(
    (mode: FctMode) => updateFields({ fctMode: mode }),
    [updateFields],
  );
  const setTeamCount = useCallback(
    (n: number) => updateFields({ fctTeamCount: n }),
    [updateFields],
  );
  const setTeams = useCallback(
    (teams: FctTeam[]) => updateFields({ fctTeams: teams }),
    [updateFields],
  );
  const setSkinId = useCallback(
    (skinId: string) => updateFields({ fctSkinId: skinId }),
    [updateFields],
  );
  const setActiveTags = useCallback(
    (tags: string[]) => updateFields({ fctActiveTags: tags }),
    [updateFields],
  );

  const data = session as (GameSession & Record<string, unknown>) | null;
  const isHost = session?.ownerId === userId;

  const state: FctState = {
    session,
    phase: (data?.["fctPhase"] as FctPhase) ?? FCT_DEFAULT_PHASE,
    mode: (data?.["fctMode"] as FctMode | null) ?? null,
    teamCount:
      (data?.["fctTeamCount"] as number | undefined) ?? FCT_DEFAULT_TEAM_COUNT,
    teams: (data?.["fctTeams"] as FctTeam[] | undefined) ?? [],
    skinId: (data?.["fctSkinId"] as string | undefined) ?? initialSkinId,
    activeTags: (data?.["fctActiveTags"] as string[] | undefined) ?? [],
    scores: (data?.["fctScores"] as Record<string, number> | undefined) ?? {},
    isHost,
  };

  return {
    state,
    setPhase,
    setMode,
    setTeamCount,
    setTeams,
    setSkinId,
    setActiveTags,
    updateFields,
  };
}
