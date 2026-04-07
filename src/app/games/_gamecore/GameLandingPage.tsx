"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { JMAppHeader } from "@/JMKit";
import { bgMusic } from "@/lib/BackgroundMusicPlayer";
import { PointsManager, Activity } from "@/lib/points";

export type GameMode = "solo" | "ai" | "friends";

export interface GameLandingPageProps {
  splashBgURL?: string;
  splashIconURL?: string;
  splashLogoURL?: string;
  gameSlug?: string;
  backgroundMusicURL?: string;
  backgroundMusicVolume?: number;
  enabledModes?: GameMode[];
  onPlay: (mode: GameMode) => void;
}

const MODE_LABELS: Record<GameMode, string> = {
  solo: "Play Solo",
  ai: "Play vs AI",
  friends: "Play with Friends",
};

export function GameLandingPage({
  splashBgURL,
  splashIconURL,
  splashLogoURL,
  gameSlug,
  backgroundMusicURL,
  backgroundMusicVolume = 0.3,
  enabledModes = ["solo"],
  onPlay,
}: GameLandingPageProps) {
  const [pressed, setPressed] = useState<GameMode | null>(null);

  useEffect(() => {
    const url = backgroundMusicURL || (gameSlug ? `/music/${gameSlug}.mp3` : null);
    if (url) bgMusic.play(url, backgroundMusicVolume);
  }, [backgroundMusicURL, backgroundMusicVolume, gameSlug]);

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

        {/* Splash Icon — 1:1 aspect, 25px margin all around */}
        {splashIconURL && (
          <div className="w-full" style={{ padding: 25 }}>
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
