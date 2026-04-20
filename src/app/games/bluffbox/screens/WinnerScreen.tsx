"use client";

import Link from "next/link";
import { JMAvatarView, JMSimpleButton } from "@/JMKit";
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
    <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-5 overflow-hidden px-6 py-8">
      {/* Exit button — top left */}
      <Link href="/" className="absolute top-4 left-4 z-20" onClick={(e) => e.stopPropagation()}>
        <JMSimpleButton
          title="EXIT"
          size="sm"
          variant="ghost"
          titleColor="#ffffff"
          className="gap-1.5 opacity-70"
        >
          <span className="text-xs leading-none">&#9664;</span> EXIT
        </JMSimpleButton>
      </Link>

      {/* Winner banner — luminance mask makes black pixels transparent */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/games/bluffbox/Winner.jpg"
        alt="Winner"
        className="h-[200px] w-[400px] max-w-[90vw] object-contain"
        style={{
          WebkitMaskImage: "url(/images/games/bluffbox/Winner.jpg)",
          WebkitMaskSize: "contain",
          WebkitMaskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
          maskImage: "url(/images/games/bluffbox/Winner.jpg)",
          maskMode: "luminance",
          maskSize: "contain",
          maskRepeat: "no-repeat",
          maskPosition: "center",
        }}
      />

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

      {/* Winner name(s) + points */}
      <div className="flex flex-col items-center gap-1">
        {winners.map((w) => (
          <p key={w.uid} className="bb-accent-text text-center text-2xl font-black uppercase tracking-wider drop-shadow-[0_0_12px_rgba(56,189,248,0.35)]">
            {w.gamertag}
          </p>
        ))}
        <p className="bb-accent-text text-center text-xl font-black uppercase tracking-wider drop-shadow-[0_0_12px_rgba(56,189,248,0.35)]">
          {winnerPoints} {winnerPoints === 1 ? "point" : "points"}!
        </p>
      </div>

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
          className="mt-4 w-full max-w-xs rounded-xl bg-linear-to-br from-sky-200 via-sky-400 to-teal-600 py-4 text-lg font-black uppercase tracking-wider text-neutral-950 shadow-lg shadow-sky-400/20 transition-all hover:scale-[1.02] active:scale-95"
        >
          Play Again
        </button>
      )}
    </div>
  );
}
