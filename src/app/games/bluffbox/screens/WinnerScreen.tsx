"use client";

import { JMAvatarView } from "@/JMKit";
import type { GameSessionPlayer } from "@/lib/game-sessions";

interface WinnerScreenProps {
  winners: GameSessionPlayer[];
  winnerPoints: number;
  allPlayers: GameSessionPlayer[];
  scores: Record<string, number>;
  isHost: boolean;
  onPlayAgain: () => void;
}

/**
 * End-of-game screen showing the winner(s) prominently,
 * then every other player in a 2-column grid sorted by score.
 */
export default function WinnerScreen({
  winners,
  winnerPoints,
  allPlayers,
  scores,
  isHost,
  onPlayAgain,
}: WinnerScreenProps) {
  const winnerUids = new Set(winners.map((w) => w.uid));
  const others = allPlayers
    .filter((p) => !winnerUids.has(p.uid))
    .sort((a, b) => (scores[b.uid] ?? 0) - (scores[a.uid] ?? 0));

  return (
    <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center gap-5 overflow-hidden px-6 py-8">
      {/* Title */}
      <h1 className="text-center text-4xl font-black uppercase tracking-wider text-green-400">
        {winners.length !== 1 ? "THE WINNERS" : "THE WINNER"}
      </h1>

      {/* Winner avatar(s) */}
      {winners.length === 1 && (
        <div className="h-56 w-56">
          <JMAvatarView width={224} avatarName={winners[0]!.avatarName ?? "default"} />
        </div>
      )}

      {winners.length === 2 && (
        <div className="flex items-end justify-center gap-6">
          {winners.map((w) => (
            <div key={w.uid} className="h-40 w-40">
              <JMAvatarView width={160} avatarName={w.avatarName ?? "default"} />
            </div>
          ))}
        </div>
      )}

      {winners.length >= 3 && (
        <div className="flex flex-wrap items-end justify-center gap-4">
          {winners.map((w) => (
            <div key={w.uid} className="h-32 w-32">
              <JMAvatarView width={128} avatarName={w.avatarName ?? "default"} />
            </div>
          ))}
        </div>
      )}

      {/* Winner line: "Gamertag - N points!" */}
      {winners.length === 1 ? (
        <p className="bg-linear-to-b from-sky-200 via-sky-300 to-sky-400/80 bg-clip-text text-center text-2xl font-black uppercase tracking-wider text-transparent drop-shadow-[0_0_12px_rgba(56,189,248,0.35)]">
          {winners[0]!.gamertag} – {winnerPoints} {winnerPoints === 1 ? "point" : "points"}!
        </p>
      ) : (
        <div className="flex flex-col items-center gap-1">
          {winners.map((w) => (
            <p key={w.uid} className="bg-linear-to-b from-sky-200 via-sky-300 to-sky-400/80 bg-clip-text text-center text-2xl font-black uppercase tracking-wider text-transparent drop-shadow-[0_0_12px_rgba(56,189,248,0.35)]">
              {w.gamertag} – {winnerPoints} {winnerPoints === 1 ? "point" : "points"}!
            </p>
          ))}
        </div>
      )}

      {/* Other players — 2-column grid */}
      {others.length > 0 && (
        <>
          <hr className="w-full max-w-sm border-t border-slate-700/50" />
          <div className="grid w-full max-w-sm grid-cols-2 gap-x-4 gap-y-2">
            {others.map((p, i) => {
              const pts = scores[p.uid] ?? 0;
              return (
                <p key={p.uid} className={`truncate text-sm font-bold tracking-wide text-slate-500/70 ${i % 2 === 0 ? "text-left" : "text-right"}`}>
                  {p.gamertag} – {pts}
                </p>
              );
            })}
          </div>
        </>
      )}

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
