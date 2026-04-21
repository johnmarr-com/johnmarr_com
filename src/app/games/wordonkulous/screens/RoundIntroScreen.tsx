"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";

type Phase = "idle" | "in" | "hold" | "out" | "done";

const FADE_IN = 700;
const HOLD = 1400;
const FADE_OUT = 700;

interface RoundIntroScreenProps {
  roundNumber: number;
  onComplete: () => void;
  onAnimationDone?: () => void;
}

export default function RoundIntroScreen({
  roundNumber,
  onComplete,
  onAnimationDone,
}: RoundIntroScreenProps) {
  const [phase, setPhase] = useState<Phase>("idle");

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

  const visible = phase === "in" || phase === "hold";

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center ${
        phase === "out" ? "pointer-events-none" : ""
      }`}
      onClick={handleTap}
    >
      <div
        className={`flex flex-col items-center gap-4 transition-all duration-700 ease-out ${
          visible
            ? "scale-100 opacity-100"
            : phase === "out"
              ? "scale-125 opacity-0"
              : "scale-50 opacity-0"
        }`}
      >
        {roundNumber >= 1 && roundNumber <= 7 ? (
          <Image
            src={`/images/games/wordonkulous/Round-${roundNumber}.png`}
            alt={`Round ${roundNumber}`}
            width={500}
            height={500}
            className="h-auto w-[85vw] max-w-[500px] object-contain drop-shadow-[0_0_24px_rgba(142,255,14,0.4)] select-none"
            priority
          />
        ) : (
          <h1 className="text-6xl font-black uppercase tracking-wider drop-shadow-[0_0_16px_rgba(142,255,14,0.4)] sm:text-7xl" style={{ color: "#8eff0e" }}>
            Round {roundNumber}
          </h1>
        )}
      </div>
    </div>
  );
}
