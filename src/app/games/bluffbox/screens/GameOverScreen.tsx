"use client";

import { JMAvatarView } from "@/JMKit";
import type { GameSessionPlayer } from "@/lib/game-sessions";

interface GameOverScreenProps {
  endType: "tie" | "tpk";
  tiedWinners: GameSessionPlayer[];
  allPlayers: GameSessionPlayer[];
  isHost: boolean;
  onPlayAgain: () => void;
}

export default function GameOverScreen({
  endType,
  tiedWinners,
  allPlayers,
  isHost,
  onPlayAgain,
}: GameOverScreenProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
      {endType === "tie" ? (
        <>
          <h1 className="text-3xl font-black uppercase tracking-wider text-amber-400">
            It&apos;s a Tie!
          </h1>
          <div className="flex flex-wrap justify-center gap-4">
            {tiedWinners.map((p) => (
              <div key={p.uid} className="flex flex-col items-center gap-1">
                <div className="h-20 w-20">
                  <JMAvatarView width={80} avatarName={p.avatarName ?? "default"} />
                </div>
                <p className="text-sm font-bold text-white">{p.gamertag}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-white/40">All survivors share the win!</p>
        </>
      ) : (
        <>
          <h1 className="text-3xl font-black uppercase tracking-wider text-red-400">
            Total Party Kill!
          </h1>
          <p className="max-w-xs text-center text-sm text-white/50">
            All players have been eliminated. Nobody won!
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {allPlayers.map((p) => (
              <div key={p.uid} className="flex flex-col items-center gap-1 opacity-30 grayscale">
                <div className="h-14 w-14">
                  <JMAvatarView width={56} avatarName={p.avatarName ?? "default"} />
                </div>
                <p className="text-[10px] font-bold text-white/50">{p.gamertag}</p>
              </div>
            ))}
          </div>
        </>
      )}

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
