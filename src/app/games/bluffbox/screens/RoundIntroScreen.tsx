"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

interface RoundIntroScreenProps {
  roundNumber: number;
  totalRounds: number;
  onComplete: () => void;
}

export default function RoundIntroScreen({ roundNumber, onComplete }: RoundIntroScreenProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger fade+scale on next frame so the transition runs
    const raf = requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(onComplete, 2500);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [onComplete]);

  const src = `/images/games/bluffbox/Round-${Math.min(roundNumber, 3)}.jpg`;

  return (
    <div className="flex flex-1 items-center justify-center" onClick={onComplete}>
      <Image
        src={src}
        alt={`Round ${roundNumber}`}
        width={600}
        height={600}
        className={`w-[60vw] max-w-[600px] mix-blend-screen transition-all duration-700 ease-out ${
          visible ? "scale-100 opacity-100" : "scale-90 opacity-0"
        }`}
        priority
      />
    </div>
  );
}
