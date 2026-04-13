"use client";

import Image from "next/image";
import { JMAvatarView, JMTournamentVs } from "@/JMKit";
import { CheckCircle } from "lucide-react";
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
}

export default function MatchupScreen({
  roundNumber,
  bonusRoundCount,
  players,
  playerStatuses,
  matchup,
  gameLogoURL,
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
        roleLabel: standIn ? null : sharerRole,
        roleTone: "amber" as const,
        ...(standIn ? { secondaryBadge: "Stand-in" as const } : {}),
      };

  const rightSide = !opponentPlayer
    ? { empty: true as const }
    : {
        name: opponentPlayer.gamertag,
        ...(opponentPlayer.avatarName != null ? { avatarName: opponentPlayer.avatarName } : {}),
        roleLabel: opponentRole,
        roleTone: "blue" as const,
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
    <JMTournamentVs leftHeader={leftHeader} rightHeader={rightHeader} left={leftSide} right={rightSide}>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain rounded-xl bg-white/5 p-3 sm:p-4"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 md:grid-cols-4 lg:grid-cols-5">
            {players.map((player) => {
              const status = playerStatuses[player.uid] ?? "alive";
              const isEliminated = status === "eliminated";
              const hasPlayed = status === "played";
              const isCompeting = matchup && (matchup.sharer === player.uid || matchup.opponent === player.uid);

              return (
                <div
                  key={player.uid}
                  className={`relative flex flex-col items-center gap-2 rounded-xl px-2 py-3 ${
                    isCompeting ? "bg-white/[0.07] ring-1 ring-white/10" : ""
                  } ${isEliminated ? "opacity-30" : ""}`}
                >
                  <div className={`h-24 w-24 shrink-0 ${isEliminated ? "grayscale" : ""}`}>
                    <JMAvatarView width={96} avatarName={player.avatarName ?? "default"} />
                  </div>
                  <p className="max-w-full truncate text-center text-xl font-bold leading-tight text-white/70">
                    {player.gamertag}
                  </p>
                  {isAiPlayer(player.uid) && (
                    <span className="text-sm text-red-400/50">AI</span>
                  )}
                  {hasPlayed && !isCompeting && (
                    <CheckCircle className="absolute right-1 top-1 h-8 w-8 text-blue-400" />
                  )}
                  {isCompeting && (
                    <span className="text-base font-bold uppercase text-amber-300">Competing</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </JMTournamentVs>
  );
}
