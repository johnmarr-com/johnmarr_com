"use client";

import { useState, useEffect, useRef } from "react";
import type { GameSession } from "@/lib/game-sessions";
import type {
  BoatyPhase,
  BoatyState,
  PlayerBoard,
  AttackRecord,
  LastAttack,
} from "./boatyTypes";

/**
 * Server-authoritative Boaty session hook.
 *
 * Reads the public game state from the session doc and the player's OWN secret
 * board from `boatyBoards/{sessionId}/boards/{userId}` (owner-readable, so it
 * survives a reconnect). All game writes go through the Boaty API route — the
 * client never writes game state directly.
 */
export function useBoatySession(
  sessionId: string,
  userId: string,
): { state: BoatyState } {
  const [session, setSession] = useState<GameSession | null>(null);
  const [myBoard, setMyBoard] = useState<PlayerBoard | null>(null);
  const sessionUnsubRef = useRef<(() => void) | null>(null);
  const boardUnsubRef = useRef<(() => void) | null>(null);

  // Subscribe to the public session doc.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { subscribeToSession } = await import("@/lib/game-sessions");
      const unsub = await subscribeToSession(sessionId, (s) => {
        if (!cancelled) setSession(s);
      });
      if (cancelled) unsub();
      else sessionUnsubRef.current = unsub;
    })();
    return () => {
      cancelled = true;
      sessionUnsubRef.current?.();
      sessionUnsubRef.current = null;
    };
  }, [sessionId]);

  // Subscribe to the player's own secret board doc (owner-readable).
  useEffect(() => {
    if (!sessionId || !userId) return;
    let cancelled = false;
    (async () => {
      const { initializeFirebase } = await import("@/lib/firebase");
      const { getFirestore, doc, onSnapshot } = await import("firebase/firestore");
      const { app } = await initializeFirebase();
      const db = getFirestore(app);
      const ref = doc(db, "boatyBoards", sessionId, "boards", userId);
      const unsub = onSnapshot(
        ref,
        (snap) => {
          if (!cancelled) setMyBoard(snap.exists() ? (snap.data() as PlayerBoard) : null);
        },
        () => {}, // pre-submit: no doc / no read — ignore
      );
      if (cancelled) unsub();
      else boardUnsubRef.current = unsub;
    })();
    return () => {
      cancelled = true;
      boardUnsubRef.current?.();
      boardUnsubRef.current = null;
    };
  }, [sessionId, userId]);

  const data = session as (GameSession & Record<string, unknown>) | null;

  const state: BoatyState = {
    session,
    btPhase: (data?.["btPhase"] as BoatyPhase) ?? "setup",
    myBoard,
    btReady: (data?.["btReady"] as Record<string, boolean>) ?? {},
    btCurrentTurn: (data?.["btCurrentTurn"] as string) ?? null,
    btAttacks: (data?.["btAttacks"] as Record<string, AttackRecord>) ?? {},
    btLastAttack: (data?.["btLastAttack"] as LastAttack) ?? null,
    btWinner: (data?.["btWinner"] as string) ?? null,
    isHost: session?.ownerId === userId,
  };

  return { state };
}
