"use client";

import Image from "next/image";
import { OneVsAll } from "@/JMKit";
import type { GameSessionPlayer } from "@/lib/game-sessions";
import LeaderboardPanel from "./LeaderboardPanel";

interface MatchupScreenProps {
  roundNumber: number;
  totalRounds: number;
  players: GameSessionPlayer[];
  scores: Record<string, number>;
  /** UID of the current sharer (used to build the solo panel). */
  currentSharer: string;
  /** Used by the leaderboard for star vs “already shared” checkmarks. */
  turnOrder: string[];
  currentTurnIndex: number;
  /** Static game logo (top left). */
  gameLogoURL?: string;
  /** Full-bleed background behind the UI (e.g. game splash). */
  backgroundImageURL?: string;
}

export default function MatchupScreen({
  roundNumber,
  totalRounds,
  players,
  scores,
  currentSharer,
  turnOrder,
  currentTurnIndex,
  gameLogoURL,
  backgroundImageURL,
}: MatchupScreenProps) {
  const roundLabel = `ROUND ${roundNumber} of ${totalRounds}`;

  const sharerPlayer = players.find((p) => p.uid === currentSharer);

  const sharerSide = !sharerPlayer
    ? { empty: true as const }
    : {
        name: sharerPlayer.gamertag,
        ...(sharerPlayer.avatarName != null ? { avatarName: sharerPlayer.avatarName } : {}),
        roleLabel: "SHARING" as const,
        roleTone: "amber" as const,
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
      sharer={sharerSide}
      {...(backgroundImageURL != null && backgroundImageURL.length > 0
        ? { backgroundImageURL }
        : {})}
    >
      <LeaderboardPanel
        players={players}
        scores={scores}
        currentSharer={currentSharer}
        turnOrder={turnOrder}
        currentTurnIndex={currentTurnIndex}
        {...(backgroundImageURL != null && backgroundImageURL.length > 0
          ? { backgroundImageURL }
          : {})}
      />
    </OneVsAll>
  );
}
