"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface JMTeamInterstitialProps {
  /** Display name (e.g. "Red Wolves") */
  teamName: string;
  /** Hex color for tinting and accent text */
  teamColor: string;
  /** Grayscale team logo URL — will be tinted with teamColor */
  logoUrl: string;
  /** Current score to display (shown as {score}/7) */
  score: number;
  /** Max score (defaults to 7) */
  maxScore?: number;
  /** Called after the exit animation completes */
  onDismiss: () => void;
  /** Total visible duration in ms (default 4000) */
  duration?: number;
}

export function JMTeamInterstitial({
  teamName,
  teamColor,
  logoUrl,
  score,
  maxScore = 7,
  onDismiss,
  duration = 4000,
}: JMTeamInterstitialProps) {
  const [phase, setPhase] = useState<"enter" | "visible" | "exit">("enter");
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const dismissedRef = useRef(false);

  useEffect(() => {
    const ANIM = 500;
    const t1 = setTimeout(() => setPhase("visible"), 50);
    const t2 = setTimeout(() => setPhase("exit"), 50 + ANIM + duration);
    const t3 = setTimeout(onDismiss, 50 + ANIM + duration + ANIM);
    timersRef.current = [t1, t2, t3];
    return () => { timersRef.current.forEach(clearTimeout); };
  }, [duration, onDismiss]);

  const handleTapDismiss = useCallback(() => {
    if (dismissedRef.current || phase === "enter") return;
    dismissedRef.current = true;
    timersRef.current.forEach(clearTimeout);
    setPhase("exit");
    setTimeout(onDismiss, 500);
  }, [phase, onDismiss]);

  const show = phase === "visible";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center cursor-pointer"
      style={{
        backgroundColor: show ? "rgba(0,0,0,0.85)" : "rgba(0,0,0,0)",
        backdropFilter: show ? "blur(16px)" : "blur(0px)",
        WebkitBackdropFilter: show ? "blur(16px)" : "blur(0px)",
        transition: "background-color 500ms ease, backdrop-filter 500ms ease, -webkit-backdrop-filter 500ms ease",
        pointerEvents: phase === "enter" ? "none" : "auto",
      }}
      onClick={handleTapDismiss}
    >
      {/* NOW PLAYING */}
      <p
        className="text-xs font-bold uppercase tracking-[0.3em]"
        style={{
          color: teamColor,
          opacity: show ? 1 : 0,
          transform: show ? "translateY(0)" : "translateY(-20px)",
          transition: "opacity 500ms ease, transform 500ms ease",
        }}
      >
        Now Playing
      </p>

      {/* Tinted team logo */}
      <div
        className="relative mt-4 aspect-square w-[200px] shrink-0 overflow-hidden rounded-full"
        style={{
          backgroundColor: `${teamColor}20`,
          opacity: show ? 1 : 0,
          transform: show ? "scale(1)" : "scale(0.7)",
          transition: "opacity 500ms ease, transform 500ms ease",
        }}
      >
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${logoUrl})` }}
        />
        <div
          className="absolute inset-0"
          style={{ backgroundColor: teamColor, mixBlendMode: "color" }}
        />
      </div>

      {/* Team name */}
      <p
        className="mt-4 text-xl font-black text-white"
        style={{
          opacity: show ? 1 : 0,
          transition: "opacity 500ms ease",
        }}
      >
        {teamName}
      </p>

      {/* Score */}
      <p
        className="mt-2 text-4xl font-black"
        style={{
          color: teamColor,
          opacity: show ? 1 : 0,
          transform: show ? "translateY(0)" : "translateY(20px)",
          transition: "opacity 500ms ease, transform 500ms ease",
        }}
      >
        {score}/{maxScore}
      </p>
    </div>
  );
}
