"use client";

import { Menu } from "lucide-react";
import type { GameSession } from "@/lib/game-sessions";
import type { JMContent } from "@/lib/content-types";
import {
  GameBgUnderlay,
  getTeamLogoUrl,
  useGameColors,
  type TeamName,
} from "@/app/games/_gamecore";
import {
  JMGameLogo,
  JMTextCard,
  JMPlayerLeaderboard,
  JMTeamLeaderboard,
  type JMTeamLeaderboardEntry,
} from "@/JMKit";
import type { FctMode, FctTeam } from "../fastCasualTriviaTypes";

interface GameBoardScreenProps {
  session: GameSession;
  gameData: JMContent;
  isHost: boolean;
  mode: FctMode;
  teams: FctTeam[];
  scores: Record<string, number>;
  onMenuTap: () => void;
}

/**
 * Phase 1 game board shell. Layout:
 *   - Logo top-right (animated entrance)
 *   - Menu top-left (host only)
 *   - JMTextCard center with placeholder text
 *   - Leaderboard below — JMPlayerLeaderboard or JMTeamLeaderboard by mode
 *
 * Phase 2 will populate the card with trivia questions and add answer UI.
 */
export function GameBoardScreen({
  session,
  gameData,
  isHost,
  mode,
  teams,
  scores,
  onMenuTap,
}: GameBoardScreenProps) {
  const colors = useGameColors();
  const bgURL = gameData.splashBgURL;
  const bgDim = gameData.splashBgDim ?? 50;
  const logoURL = gameData.splashLogoURL ?? gameData.coverURL;
  const gameName = gameData.name;

  const isTeamMode = mode === "full_team" || mode === "team_leads";

  return (
    <div className="fixed inset-0 z-10 overflow-hidden bg-black">
      <GameBgUnderlay url={bgURL} />
      <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${bgDim / 100})` }} />

      <div className="relative z-10 flex h-full w-full flex-col">
        {/* Top bar */}
        <header className="flex shrink-0 items-start justify-between p-4">
          {/* Menu — host only */}
          <div className="w-10">
            {isHost ? (
              <button
                onClick={onMenuTap}
                aria-label="Open game controls"
                className="flex h-10 w-10 items-center justify-center rounded-full transition-colors"
                style={{
                  backgroundColor: "rgba(255,255,255,0.10)",
                  color: "#fff",
                  border: "1px solid rgba(255,255,255,0.20)",
                }}
              >
                <Menu size={20} />
              </button>
            ) : null}
          </div>

          {/* Game logo — animated entrance + continuous rock */}
          {logoURL ? (
            <JMGameLogo
              src={logoURL}
              alt={gameName ?? "Game logo"}
              reanimateKey={gameData.slug ?? gameData.id}
              sizeClass="h-20 w-auto sm:h-24"
            />
          ) : (
            <div
              className="flex h-20 w-20 items-center justify-center rounded-xl text-sm font-bold sm:h-24 sm:w-24"
              style={{ backgroundColor: colors.primary, color: "#000" }}
            >
              {(gameName ?? "?").slice(0, 3).toUpperCase()}
            </div>
          )}
        </header>

        {/* Trivia card */}
        <div className="flex shrink-0 px-5 pt-2">
          <div className="mx-auto w-full max-w-md">
            <JMTextCard text="Waiting for the first question…" fontSize="md" darkShadow />
          </div>
        </div>

        {/* Leaderboard */}
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-5">
          <h2
            className="mb-2 text-center text-xs font-bold uppercase tracking-widest text-white/70"
          >
            {isTeamMode ? "Teams" : "Players"}
          </h2>
          {isTeamMode ? (
            <JMTeamLeaderboard
              teams={teamsToEntries(teams, colors.primary)}
              scores={scores}
              {...(bgURL ? { backgroundImageURL: bgURL } : {})}
            />
          ) : (
            <JMPlayerLeaderboard
              players={session.players}
              scores={scores}
              {...(bgURL ? { backgroundImageURL: bgURL } : {})}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function teamsToEntries(teams: FctTeam[], fallbackColor: string): JMTeamLeaderboardEntry[] {
  return teams.map((t) => {
    const color = t.colorHex || fallbackColor;
    const logoUrl = t.logoId ? getTeamLogoUrl(t.logoId as TeamName) : null;
    return {
      id: t.id,
      name: t.name,
      color,
      logo: (
        <div
          className="relative h-full w-full overflow-hidden rounded-full"
          style={{ backgroundColor: `${color}20` }}
        >
          {logoUrl && (
            <>
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${logoUrl})` }}
              />
              <div
                className="absolute inset-0"
                style={{ backgroundColor: color, mixBlendMode: "color" }}
              />
            </>
          )}
        </div>
      ),
    };
  });
}
