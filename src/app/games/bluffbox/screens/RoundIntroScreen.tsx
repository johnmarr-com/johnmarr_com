"use client";

import { useEffect } from "react";

interface RoundIntroScreenProps {
  roundNumber: number;
  bonusRoundCount: number;
  onComplete: () => void;
}

export default function RoundIntroScreen({ roundNumber, bonusRoundCount, onComplete }: RoundIntroScreenProps) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 2500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  const isBonus = bonusRoundCount > 0;
  const label = isBonus ? `BONUS ROUND ${bonusRoundCount}` : `ROUND ${roundNumber}`;
  const subtitle = isBonus
    ? "Everyone eliminated? Let's try that again!"
    : roundNumber === 1
      ? "Let the bluffing begin!"
      : "Next round!";

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4" onClick={onComplete}>
      <p className="animate-pulse text-xs font-bold uppercase tracking-[0.4em] text-white/40">
        {subtitle}
      </p>
      <h1 className="text-5xl font-black uppercase tracking-wider text-white drop-shadow-lg">
        {label}
      </h1>
    </div>
  );
}
