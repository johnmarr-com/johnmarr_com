"use client";

import { useEffect } from "react";
import { getAIAuthHeaders } from "./getAIAuthHeaders";

/**
 * Client-side nudge for timed server-authority phases.
 *
 * The engine only advances on a session write. For timed phases with no player
 * input (round intro, results hold), this fires `/api/games/engine-tick` the
 * instant the phase deadline passes, so the engine advances immediately instead
 * of waiting for the 1-minute sweep. Any present client may nudge; the reducer
 * is idempotent (advances once via the `seq` fence). A small random delay
 * de-syncs concurrent clients so they don't all poke at the same millisecond.
 *
 * Pass the session's `phaseDeadlineAt` (epoch ms, or 0/undefined when the
 * current phase is untimed). Re-arms whenever the deadline changes.
 */
export function useEngineDeadline(
  sessionId: string,
  phaseDeadlineAt: number | undefined,
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled || !sessionId || !phaseDeadlineAt || phaseDeadlineAt <= 0) return;

    let cancelled = false;

    const nudge = async () => {
      if (cancelled) return;
      try {
        const headers = await getAIAuthHeaders();
        await fetch("/api/games/engine-tick", {
          method: "POST",
          headers,
          body: JSON.stringify({ sessionId }),
        });
      } catch {
        // best-effort; the sweep is the safety net
      }
    };

    const delay = phaseDeadlineAt - Date.now();
    const jitter = Math.random() * 1200; // de-sync concurrent clients
    const timer = setTimeout(() => void nudge(), Math.max(0, delay) + 250 + jitter);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [sessionId, phaseDeadlineAt, enabled]);
}
