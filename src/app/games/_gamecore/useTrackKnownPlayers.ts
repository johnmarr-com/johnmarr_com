"use client";

import { useEffect, useRef } from "react";
import type { GameSessionPlayer } from "@/lib/game-sessions";
import { isAiPlayer } from "./aiPersonas";

/**
 * Each player runs this against any session they're subscribed to. As new
 * human players appear in the session, they're appended to the current user's
 * own `users/{uid}.knownPlayerUids` (deduped, never including self or AI).
 *
 * Firestore rules only let a user write their own doc, so the reciprocal
 * "we know each other now" relationship requires every participant to do
 * this work for themselves.
 */
export function useTrackKnownPlayers(
  players: GameSessionPlayer[] | undefined,
  currentUid: string | undefined,
) {
  const trackedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!currentUid || !players || players.length === 0) return;

    const newUids = players
      .map((p) => p.uid)
      .filter(
        (uid) =>
          uid !== currentUid &&
          !isAiPlayer(uid) &&
          !trackedRef.current.has(uid),
      );

    if (newUids.length === 0) return;

    newUids.forEach((uid) => trackedRef.current.add(uid));

    void (async () => {
      try {
        const { doc, updateDoc, arrayUnion, getFirestore } = await import(
          "firebase/firestore"
        );
        const { initializeFirebase } = await import("@/lib/firebase");
        const { app } = await initializeFirebase();
        const db = getFirestore(app);
        await updateDoc(doc(db, "users", currentUid), {
          knownPlayerUids: arrayUnion(...newUids),
        });
      } catch {
        // Best-effort; if it fails the next session update will retry.
        newUids.forEach((uid) => trackedRef.current.delete(uid));
      }
    })();
  }, [players, currentUid]);
}
