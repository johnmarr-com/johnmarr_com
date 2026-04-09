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
  onPlay,
  onMultiplayerStart,
}: GameLandingPageProps) {
  const [pressed, setPressed] = useState<GameMode | null>(null);
  const [mpOpen, setMpOpen] = useState(false);

  const musicURL = backgroundMusicURL || (gameSlug ? `/music/${gameSlug}.mp3` : null);
  const { ensurePlaying } = useGameMusic({ url: musicURL, volume: backgroundMusicVolume });

  const allModes: GameMode[] = ["ai", "friends"];

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
        {/* Splash Logo — 2:1 aspect, gentle float animation */}
        {splashLogoURL && (
          <div className="w-full animate-game-float">
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
            <div className="relative w-full" style={{ aspectRatio: "4 / 3" }}>
              <Image
                src={splashIconURL}
                alt=""
                fill
                sizes="(max-width: 640px) 70vw, 400px"
                className="rounded-[12%] object-cover"
                priority
              />
            </div>
          </div>
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
        </div>
      </div>
      </div>

      {/* Multiplayer dialog */}
      {multiplayerInput && (
        <GameMultiplayerFlow
          open={mpOpen}
          onOpenChange={setMpOpen}
          gameInput={multiplayerInput}
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
