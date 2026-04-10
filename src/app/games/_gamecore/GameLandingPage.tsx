"use client";

import { useState } from "react";
import Image from "next/image";
import { JMAppHeader } from "@/JMKit";
import { PointsManager, Activity } from "@/lib/points";
import type { CreateSessionInput } from "@/lib/game-sessions";
import { GameMultiplayerFlow } from "./GameMultiplayerFlow";
import { useGameMusic } from "./useGameMusic";

export type GameMode = "solo" | "ai" | "friends";

export interface GameLandingPageProps {
  splashBgURL?: string;
  splashIconURL?: string;
  splashLogoURL?: string;
  gameSlug?: string;
  backgroundMusicURL?: string;
  backgroundMusicVolume?: number;
  enabledModes?: GameMode[];
  /** Reduce gap between logo and icon (default 25px padding around icon) */
  iconPadding?: number;
  /** Pulse the splash icon in scale */
  pulseIcon?: boolean;
  /** Game content info needed for multiplayer session creation */
  multiplayerInput?: CreateSessionInput;
  /** Side labels for multiplayer (e.g. ["red","white"] or ["p1","p2"]). Only used in versus mode. */
  sideLabels?: [string, string];
  /** "versus" = 2-player with sides (default). "party" = N-player, no sides. */
  multiplayerFlowMode?: "versus" | "party";
  /** Minimum players to enable start in multiplayer. */
  multiplayerMinPlayers?: number;
  /** If true, stop background music when leaving the landing page (game starts). */
  bgMusicLandingOnly?: boolean;
  /** Extra content injected into the host lobby (above Start button). */
  lobbyExtra?: React.ReactNode;
  /** Extra content rendered below the mode buttons on the landing page itself. */
  landingExtra?: React.ReactNode;
  /** Game subtitle displayed beneath the icon and above the mode buttons. */
  subtitle?: string | undefined;
  /** Min players for this game. When > 1, AI/solo buttons are hidden entirely. */
  minPlayers?: number;
  /** Max players for this game. Used in the "For X to Y players" label. */
  maxPlayers?: number;
  onPlay: (mode: GameMode) => void;
  onMultiplayerStart?: (sessionId: string) => void;
}

const MODE_LABELS: Record<GameMode, React.ReactNode> = {
  solo: "Play Solo",
  ai: <>Play vs <span className="font-black text-xl text-red-500">AI</span></>,
  friends: <>Play with <span className="font-black text-xl" style={{ color: "#888888" }}>Friends</span></>,
};

export function GameLandingPage({
  splashBgURL,
  splashIconURL,
  splashLogoURL,
  gameSlug,
  backgroundMusicURL,
  backgroundMusicVolume = 0.3,
  enabledModes = ["solo"],
  iconPadding = 25,
  pulseIcon = false,
  multiplayerInput,
  sideLabels,
  multiplayerFlowMode,
  multiplayerMinPlayers,
  bgMusicLandingOnly = false,
  lobbyExtra,
  landingExtra,
  subtitle,
  minPlayers = 1,
  maxPlayers,
  onPlay,
  onMultiplayerStart,
}: GameLandingPageProps) {
  const [pressed, setPressed] = useState<GameMode | null>(null);
  const [mpOpen, setMpOpen] = useState(false);

  const musicURL = backgroundMusicURL || (gameSlug ? `/music/${gameSlug}.mp3` : null);
  const { ensurePlaying } = useGameMusic({
    url: musicURL,
    volume: backgroundMusicVolume,
    stopOnUnmount: bgMusicLandingOnly,
  });

  const allModes: GameMode[] = minPlayers > 1
    ? ["friends"]
    : ["ai", "friends"];

  return (
    <div className="fixed inset-0 flex flex-col bg-black">
      <div className="relative z-20"><JMAppHeader /></div>
      {/* Background — aspect-fill cover */}
      {splashBgURL && (
        <Image
          src={splashBgURL}
          alt=""
          fill
          sizes="100vw"
          priority
          className="object-cover"
          style={{ zIndex: 0 }}
        />
      )}
      {/* Dim overlay for legibility */}
      <div className="absolute inset-0 z-1 bg-black/40" />

      {/* Title div — centered, max 600px, 50px side padding */}
      <div
        className="relative z-10 flex flex-1 items-center justify-center overflow-y-auto"
      >
      <div
        className="flex w-full flex-col items-center"
        style={{ maxWidth: 600, padding: "0 50px" }}
      >
        {/* Splash Logo — 2:1 aspect, gentle float animation, pulled closer to icon */}
        {splashLogoURL && (
          <div className="w-full animate-game-float -mb-6">
            <div className="relative w-full" style={{ aspectRatio: "2 / 1" }}>
              <Image
                src={splashLogoURL}
                alt=""
                fill
                sizes="(max-width: 640px) 80vw, 500px"
                className="object-contain"
                priority
              />
            </div>
          </div>
        )}

        {/* Splash Icon */}
        {splashIconURL && (
          <div
            className={pulseIcon ? "w-full animate-icon-pulse" : "w-full"}
            style={{ padding: iconPadding }}
          >
            <div className="relative w-full overflow-hidden rounded-[12%]" style={{ aspectRatio: "4 / 3" }}>
              <Image
                src={splashIconURL}
                alt=""
                fill
                sizes="(max-width: 640px) 70vw, 400px"
                className="object-cover"
                priority
              />
            </div>
          </div>
        )}

        {/* Subtitle — supports <br> and \n for line breaks */}
        {subtitle && (
          <p className="mb-5 text-center text-lg font-bold tracking-wide text-white/70">
            {subtitle.split(/<br\s*\/?>|\\n|\n/).map((line, i, arr) => (
              <span key={i}>
                {line}
                {i < arr.length - 1 && <br />}
              </span>
            ))}
          </p>
        )}

        {/* Mode buttons */}
        <div className="mt-2 flex w-full flex-col gap-3" style={{ padding: "0 25px" }}>
          {allModes.map((mode) => {
            const enabled = enabledModes.includes(mode);
            return (
              <button
                key={mode}
                disabled={!enabled}
                onClick={() => {
                  ensurePlaying();
                  if (mode === "friends" && multiplayerInput) {
                    setMpOpen(true);
                    return;
                  }
                  setPressed(mode);
                  PointsManager.award(Activity.PLAY_GAME);
                  onPlay(mode);
                }}
                className={`
                  w-full rounded-xl py-4 text-lg font-bold uppercase tracking-wider
                  transition-all duration-150
                  ${
                    enabled
                      ? "bg-white text-black shadow-lg shadow-white/20 hover:scale-[1.03] active:scale-95"
                      : "cursor-not-allowed bg-white/10 text-white/25"
                  }
                `}
                style={
                  pressed === mode
                    ? { opacity: 0.7, transform: "scale(0.97)" }
                    : undefined
                }
              >
                {MODE_LABELS[mode]}
              </button>
            );
          })}
          {maxPlayers != null && (
            <p className="mt-1 text-center text-sm font-medium tracking-wide text-white/50">
              For {minPlayers} to {maxPlayers} players
            </p>
          )}
        </div>
      </div>
      </div>

      {/* Landing extras (e.g. Create Missions) — top-right corner */}
      {landingExtra && (
        <div className="absolute right-4 top-28 z-15">
          {landingExtra}
        </div>
      )}

      {/* Multiplayer dialog */}
      {multiplayerInput && (
        <GameMultiplayerFlow
          open={mpOpen}
          onOpenChange={setMpOpen}
          gameInput={multiplayerInput}
          {...(sideLabels ? { sideLabels } : {})}
          {...(multiplayerFlowMode ? { flowMode: multiplayerFlowMode } : {})}
          {...(multiplayerMinPlayers != null ? { minPlayers: multiplayerMinPlayers } : {})}
          lobbyExtra={lobbyExtra}
          onGameStart={(sessionId) => {
            setMpOpen(false);
            PointsManager.award(Activity.PLAY_GAME);
            onMultiplayerStart?.(sessionId);
          }}
        />
      )}

      {/* Float animation keyframes */}
      <style jsx global>{`
        @keyframes game-float {
          0%, 100% { transform: translateY(8px); }
          50% { transform: translateY(-8px); }
        }
        .animate-game-float {
          animation: game-float 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
