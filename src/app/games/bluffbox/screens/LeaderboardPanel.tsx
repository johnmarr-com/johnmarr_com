"use client";

import { useMemo } from "react";
import { Check, Star } from "lucide-react";
import { JMAvatarView } from "@/JMKit";
import type { GameSessionPlayer } from "@/lib/game-sessions";
import { GameBgUnderlay } from "@/app/games/_gamecore";

interface LeaderboardPanelProps {
  players: GameSessionPlayer[];
  scores: Record<string, number>;
  /** Game splash behind the panel scrim (30% under the dark layer). */
  backgroundImageURL?: string;
  /** Current sharer — gold star to the left of their list avatar (does not shift layout). */
  currentSharer?: string;
  /** Turn order this round; with `currentTurnIndex` marks who has already shared. */
  turnOrder?: string[];
  currentTurnIndex?: number;
}

/**
 * Sorted player list: points descending, then alphabetical within the same score.
 * Zero-point players go to the bottom, alphabetised among themselves.
 */
export default function LeaderboardPanel({
  players,
  scores,
  currentSharer,
  turnOrder = [],
  currentTurnIndex = 0,
  backgroundImageURL,
}: LeaderboardPanelProps) {
  const sorted = useMemo(() => {
    return [...players].sort((a, b) => {
      const sa = scores[a.uid] ?? 0;
      const sb = scores[b.uid] ?? 0;
      if (sa !== sb) return sb - sa; // higher score first
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
        const turnIdx = turnOrder.indexOf(player.uid);
        const isCurrentSharer =
          currentSharer != null &&
          currentSharer.length > 0 &&
          player.uid === currentSharer;
        const hasSharedAlreadyThisRound =
          turnIdx !== -1 && turnIdx < currentTurnIndex;

        return (
          <div
            key={player.uid}
            className="flex items-center gap-2 rounded-lg px-2 py-0.5 sm:px-3"
          >
            {/* Avatar — star = sharing now; gray check = already went this round (same slot, no layout shift) */}
            <div className="relative ml-[10px] h-[72px] w-[72px] shrink-0">
              {isCurrentSharer ? (
                <Star
                  className="pointer-events-none absolute right-full top-1/2 z-10 mr-2 h-4 w-4 -translate-y-1/2 translate-x-[5px] text-amber-400 fill-amber-400 sm:h-5 sm:w-5"
                  strokeWidth={1.25}
                  aria-hidden
                />
              ) : (
                hasSharedAlreadyThisRound && (
                  <Check
                    className="pointer-events-none absolute right-full top-1/2 z-10 mr-2 h-4 w-4 -translate-y-1/2 translate-x-[5px] text-white/40 sm:h-5 sm:w-5"
                    strokeWidth={2.5}
                    aria-hidden
                  />
                )
              )}
              <JMAvatarView width={72} avatarName={player.avatarName ?? "default"} />
            </div>

            {/* Gamertag */}
            <span className="min-w-0 flex-1 truncate text-base font-bold text-white/80 sm:text-lg">
              {player.gamertag}
            </span>

            {/* Points — hidden when 0 */}
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
