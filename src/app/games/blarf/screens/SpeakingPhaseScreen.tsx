"use client";

import { useState } from "react";
import { useGameColors, PhaseTimerBar } from "@/app/games/_gamecore";
import type { GameSessionPlayer } from "@/lib/game-sessions";
import { VOICE_STYLE_LABELS } from "../blarfTypes";
import type { VoiceStyle } from "../blarfTypes";

interface SpeakingPhaseScreenProps {
  speakingOrder: string[];
  currentSpeakerIndex: number;
  currentUserId: string;
  players: GameSessionPlayer[];
  /** The viewer's OWN role (from the secret doc). */
  myWord: string;
  amIBlarfer: boolean;
  letter: string;
  voiceStyle: VoiceStyle | null;
  /** Per-speaker timer end (epoch ms) + full duration. */
  deadline: number;
  durationMs: number;
  /** Called when the active speaker taps DONE. */
  onDone: () => Promise<void>;
}

export default function SpeakingPhaseScreen({
  speakingOrder,
  currentSpeakerIndex,
  currentUserId,
  players,
  myWord,
  amIBlarfer,
  letter,
  voiceStyle,
  deadline,
  durationMs,
  onDone,
}: SpeakingPhaseScreenProps) {
  const { primary, tertiary } = useGameColors();
  const [done, setDone] = useState(false);
  const currentSpeakerUid = speakingOrder[currentSpeakerIndex] ?? "";
  const isMyTurn = currentSpeakerUid === currentUserId;
  const speakerName = players.find((p) => p.uid === currentSpeakerUid)?.gamertag ?? "Someone";

  const handleDone = async () => {
    if (done) return;
    setDone(true);
    try {
      await onDone();
    } catch {
      setDone(false);
    }
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-6 py-8">
      {/* Yellow flash overlay — fades in when it's your turn */}
      <div
        className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-500"
        style={{ backgroundColor: primary, opacity: isMyTurn ? 1 : 0 }}
      />

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-6">
        {/* Word card */}
        <div
          className="relative aspect-square w-[90vw] max-w-[600px] bg-cover bg-center bg-no-repeat p-8 text-center"
          style={{ backgroundImage: "url(/images/games/blarf/Blarf-Word.png)" }}
        >
          <div className="absolute left-0 right-0 top-[42%] -translate-y-1/2 px-8">
            {amIBlarfer ? (
              <>
                <h1
                  className="mb-4 text-[clamp(1.5rem,6vw,3rem)] font-black tracking-wider text-white"
                  style={{ textShadow: "0 4px 12px rgba(0,0,0,0.4)" }}
                >
                  Hello, Blarfer!
                </h1>
                <p className="mb-1 text-[clamp(0.875rem,4vw,1.125rem)] font-black tracking-wider text-white">
                  Make up a word that starts with
                </p>
                <p className="mb-4 text-6xl font-black" style={{ color: primary }}>
                  {letter}
                </p>
                <p className="text-base font-bold text-white sm:text-lg">
                  {voiceStyle && voiceStyle !== "normal"
                    ? <>{VOICE_STYLE_LABELS[voiceStyle]}<br />when your screen flashes yellow!</>
                    : <>Say your word confidently<br />when your screen flashes yellow!</>}
                </p>
              </>
            ) : (
              <>
                <p className="mb-2 text-base font-black tracking-wider text-white sm:text-lg">
                  Your word is
                </p>
                <h1
                  className="mb-4 text-[clamp(2rem,8vw,4rem)] font-black lowercase leading-tight tracking-wider"
                  style={{ color: primary }}
                >
                  {myWord}
                </h1>
                <p className="text-base font-bold text-white sm:text-lg">
                  {voiceStyle && voiceStyle !== "normal"
                    ? <>{VOICE_STYLE_LABELS[voiceStyle]}<br />when your screen flashes yellow!</>
                    : <>Say the word confidently<br />when your screen flashes yellow!</>}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Per-speaker timer */}
        <PhaseTimerBar deadline={deadline} durationMs={durationMs} />

        {/* Active speaker gets DONE; everyone else sees who's up. */}
        {isMyTurn ? (
          <button
            onClick={handleDone}
            disabled={done}
            className="w-full max-w-sm rounded-xl py-4 text-lg font-black uppercase tracking-wider text-white transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
            style={{ backgroundColor: tertiary, boxShadow: `0 10px 15px -3px ${tertiary}40` }}
          >
            {done ? "…" : "Done"}
          </button>
        ) : (
          <p className="text-center text-sm font-bold uppercase tracking-wider text-white/80 drop-shadow">
            {speakerName} is speaking&hellip;
          </p>
        )}
      </div>
    </div>
  );
}
