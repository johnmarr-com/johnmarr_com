"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

type Phase = "idle" | "in" | "hold" | "out" | "done";

const FADE_IN = 700;
const HOLD = 1400;
const FADE_OUT = 700;

interface RoundIntroScreenProps {
  roundNumber: number;
  totalRounds: number;
  onComplete: () => void;
  /** Called after the exit animation finishes so the parent can unmount. */
  onAnimationDone?: () => void;
}

/**
 * Full-screen overlay: fades/zooms the round image in, holds, then
 * fades/zooms out to reveal the game screen underneath.
 *
 * Fires `onComplete` at the start of the out-phase so the game advances
 * while the overlay is still animating away.
 */
export default function RoundIntroScreen({
  roundNumber,
  onComplete,
  onAnimationDone,
}: RoundIntroScreenProps) {
  const [phase, setPhase] = useState<Phase>("idle");

  // Stable refs so the animation effect never re-runs due to callback identity changes.
  const onCompleteRef = useRef(onComplete);
  const onAnimDoneRef = useRef(onAnimationDone);
  const firedRef = useRef(false);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { onAnimDoneRef.current = onAnimationDone; }, [onAnimationDone]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setPhase("in"));

    const t1 = setTimeout(() => setPhase("hold"), FADE_IN);
    const t2 = setTimeout(() => {
      setPhase("out");
      if (!firedRef.current) {
        firedRef.current = true;
        onCompleteRef.current();
      }
    }, FADE_IN + HOLD);
    const t3 = setTimeout(() => {
      setPhase("done");
      onAnimDoneRef.current?.();
    }, FADE_IN + HOLD + FADE_OUT);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);  

  const handleTap = useCallback(() => {
    if (phase === "out" || phase === "done") return;
    if (!firedRef.current) {
      firedRef.current = true;
      onCompleteRef.current();
    }
    setPhase("out");
    setTimeout(() => {
      setPhase("done");
      onAnimDoneRef.current?.();
    }, FADE_OUT);
  }, [phase]);

  if (phase === "done") return null;

  const src = `/images/games/bluffbox/Round-${Math.min(roundNumber, 3)}.jpg`;
  const visible = phase === "in" || phase === "hold";

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black transition-opacity duration-700 ease-out ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      onClick={handleTap}
    >
      <Image
        src={src}
        alt={`Round ${roundNumber}`}
        width={600}
        height={600}
        className={`w-[60vw] max-w-[600px] mix-blend-screen transition-all duration-700 ease-out ${
          visible
            ? "scale-100 opacity-100"
            : phase === "out"
              ? "scale-110 opacity-0"
              : "scale-75 opacity-0"
        }`}
        priority
      />
    </div>
  );
}
