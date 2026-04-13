"use client";

import Image from "next/image";
import { JMAvatarView, OneVsAll } from "@/JMKit";
import { Star, X } from "lucide-react";
import type { GameSessionPlayer } from "@/lib/game-sessions";
import type { PlayerStatus } from "../tournament";
import type { MatchupState } from "../useBluffBoxSession";
import { isAiPlayer } from "@/app/games/_gamecore";

interface MatchupScreenProps {
  roundNumber: number;
  bonusRoundCount: number;
  players: GameSessionPlayer[];
  playerStatuses: Record<string, PlayerStatus>;
  matchup: MatchupState | null;
  /** Static game logo above the left player (splash / cover art). */
  gameLogoURL?: string;
  /** Full-bleed background behind the tournament UI (e.g. game splash). */
  backgroundImageURL?: string;
}

export default function MatchupScreen({
  roundNumber,
  bonusRoundCount,
  players,
  playerStatuses,
  matchup,
  gameLogoURL,
  backgroundImageURL,
}: MatchupScreenProps) {
  const isBonus = bonusRoundCount > 0;
  const roundLabel = isBonus ? `BONUS ROUND ${bonusRoundCount}` : `ROUND ${roundNumber}`;

  const sharerPlayer = matchup ? players.find((p) => p.uid === matchup.sharer) : undefined;
  const opponentPlayer = matchup ? players.find((p) => p.uid === matchup.opponent) : undefined;

  const sharerRole: "SHARING" | null = matchup?.sharerChoice == null ? "SHARING" : null;
  const opponentRole: "GUESSING" | null =
    matchup?.sharerChoice != null && matchup?.opponentGuess == null ? "GUESSING" : null;

  const standIn = matchup?.isStandIn ?? false;

  const leftSide = !sharerPlayer
    ? { empty: true as const }
    : {
        name: sharerPlayer.gamertag,
        ...(sharerPlayer.avatarName != null ? { avatarName: sharerPlayer.avatarName } : {}),
        roleLabel: sharerRole,
        roleTone: "amber" as const,
      };

  const rightSide = !opponentPlayer
    ? { empty: true as const }
    : {
        name: opponentPlayer.gamertag,
        ...(opponentPlayer.avatarName != null ? { avatarName: opponentPlayer.avatarName } : {}),
        roleLabel: opponentRole,
        roleTone: "blue" as const,
        ...(standIn ? { secondaryBadge: "Stand-in" as const } : {}),
      };

  const leftHeader =
    gameLogoURL != null && gameLogoURL.length > 0 ? (
      <Image
        src={gameLogoURL}
        alt=""
        width={280}
        height={140}
        className="h-14 w-auto max-w-[min(220px,52vw)] object-contain object-bottom-left opacity-95 select-none sm:h-16"
        priority={false}
      />
    ) : null;

  const rightHeader = (
    <span className="block max-w-[min(100%,52vw)] bg-linear-to-r from-amber-200/90 via-white to-blue-200/90 bg-clip-text text-right text-sm font-black uppercase leading-snug tracking-[0.22em] text-transparent sm:text-base">
      {roundLabel}
    </span>
  );

  return (
    <OneVsAll
      leftHeader={leftHeader}
      rightHeader={rightHeader}
      left={leftSide}
      right={rightSide}
      {...(backgroundImageURL != null && backgroundImageURL.length > 0
        ? { backgroundImageURL }
        : {})}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-xl bg-black/45 p-3 sm:p-4"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 md:grid-cols-4 lg:grid-cols-5">
            {players.map((player) => {
              const status = playerStatuses[player.uid] ?? "alive";
              const isEliminated = status === "eliminated";
              /** Finished this round’s matchup (survived) or eliminated — dimmed in the grid. */
              const hasPlayedRound = status === "played" || isEliminated;
              const isCompeting = matchup && (matchup.sharer === player.uid || matchup.opponent === player.uid);

              return (
                <div
                  key={player.uid}
                  className="relative flex flex-col items-center gap-2 rounded-xl px-2 py-3"
                >
                  <div className="flex w-full justify-center">
                    <div className="relative h-24 w-24 shrink-0">
                      {isCompeting && (
                        <Star
                          className="pointer-events-none absolute right-full top-1/2 z-1 mr-[10px] h-4 w-4 -translate-y-1/2 text-amber-400 fill-amber-400"
                          strokeWidth={1.25}
                          aria-hidden
                        />
                      )}
                      <div
                        className={`h-24 w-24 shrink-0 ${
                          hasPlayedRound ? "opacity-[0.28] grayscale" : ""
                        }`}
                      >
                        <JMAvatarView width={96} avatarName={player.avatarName ?? "default"} />
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
      </div>
    </OneVsAll>
  );
}
