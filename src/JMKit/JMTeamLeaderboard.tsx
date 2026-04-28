"use client";

import { useMemo, type ReactNode } from "react";
import { GameBgUnderlay } from "@/app/games/_gamecore";

export interface JMTeamLeaderboardEntry {
  /** Team id. Used as React key + score lookup. */
  id: string;
  /** Display name (e.g., "Team Red"). */
  name: string;
  /** Logo node — already colorized and sized by the caller. */
  logo: ReactNode;
  /** Optional accent color for left border / subtle tint. */
  color?: string;
}

export interface JMTeamLeaderboardProps {
  teams: JMTeamLeaderboardEntry[];
  scores: Record<string, number>;
  /** Game splash behind the panel scrim (30% under the dark layer). */
  backgroundImageURL?: string;
}

/**
 * Team-mode counterpart to JMPlayerLeaderboard. Sorted points-desc with
 * alphabetical fallback. Caller supplies the team logo as a pre-colorized
 * ReactNode so the leaderboard stays decoupled from logo storage.
 */
export function JMTeamLeaderboard({
  teams,
  scores,
  backgroundImageURL,
}: JMTeamLeaderboardProps) {
  const sorted = useMemo(() => {
    return [...teams].sort((a, b) => {
      const sa = scores[a.id] ?? 0;
      const sb = scores[b.id] ?? 0;
      if (sa !== sb) return sb - sa;
      return a.name.localeCompare(b.name);
    });
  }, [teams, scores]);

  return (
    <div className="relative mx-auto flex w-full max-w-sm flex-1 flex-col overflow-hidden rounded-xl">
      <GameBgUnderlay url={backgroundImageURL} className="rounded-xl" />
      <div className="absolute inset-0 rounded-xl bg-black/45" />
      <div className="relative z-10 flex max-h-full min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain p-4">
        {sorted.map((team) => {
          const pts = scores[team.id] ?? 0;
          return (
            <div
              key={team.id}
              className="flex items-center gap-3 rounded-lg"
            >
              <div className="relative h-[72px] w-[72px] shrink-0 flex items-center justify-center">
                {team.logo}
              </div>
              <span className="min-w-0 flex-1 truncate text-base font-bold text-white/80 sm:text-lg">
                {team.name}
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
