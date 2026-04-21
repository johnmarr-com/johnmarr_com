"use client";

import { useState } from "react";
import { confirmRole } from "../blarfApi";
import { VOICE_STYLE_LABELS } from "../blarfTypes";
import type { VoiceStyle } from "../blarfTypes";

interface RoleRevealScreenProps {
  sessionId: string;
  isBlarfer: boolean;
  word: string;
  letter: string;
  voiceStyle: VoiceStyle | null;
  hasConfirmed: boolean;
  confirmCount: number;
  totalPlayers: number;
}

export default function RoleRevealScreen({
  sessionId,
  isBlarfer,
  word,
  letter,
  voiceStyle,
  hasConfirmed,
  confirmCount,
  totalPlayers,
}: RoleRevealScreenProps) {
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = async () => {
    if (confirming) return;
    setConfirming(true);
    try {
      await confirmRole(sessionId);
    } catch {
      setConfirming(false);
    }
  };

  if (isBlarfer) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-6 py-8">
        {/* Blarfer card */}
        <div
          className="relative aspect-square w-[90vw] max-w-[600px] bg-cover bg-center bg-no-repeat p-8 text-center"
          style={{ backgroundImage: "url(/images/games/blarf/Blarf-Word.png)" }}
        >
          <div className="absolute left-0 right-0 top-[42%] -translate-y-1/2 px-8">
            <h1
              className="mb-4 text-[clamp(1.5rem,6vw,3rem)] font-black tracking-wider text-white"
              style={{ textShadow: "0 4px 12px rgba(0,0,0,0.4)" }}
            >
              Hello, Blarfer!
            </h1>
            <p className="mb-1 text-[clamp(0.875rem,4vw,1.125rem)] font-black tracking-wider text-white">
              Make up a word that starts with
            </p>
            <p
              className="mb-4 text-6xl font-black"
              style={{ color: "#F7D047" }}
            >
              {letter}
            </p>
            <p className="text-base font-bold text-white sm:text-lg">
              {voiceStyle && voiceStyle !== "normal"
                ? <>{VOICE_STYLE_LABELS[voiceStyle]}<br />when your screen flashes yellow!</>
                : <>Say your word confidently<br />when your screen flashes yellow!</>}
            </p>
          </div>
        </div>

        {!hasConfirmed ? (
          <button
            onClick={handleConfirm}
            disabled={confirming}
            className="w-full max-w-sm rounded-xl py-4 text-lg font-black uppercase tracking-wider text-black transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
            style={{ backgroundColor: "#F7D047" }}
          >
            {confirming ? "..." : "Got it!"}
          </button>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
            <p className="text-sm font-bold uppercase tracking-wider text-white/50">
              Waiting for others&hellip; ({confirmCount}/{totalPlayers})
            </p>
          </div>
        )}
      </div>
    );
  }

  // Non-blarfer view
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-6 py-8">
      <div
        className="relative flex aspect-square w-[90vw] max-w-[600px] flex-col items-center bg-cover bg-center bg-no-repeat p-8 text-center"
        style={{ backgroundImage: "url(/images/games/blarf/Blarf-Word.png)" }}
      >
        <div className="absolute left-0 right-0 top-[42%] -translate-y-1/2 px-8">
          <p className="mb-2 text-base font-black tracking-wider text-white sm:text-lg">
            Your word is
          </p>
          <h1
            className="mb-4 text-[clamp(2rem,8vw,4rem)] font-black lowercase leading-tight tracking-wider"
            style={{ color: "#F7D047" }}
          >
            {word}
          </h1>
          <p className="text-base font-bold text-white sm:text-lg">
            {voiceStyle && voiceStyle !== "normal"
              ? <>{VOICE_STYLE_LABELS[voiceStyle]}<br />when your screen flashes yellow!</>
              : <>Say the word confidently<br />when your screen flashes yellow!</>}
          </p>
        </div>
      </div>

      {!hasConfirmed ? (
        <button
          onClick={handleConfirm}
          disabled={confirming}
          className="w-full max-w-sm rounded-xl py-4 text-lg font-black uppercase tracking-wider text-black transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
          style={{ backgroundColor: "#F7D047" }}
        >
          {confirming ? "..." : "Got it!"}
        </button>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
          <p className="text-sm font-bold uppercase tracking-wider text-white/50">
            Waiting for others&hellip; ({confirmCount}/{totalPlayers})
          </p>
        </div>
      )}
    </div>
  );
}
