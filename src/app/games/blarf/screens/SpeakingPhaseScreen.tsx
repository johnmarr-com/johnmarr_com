"use client";

import { VOICE_STYLE_LABELS } from "../blarfTypes";
import type { VoiceStyle } from "../blarfTypes";

interface SpeakingPhaseScreenProps {
  speakingOrder: string[];
  currentSpeakerIndex: number;
  currentUserId: string;
  assignments: Record<string, string>;
  blarfers: string[];
  voiceStyle: VoiceStyle | null;
  letter: string;
  isHost: boolean;
  isLastSpeaker: boolean;
  onNextSpeaker: () => void;
}

export default function SpeakingPhaseScreen({
  speakingOrder,
  currentSpeakerIndex,
  currentUserId,
  assignments,
  blarfers,
  voiceStyle,
  letter,
  isHost,
  isLastSpeaker,
  onNextSpeaker,
}: SpeakingPhaseScreenProps) {
  const currentSpeakerUid = speakingOrder[currentSpeakerIndex] ?? "";
  const isMyTurn = currentSpeakerUid === currentUserId;

  const myWord = assignments[currentUserId] ?? "";
  const amIBlarfer = blarfers.includes(currentUserId);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-6 py-8">
      {/* Yellow flash overlay — fades in when it's your turn */}
      <div
        className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-500"
        style={{ backgroundColor: "#F7D047", opacity: isMyTurn ? 1 : 0 }}
      />

      <div className="relative z-10 flex flex-col items-center gap-6">
        {/* Same word card as role reveal */}
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
              </>
            ) : (
              <>
                <p className="mb-2 text-base font-black tracking-wider text-white sm:text-lg">
                  Your word is
                </p>
                <h1
                  className="mb-4 text-[clamp(2rem,8vw,4rem)] font-black lowercase leading-tight tracking-wider"
                  style={{ color: "#F7D047" }}
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

        {/* Host controls */}
        {isHost && (
          <button
            onClick={onNextSpeaker}
            className="w-full max-w-sm rounded-xl py-4 text-lg font-black uppercase tracking-wider transition-all duration-500 hover:scale-[1.02] active:scale-95"
            style={{
              backgroundColor: isMyTurn ? "#2B4B6F" : "#F7D047",
              color: isMyTurn ? "#ffffff" : "#000000",
              boxShadow: isMyTurn ? "0 10px 15px -3px rgba(43,75,111,0.25)" : "none",
            }}
          >
            {isLastSpeaker ? "Start Voting" : "Next Speaker"}
          </button>
        )}
      </div>
    </div>
  );
}
