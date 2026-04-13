"use client";

import { useState } from "react";

interface OpponentGuessScreenProps {
  sharerName: string;
  sharerIsHuman: boolean;
  onGuess: (guess: "truth" | "lie") => void;
}

export default function OpponentGuessScreen({
  sharerName,
  sharerIsHuman,
  onGuess,
}: OpponentGuessScreenProps) {
  const [truthOnLeft] = useState(() => Math.random() < 0.5);

  const truthBtn = (
    <button
      key="truth"
      onClick={() => onGuess("truth")}
      className="flex-1 rounded-xl bg-green-500 py-6 text-2xl font-black uppercase tracking-wider text-black shadow-lg shadow-green-500/30 transition-all hover:scale-[1.02] active:scale-95"
    >
      Truth
    </button>
  );

  const lieBtn = (
    <button
      key="lie"
      onClick={() => onGuess("lie")}
      className="flex-1 rounded-xl bg-red-500 py-6 text-2xl font-black uppercase tracking-wider text-white shadow-lg shadow-red-500/30 transition-all hover:scale-[1.02] active:scale-95"
    >
      Lie
    </button>
  );

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
      <h2 className="text-center text-xl font-black uppercase tracking-wider text-white">
        Did {sharerName} tell the truth or a lie?
      </h2>
      {sharerIsHuman && (
        <p className="text-center text-sm text-white/40">
          You can ask up to 3 questions first
        </p>
      )}
      <div className="flex w-full max-w-sm gap-3">
        {truthOnLeft ? [truthBtn, lieBtn] : [lieBtn, truthBtn]}
      </div>
    </div>
  );
}
