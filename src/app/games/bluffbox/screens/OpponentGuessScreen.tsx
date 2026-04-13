"use client";

import { JMTruthLieChoice } from "@/JMKit/JMTruthLieChoice";

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
      <JMTruthLieChoice onSelect={onGuess} size="large" className="max-w-sm" />
    </div>
  );
}
