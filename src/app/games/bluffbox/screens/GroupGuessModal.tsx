"use client";

import { JMTruthLieChoice } from "@/JMKit";
import type { TruthLieChoice } from "@/JMKit";
import { GameBgUnderlay } from "../GameBgUnderlay";

interface GroupGuessModalProps {
  /** Game splash under the modal scrim (30%). */
  backgroundImageURL?: string;
  sharerName: string;
  onGuess: (guess: TruthLieChoice) => void;
  hasGuessed: boolean;
  guessCount: number;
  totalGuessers: number;
}

/**
 * Full-screen overlay with Truth / Lie buttons for all non-sharer players.
 * After guessing, shows a waiting state with progress count.
 */
export default function GroupGuessModal({
  backgroundImageURL,
  sharerName,
  onGuess,
  hasGuessed,
  guessCount,
  totalGuessers,
}: GroupGuessModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center">
      <GameBgUnderlay url={backgroundImageURL} />
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-6 px-6">
        {!hasGuessed ? (
          <>
            <h2 className="text-center text-xl font-black uppercase tracking-wider text-white">
              Did {sharerName} tell the truth or a lie?
            </h2>
            <JMTruthLieChoice size="large" onSelect={onGuess} />
          </>
        ) : (
          <>
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
            <p className="text-center text-sm font-bold uppercase tracking-wider text-white/50">
              Waiting for others&hellip; ({guessCount}/{totalGuessers})
            </p>
          </>
        )}
      </div>
    </div>
  );
}
