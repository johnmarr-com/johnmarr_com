"use client";

import { JMAvatarView, JMWinnerLoserCard } from "@/JMKit";
import { useGameColors } from "@/app/games/_gamecore";
import type { GameSessionPlayer } from "@/lib/game-sessions";

interface WinnerScreenProps {
  winners: GameSessionPlayer[];
  winnerPoints: number;
  allPlayers: GameSessionPlayer[];
  scores: Record<string, number>;
  isHost: boolean;
  onPlayAgain: () => void;
}

export default function WinnerScreen({
  winners,
  winnerPoints,
  allPlayers,
  scores,
  isHost,
  onPlayAgain,
}: WinnerScreenProps) {
  const { primary, secondary } = useGameColors();
  const winnerUids = new Set(winners.map((w) => w.uid));
  const others = allPlayers
    .filter((p) => !winnerUids.has(p.uid))
    .sort((a, b) => (scores[b.uid] ?? 0) - (scores[a.uid] ?? 0));

  return (
    <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-5 overflow-hidden bg-black/30 px-6 py-8">
      {/* Winner card(s) */}
      {winners.length === 1 && (
        <JMWinnerLoserCard
          variant="winner"
          avatarName={winners[0]!.avatarName ?? "default"}
          name={winners[0]!.gamertag}
          subtitle={`${winnerPoints} ${winnerPoints === 1 ? "point" : "points"}!`}
        />
      )}
      {winners.length >= 2 && (
        <div className="flex flex-wrap items-start justify-center gap-4">
          {winners.map((w) => (
            <JMWinnerLoserCard
              key={w.uid}
              variant="winner"
              avatarName={w.avatarName ?? "default"}
              name={w.gamertag}
              subtitle={`${winnerPoints} ${winnerPoints === 1 ? "point" : "points"}!`}
            />
          ))}
        </div>
      )}

      {/* Leaderboard */}
      {others.length > 0 && (
        <div
          className="w-full max-w-md rounded-xl border border-white/10 bg-black/40 px-4 py-3"
          style={{ boxShadow: "inset 0 4px 8px rgba(0,0,0,0.5), inset 0 -2px 4px rgba(255,255,255,0.1)" }}
        >
          <p className="mb-2 text-center text-xs font-black uppercase tracking-widest text-white/50">
            Leaderboard
          </p>
          <div className="flex flex-col gap-2">
            {others.map((p) => (
              <div key={p.uid} className="flex items-center gap-3">
                <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-black">
                  <JMAvatarView width={32} avatarName={p.avatarName ?? "default"} />
                </div>
                <span
                  className="min-w-0 flex-1 truncate text-sm font-black"
                  style={{ color: secondary }}
                >
                  {p.gamertag}
                </span>
                <span
                  className="text-sm font-black tabular-nums"
                  style={{ color: primary }}
                >
                  {scores[p.uid] ?? 0}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Play Again */}
      {isHost && (
        <button
          onClick={onPlayAgain}
          className="mt-4 w-full max-w-xs rounded-xl py-4 text-lg font-black uppercase tracking-wider text-black shadow-lg transition-all hover:scale-[1.02] active:scale-95"
          style={{ backgroundColor: primary }}
        >
          Play Again
        </button>
      )}
    </div>
  );
}
