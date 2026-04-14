"use client";

import { JMAvatarView } from "@/JMKit";
import { Star, X } from "lucide-react";
import type { GameSessionPlayer } from "@/lib/game-sessions";
import { isAiPlayer } from "@/app/games/_gamecore";

interface PlayerGridProps {
  players: GameSessionPlayer[];
  /** Per-UID status: "alive" | "played" | "eliminated". */
  playerStatuses: Record<string, string>;
  /** UIDs of players currently competing (highlighted with a star). */
  competingUids?: string[];
}

/**
 * Responsive grid of player avatars with status indicators.
 * Extracted from the original MatchupScreen for reuse.
 */
export default function PlayerGrid({
  players,
  playerStatuses,
  competingUids = [],
}: PlayerGridProps) {
  return (
    <div
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-xl bg-black/45 p-3 sm:p-4"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 md:grid-cols-4 lg:grid-cols-5">
        {players.map((player) => {
          const status = playerStatuses[player.uid] ?? "alive";
          const isEliminated = status === "eliminated";
          const hasPlayedRound = status === "played" || isEliminated;
          const isCompeting = competingUids.includes(player.uid);

          return (
            <div
              key={player.uid}
              className="relative flex flex-col items-center gap-2 rounded-xl px-2 py-3"
            >
              <div className="flex w-full justify-center">
                <div className="relative h-24 w-24 shrink-0">
                  {isCompeting && (
                    <Star
                      className="pointer-events-none absolute right-full top-1/2 z-1 mr-[10px] h-4 w-4 -translate-y-1/2 fill-amber-400 text-amber-400"
                      strokeWidth={1.25}
                      aria-hidden
                    />
                  )}
                  <div
                    className={`h-24 w-24 shrink-0 ${
                      hasPlayedRound ? "opacity-[0.28] grayscale" : ""
                    }`}
                  >
                    <JMAvatarView
                      width={96}
                      avatarName={player.avatarName ?? "default"}
                    />
                  </div>
                  {isEliminated && (
                    <div
                      className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
                      aria-hidden
                    >
                      <X
                        className="h-10 w-10 text-red-500 drop-shadow-md"
                        strokeWidth={2.5}
                      />
                    </div>
                  )}
                </div>
              </div>
              <p
                className={`max-w-full truncate text-center text-xl font-bold leading-tight ${
                  hasPlayedRound ? "text-white/30" : "text-white/70"
                }`}
              >
                {player.gamertag}
              </p>
              {isAiPlayer(player.uid) && (
                <span className="text-sm text-red-400/50">AI</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
