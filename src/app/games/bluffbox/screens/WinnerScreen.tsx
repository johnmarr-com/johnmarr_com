"use client";

import { JMAvatarView } from "@/JMKit";
import type { GameSessionPlayer } from "@/lib/game-sessions";

interface WinnerScreenProps {
  winners: GameSessionPlayer[];
  winnerPoints: number;
  isHost: boolean;
  onPlayAgain: () => void;
}

/**
 * End-of-game screen showing the winner(s).
 *
 * Layout scales by winner count:
 * - 1 winner  → large avatar + gamertag
 * - 2 winners → medium avatars side-by-side
 * - 3+ winners → grid, 3 columns
 */
export default function WinnerScreen({
  winners,
  winnerPoints,
  isHost,
  onPlayAgain,
}: WinnerScreenProps) {
  const plural = winners.length !== 1;

  return (
    <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-hidden px-6 py-8">
      {/* Title */}
      <h1 className="text-center text-4xl font-black uppercase tracking-wider text-green-400">
        {plural ? "THE WINNERS" : "THE WINNER"}
      </h1>

      {/* Winner(s) */}
      {winners.length === 1 && (
        <div className="flex flex-col items-center gap-3">
          <div className="h-72 w-72">
            <JMAvatarView width={288} avatarName={winners[0]!.avatarName ?? "default"} />
          </div>
          <p className="text-2xl font-black uppercase tracking-wider text-white">
            {winners[0]!.gamertag}
          </p>
        </div>
      )}

      {winners.length === 2 && (
        <div className="flex items-end justify-center gap-8">
          {winners.map((w) => (
            <div key={w.uid} className="flex flex-col items-center gap-2">
              <div className="h-48 w-48">
                <JMAvatarView width={192} avatarName={w.avatarName ?? "default"} />
              </div>
              <p className="text-lg font-black uppercase tracking-wider text-white">
                {w.gamertag}
              </p>
            </div>
          ))}
        </div>
      )}

      {winners.length >= 3 && (
        <div className="grid max-w-md grid-cols-3 gap-4">
          {winners.map((w) => (
            <div key={w.uid} className="flex flex-col items-center gap-1.5">
              <div className="h-40 w-40">
                <JMAvatarView width={160} avatarName={w.avatarName ?? "default"} />
              </div>
              <p className="truncate text-center text-sm font-bold text-white">
                {w.gamertag}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Points */}
      <p className="text-xl font-bold text-white">
        {winnerPoints} {winnerPoints === 1 ? "Point" : "Points"}!
      </p>

      {/* Play Again */}
      {isHost && (
        <button
          onClick={onPlayAgain}
          className="mt-4 w-full max-w-xs rounded-xl bg-white py-4 text-lg font-bold uppercase tracking-wider text-black shadow-lg shadow-white/20 transition-all hover:scale-[1.02] active:scale-95"
        >
          Play Again
        </button>
      )}
    </div>
  );
}
