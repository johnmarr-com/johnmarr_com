"use client";

import { useEffect, useRef } from "react";
import type { GameSession } from "@/lib/game-sessions";
import { isAiPlayer } from "./aiPersonas";
import { getAIAuthHeaders } from "./getAIAuthHeaders";

/**
 * Cross-records the human players in a session into every participant's
 * `users/{uid}.knownPlayerUids`. The actual write happens server-side via
 * the Admin SDK (POST /api/games/known-players), which avoids the iOS
 * Safari client-side write failures that previously left joiners out of
 * each other's known-players lists.
 *
 * Each subscribed client calls the API whenever the list of human players
 * changes; the endpoint is idempotent (arrayUnion), so duplicate calls are
 * harmless.
 */
export function useTrackKnownPlayers(
  session: GameSession | null | undefined,
  currentUid: string | undefined,
) {
  const lastSyncedKeyRef = useRef<string>("");

  useEffect(() => {
    if (!currentUid || !session?.id || !session.players) return;

    const humanUids = session.players
      .map((p) => p.uid)
      .filter((uid) => !isAiPlayer(uid))
      .sort();
    if (humanUids.length < 2 || !humanUids.includes(currentUid)) return;

    const key = `${session.id}|${humanUids.join(",")}`;
    if (lastSyncedKeyRef.current === key) return;
    lastSyncedKeyRef.current = key;

    void (async () => {
      try {
        const headers = await getAIAuthHeaders();
        if (!("Authorization" in headers)) {
          console.warn("[KnownPlayers] No auth token yet; will retry");
          lastSyncedKeyRef.current = "";
          return;
        }
        console.log(
          `[KnownPlayers] sync session=${session.id} humans=${humanUids.length}`,
        );
        const res = await fetch("/api/games/known-players", {
          method: "POST",
          headers,
          body: JSON.stringify({ sessionId: session.id }),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          console.warn(
            `[KnownPlayers] sync failed status=${res.status} body=${text}`,
          );
          lastSyncedKeyRef.current = "";
        } else {
          const json = (await res.json().catch(() => ({}))) as {
            written?: number;
          };
          console.log(`[KnownPlayers] sync ok written=${json.written ?? "?"}`);
        }
      } catch (err) {
        console.warn("[KnownPlayers] sync threw:", err);
        lastSyncedKeyRef.current = "";
      }
    })();
  }, [session, currentUid]);
}
