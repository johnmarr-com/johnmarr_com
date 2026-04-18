"use client";

import { useState, useEffect } from "react";
import { bgMusic } from "@/app/games/_gamecore";
import { JMConfettiOverlay } from "@/JMKit";

interface VictoryOverlayProps {
  winningTeamName: string;
  winningTeamColor: string;
  winningTeamLogoUrl: string;
  targetImageUrl: string;
  heistTitle: string;
  t1Score: number;
  t2Score: number;
  t1Name: string;
  t2Name: string;
  t1Color: string;
  t2Color: string;
  isHost: boolean;
  musicUrl?: string | null | undefined;
  onPlayAgain?: () => void;
}

const CARD_SIZE = 260;

export default function VictoryOverlay({
  winningTeamName,
  winningTeamColor,
  winningTeamLogoUrl,
  targetImageUrl,
  heistTitle,
  t1Score,
  t2Score,
  t1Name,
  t2Name,
  t1Color,
  t2Color,
  isHost,
  musicUrl,
  onPlayAgain,
}: VictoryOverlayProps) {
  const [show, setShow] = useState(false);

  // Fade in on mount
  useEffect(() => {
    const t = requestAnimationFrame(() => {
      requestAnimationFrame(() => setShow(true));
    });
    return () => cancelAnimationFrame(t);
  }, []);

  // Play soundtrack on mount
  useEffect(() => {
    if (musicUrl) {
      bgMusic.play(musicUrl, 0.3);
    } else {
      bgMusic.playSfx("/music/Sound-Success.mp3");
    }
  }, [musicUrl]);

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col items-center justify-center overflow-y-auto"
      style={{
        backgroundColor: winningTeamColor,
        opacity: show ? 1 : 0,
        transition: "opacity 600ms ease-out",
      }}
    >
      {/* Blurred darker backdrop */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      />

      {show && <JMConfettiOverlay />}

      <div className="relative z-10 flex flex-col items-center px-4 py-12">
        {/* Winning team logo */}
        <div
          className="relative h-[120px] w-[120px] shrink-0 overflow-hidden rounded-full"
          style={{
            backgroundColor: `${winningTeamColor}30`,
            opacity: show ? 1 : 0,
            transform: show ? "scale(1)" : "scale(0.7)",
            transition: "opacity 600ms ease-out 200ms, transform 600ms ease-out 200ms",
          }}
        >
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${winningTeamLogoUrl})` }}
          />
          <div
            className="absolute inset-0"
            style={{ backgroundColor: winningTeamColor, mixBlendMode: "color" }}
          />
        </div>

        {/* Target image */}
        <div
          className="mt-6 overflow-hidden rounded-2xl"
          style={{
            width: CARD_SIZE,
            height: CARD_SIZE,
            border: `6px solid ${winningTeamColor}`,
            opacity: show ? 1 : 0,
            transform: show ? "scale(1)" : "scale(0.9)",
            transition: "opacity 600ms ease-out 300ms, transform 600ms ease-out 300ms",
          }}
        >
          {targetImageUrl ? (
            <div
              className="h-full w-full bg-cover bg-center"
              style={{ backgroundImage: `url(${targetImageUrl})` }}
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center"
              style={{ backgroundColor: `${winningTeamColor}20` }}
            >
              <span className="text-6xl">🏆</span>
            </div>
          )}
        </div>

        {/* Heist title */}
        <p
          className="mt-4 text-xs font-bold uppercase tracking-wider text-white/60"
          style={{
            opacity: show ? 1 : 0,
            transition: "opacity 600ms ease-out 400ms",
          }}
        >
          {heistTitle}
        </p>

        {/* Team name wins */}
        <p
          className="mt-2 text-4xl font-black"
          style={{
            color: winningTeamColor,
            opacity: show ? 1 : 0,
            transform: show ? "translateY(0)" : "translateY(20px)",
            transition: "opacity 600ms ease-out 500ms, transform 600ms ease-out 500ms",
          }}
        >
          {winningTeamName} Wins!
        </p>

        {/* Scores */}
        <div
          className="mt-6 flex gap-6"
          style={{
            opacity: show ? 1 : 0,
            transition: "opacity 600ms ease-out 600ms",
          }}
        >
          <div className="text-center">
            <p className="text-3xl font-black" style={{ color: t1Color }}>{t1Score}/7</p>
            <p className="text-xs text-white/40">{t1Name}</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-black" style={{ color: t2Color }}>{t2Score}/7</p>
            <p className="text-xs text-white/40">{t2Name}</p>
          </div>
        </div>

        {/* Play Again — host only */}
        {isHost && onPlayAgain && (
          <button
            type="button"
            className="mt-8 rounded-xl px-8 py-3 text-sm font-bold text-white"
            style={{
              backgroundColor: winningTeamColor,
              opacity: show ? 1 : 0,
              transition: "opacity 600ms ease-out 700ms",
            }}
            onClick={onPlayAgain}
          >
            Play Again
          </button>
        )}
      </div>
    </div>
  );
}
