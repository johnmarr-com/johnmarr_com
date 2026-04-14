"use client";

import { useEffect } from "react";

interface RoundIntroScreenProps {
  roundNumber: number;
  totalRounds: number;
  onComplete: () => void;
}

export default function RoundIntroScreen({ roundNumber, totalRounds, onComplete }: RoundIntroScreenProps) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 2500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  const subtitle =
    roundNumber === 1
      ? "Let the bluffing begin!"
      : "Next round!";

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4" onClick={onComplete}>
      <p className="animate-pulse text-xs font-bold uppercase tracking-[0.4em] text-white/40">
        {subtitle}
      </p>
      <h1 className="text-5xl font-black uppercase tracking-wider text-white drop-shadow-lg">
        ROUND {roundNumber} <span className="text-2xl text-white/50">of {totalRounds}</span>
      </h1>
    </div>
  );
}
