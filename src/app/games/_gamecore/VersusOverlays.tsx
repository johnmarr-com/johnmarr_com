"use client";

import { useJMStyle } from "@/JMStyle";
import { JMBannerText } from "@/JMKit";

/**
 * Bottom-anchored end-of-match banner shown over the winner video chapter
 * (which auto-advances to the GC4 result screen — no button).
 */
export function GameFinishedOverlay({
  message,
  color,
  leftScore,
  rightScore,
  className,
}: {
  message: string;
  /** Banner text color (the local player's side color). */
  color: string;
  leftScore: number;
  rightScore: number;
  /** Extra classes (e.g. "z-10" when the game stacks overlays). */
  className?: string;
}) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 flex flex-col items-center justify-end gap-3 bg-linear-to-t from-black/80 via-transparent to-transparent pb-8${className ? ` ${className}` : ""}`}
    >
      <JMBannerText paddingX={32} paddingY={10}>
        <h2
          className="text-center text-3xl font-black uppercase tracking-tight sm:text-4xl"
          style={{ color }}
        >
          {message}
        </h2>
      </JMBannerText>
      <p className="text-lg font-bold text-white/60">
        {leftScore} &ndash; {rightScore}
      </p>
    </div>
  );
}

/** Gold "Join Match" button — the joiner's one iOS autoplay-unlock gesture. */
export function JoinMatchButton({ onJoin }: { onJoin: () => void }) {
  const { theme } = useJMStyle();
  return (
    <button
      onClick={onJoin}
      className="rounded-full px-10 py-4 text-lg font-black uppercase tracking-wider text-black transition-transform hover:scale-105 active:scale-95"
      style={{ backgroundColor: theme.accents.goldenGlow }}
    >
      Join Match
    </button>
  );
}
