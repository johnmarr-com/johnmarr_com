"use client";

import { useState } from "react";
import { BluffCard } from "@/JMKit/BluffCard";

interface SharerViewScreenProps {
  cardURL: string | null;
  onRevealBox: () => void;
  onChoose: (choice: "truth" | "lie") => void;
}

export default function SharerViewScreen({ cardURL, onRevealBox, onChoose }: SharerViewScreenProps) {
  const [revealed, setRevealed] = useState(false);

  const [truthOnLeft] = useState(() => Math.random() < 0.5);

  const handleTap = () => {
    if (!revealed && !cardURL) {
      onRevealBox();
    }
    if (!revealed && cardURL) {
      setRevealed(true);
    }
  };

  // Phase 1: Closed box
  if (!cardURL || !revealed) {
    return (
      <div
        className="flex flex-1 flex-col items-center justify-center gap-6 px-8"
        onClick={handleTap}
      >
        {/* Box graphic */}
        <div className="relative">
          <div className="flex h-48 w-48 items-center justify-center rounded-3xl bg-linear-to-br from-amber-500/30 to-amber-700/30 shadow-2xl shadow-amber-500/10">
            <span className="text-6xl">📦</span>
          </div>
          {!cardURL && (
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 animate-pulse rounded-full bg-amber-500/20 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
              Tap to open
            </div>
          )}
        </div>
        <p className="max-w-xs text-center text-sm font-medium text-white/50">
          Tap to view contents. But don&apos;t let anyone see.
        </p>
      </div>
    );
  }

  // Phase 2: Card revealed with Truth/Lie buttons
  const truthBtn = (
    <button
      key="truth"
      onClick={() => onChoose("truth")}
      className="flex-1 rounded-xl bg-green-500 py-5 text-xl font-black uppercase tracking-wider text-black shadow-lg shadow-green-500/30 transition-all hover:scale-[1.02] active:scale-95"
    >
      Truth
    </button>
  );

  const lieBtn = (
    <button
      key="lie"
      onClick={() => onChoose("lie")}
      className="flex-1 rounded-xl bg-red-500 py-5 text-xl font-black uppercase tracking-wider text-white shadow-lg shadow-red-500/30 transition-all hover:scale-[1.02] active:scale-95"
    >
      Lie
    </button>
  );

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
      <BluffCard imageURL={cardURL} size={280} />
      <p className="max-w-xs text-center text-sm font-medium text-white/50">
        Describe what&apos;s in your box — truthfully, or make something up!
      </p>
      <div className="flex w-full max-w-sm gap-3">
        {truthOnLeft ? [truthBtn, lieBtn] : [lieBtn, truthBtn]}
      </div>
    </div>
  );
}
