"use client";

import { useEffect, useRef } from "react";
import type { GameSession } from "@/lib/game-sessions";

interface UseMatchAutoStartOptions<Side extends string> {
  session: GameSession | null;
  /** This player's assigned side, once known from Firestore playerSides. */
  side: Side | null;
  isHost: boolean;
  /** True once the joiner has tapped the "Join Match" button. */
  joinerAccepted: boolean;
  /** Kick off the match (the game's handleStart). */
  onStart: (side: Side) => void;
}

/**
 * Auto-start the match once the session is playing and this player's side is
 * known. (The factory re-mounts the game component for a rematch, so no
 * restart detection is needed.)
 *
 * The joiner must tap the "Join Match" button once to satisfy iOS autoplay
 * gesture requirements before the video starts. The host has a fresh gesture
 * from "Start Game", so they auto-enter.
 */
export function useMatchAutoStart<Side extends string>({
  session,
  side,
  isHost,
  joinerAccepted,
  onStart,
}: UseMatchAutoStartOptions<Side>) {
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    if (!session || session.status !== "playing" || !side) return;
    if (!isHost && !joinerAccepted) return;

    startedRef.current = true;
    requestAnimationFrame(() => onStart(side));
  }, [session, side, isHost, joinerAccepted, onStart]);
}
