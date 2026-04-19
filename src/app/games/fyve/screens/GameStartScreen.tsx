"use client";

import { useState, useEffect, useCallback } from "react";
import type { FyveHeist, FyveTeam } from "../fyveTypes";
import { GameSectionHeader, GamePrimaryButton } from "@/app/games/_gamecore";
import { FYVE_COLORS } from "../FyveGame";

interface GameStartScreenProps {
  activeTeam?: FyveTeam | null;
  heist?: FyveHeist | null;
  isHost: boolean;
  onReady: (firstTeam: FyveTeam) => void;
}

export default function GameStartScreen({
  activeTeam: _activeTeam,
  heist: _heist,
  isHost,
  onReady,
}: GameStartScreenProps) {
  void _activeTeam; void _heist;
  const [flipping, setFlipping] = useState(true);
  const [result, setResult] = useState<FyveTeam | null>(null);

  // Coin flip animation
  useEffect(() => {
    const team: FyveTeam = Math.random() < 0.5 ? "syndicate1" : "syndicate2";
    const timer = setTimeout(() => {
      setResult(team);
      setFlipping(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleStart = useCallback(() => {
    if (result) onReady(result);
  }, [result, onReady]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="w-full max-w-lg text-center">
        <GameSectionHeader
          eyebrow={_heist?.title ?? "FYVE"}
          title="Coin Flip"
          titleColorClass="text-[#E84C1E]"
          eyebrowColorClass="text-[#E84C1E]/70"
        />

        {/* Coin animation */}
        <div className="mx-auto mt-8 flex h-32 w-32 items-center justify-center">
          {flipping ? (
            <div className="h-24 w-24 rounded-full border-4 border-[#E84C1E] bg-[#0D1B2E] animate-spin" />
          ) : (
            <div
              className="flex h-24 w-24 items-center justify-center rounded-full border-4 text-lg font-black"
              style={{
                borderColor: result === "syndicate1" ? FYVE_COLORS.t1 : FYVE_COLORS.t2,
                color: result === "syndicate1" ? FYVE_COLORS.t1 : FYVE_COLORS.t2,
              }}
            >
              S{result === "syndicate1" ? "1" : "2"}
            </div>
          )}
        </div>

        {!flipping && result && (
          <div className="mt-6">
            <p className="text-lg font-bold" style={{ color: result === "syndicate1" ? FYVE_COLORS.t1 : FYVE_COLORS.t2 }}>
              {result === "syndicate1" ? "Syndicate 1" : "Syndicate 2"} goes first
            </p>

            {isHost && (
              <div className="mt-6">
                <GamePrimaryButton onClick={handleStart}>
                  Start Game
                </GamePrimaryButton>
              </div>
            )}

            {!isHost && (
              <p className="mt-4 text-sm text-white/40 animate-pulse">
                Waiting for host...
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
