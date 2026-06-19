"use client";

import { useEffect, useState } from "react";
import { useGameColors } from "@/app/games/_gamecore";

/**
 * Full-width phase timer as a depleting progress bar (not a numeric countdown).
 * Dark track + a brand-color fill that drains from full → empty over the phase.
 * `deadline` is the epoch-ms end; `durationMs` is the full phase length (so the
 * fill fraction = remaining / duration).
 */
export default function PhaseTimerBar({
  deadline,
  durationMs,
}: {
  deadline: number;
  durationMs: number;
}) {
  const { secondary } = useGameColors();
  const [fraction, setFraction] = useState(1);

  useEffect(() => {
    if (deadline <= 0 || durationMs <= 0) return;
    const tick = () => {
      const remaining = Math.max(0, deadline - Date.now());
      setFraction(Math.max(0, Math.min(1, remaining / durationMs)));
    };
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [deadline, durationMs]);

  if (deadline <= 0) return null;

  return (
    <div
      className="h-3 w-full overflow-hidden rounded-full bg-black/50"
      role="timer"
      aria-hidden
    >
      <div
        className="h-full rounded-full transition-[width] duration-200 ease-linear"
        style={{ width: `${fraction * 100}%`, backgroundColor: secondary }}
      />
    </div>
  );
}
