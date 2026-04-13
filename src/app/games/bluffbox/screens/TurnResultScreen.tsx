"use client";

import { useEffect } from "react";

interface TurnResultScreenProps {
  sharerName: string;
  opponentName: string;
  sharerChoice: "truth" | "lie";
  opponentGuess: "truth" | "lie";
  opponentSurvived: boolean;
  onComplete: () => void;
}

export default function TurnResultScreen({
  sharerName,
  opponentName,
  sharerChoice,
  opponentGuess,
  opponentSurvived,
  onComplete,
}: TurnResultScreenProps) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 3500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  const truthLabel = sharerChoice === "truth" ? "told the TRUTH!" : "LIED!";

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6" onClick={onComplete}>
      <h2 className={`text-center text-3xl font-black uppercase tracking-wider ${
        sharerChoice === "truth" ? "text-green-400" : "text-red-400"
      }`}>
        {sharerName} {truthLabel}
      </h2>

      <div className="h-px w-24 bg-white/20" />

      <div className="text-center">
        <p className="text-sm text-white/50">
          {opponentName} guessed: <span className="font-bold text-white">{opponentGuess.toUpperCase()}</span>
        </p>
        <p className={`mt-2 text-2xl font-black uppercase ${
          opponentSurvived ? "text-green-400" : "text-red-400"
        }`}>
          {opponentName} {opponentSurvived ? "SURVIVES!" : "is ELIMINATED!"}
        </p>
      </div>
    </div>
  );
}
