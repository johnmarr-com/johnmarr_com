"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { GameSession } from "@/lib/game-sessions";
import { updateSessionFields } from "@/app/games/_gamecore";
import type {
  BoatyPhase,
  BoatyState,
  PlayerBoard,
  AttackRecord,
  LastAttack,
} from "./boatyTypes";

export function useBoatySession(
  sessionId: string,
  userId: string,
): {
  state: BoatyState;
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
    async (fields: Record<string, unknown>) => {
      await updateSessionFields(sessionId, fields);
    },
    [sessionId],
  );

  const data = session as (GameSession & Record<string, unknown>) | null;
  const isHost = session?.ownerId === userId;

  const state: BoatyState = {
    session,
    btPhase: (data?.["btPhase"] as BoatyPhase) ?? "setup",
    btBoards: (data?.["btBoards"] as Record<string, PlayerBoard>) ?? {},
    btReady: (data?.["btReady"] as Record<string, boolean>) ?? {},
    btCurrentTurn: (data?.["btCurrentTurn"] as string) ?? null,
    btAttacks: (data?.["btAttacks"] as Record<string, AttackRecord>) ?? {},
    btLastAttack: (data?.["btLastAttack"] as LastAttack) ?? null,
    btWinner: (data?.["btWinner"] as string) ?? null,
    isHost,
  };

  return { state, updateFields };
}
