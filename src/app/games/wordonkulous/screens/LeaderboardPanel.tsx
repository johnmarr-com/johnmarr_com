"use client";

import { useMemo } from "react";
import { JMAvatarView } from "@/JMKit";
import type { GameSessionPlayer } from "@/lib/game-sessions";
import { GameBgUnderlay } from "@/app/games/_gamecore";

interface LeaderboardPanelProps {
  players: GameSessionPlayer[];
  scores: Record<string, number>;
  backgroundImageURL?: string;
}

export default function LeaderboardPanel({
  players,
  scores,
  backgroundImageURL,
}: LeaderboardPanelProps) {
  const sorted = useMemo(() => {
    return [...players].sort((a, b) => {
      const sa = scores[a.uid] ?? 0;
      const sb = scores[b.uid] ?? 0;
      if (sa !== sb) return sb - sa;
      return a.gamertag.localeCompare(b.gamertag);
    });
  }, [players, scores]);

  return (
    <div className="relative mx-auto flex w-full max-w-sm flex-1 flex-col overflow-hidden rounded-xl">
      <GameBgUnderlay url={backgroundImageURL} className="rounded-xl" />
      <div className="absolute inset-0 rounded-xl bg-black/45" />
      <div className="relative z-10 flex max-h-full min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-4 py-2 sm:px-5">
        {sorted.map((player) => {
          const pts = scores[player.uid] ?? 0;
          return (
            <div
              key={player.uid}
              className="flex items-center gap-2 rounded-lg px-2 py-0.5 sm:px-3"
            >
              <div className="relative ml-[10px] h-[72px] w-[72px] shrink-0">
                <JMAvatarView width={72} avatarName={player.avatarName ?? "default"} />
              </div>
              <span className="min-w-0 flex-1 truncate text-base font-bold text-white/80 sm:text-lg">
                {player.gamertag}
              </span>
              {pts > 0 && (
                <span className="shrink-0 text-xl font-bold tabular-nums text-white sm:text-2xl">
                  {pts}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
