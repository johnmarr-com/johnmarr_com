"use client";

import { JMAvatarView } from "@/JMKit";
import type { GameSessionPlayer } from "@/lib/game-sessions";

interface WinnerScreenProps {
  winner: GameSessionPlayer;
  isHost: boolean;
  onPlayAgain: () => void;
}

export default function WinnerScreen({ winner, isHost, onPlayAgain }: WinnerScreenProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
      <p className="text-xs font-bold uppercase tracking-[0.4em] text-amber-400/60">
        Champion
      </p>
      <div className="h-32 w-32">
        <JMAvatarView width={128} avatarName={winner.avatarName ?? "default"} />
      </div>
      <h1 className="text-3xl font-black uppercase tracking-wider text-white">
        {winner.gamertag}
      </h1>
      <p className="text-lg font-bold uppercase tracking-wider text-amber-400">
        Bluff Box Champion!
      </p>

      {isHost && (
        <button
          onClick={onPlayAgain}
          className="mt-6 w-full max-w-xs rounded-xl bg-white py-4 text-lg font-bold uppercase tracking-wider text-black shadow-lg shadow-white/20 transition-all hover:scale-[1.02] active:scale-95"
        >
          Play Again
        </button>
      )}
    </div>
  );
}
