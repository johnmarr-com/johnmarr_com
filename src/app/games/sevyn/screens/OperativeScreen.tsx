"use client";

import { useState, useCallback } from "react";
import type { SevynBoardCard, SevynTeam, SevynClue, SevynPendingTap, SevynHeist } from "../sevynTypes";
import { useAuth } from "@/lib/AuthProvider";
import SevynGrid from "./SevynGrid";

interface OperativeScreenProps {
  board: SevynBoardCard[];
  activeTeam: SevynTeam;
  myTeam: SevynTeam;
  activeTeamName: string;
  currentClue: SevynClue | null;
  guessesRemaining: number;
  canTap: boolean;
  pendingTap?: SevynPendingTap | null;
  guessesUsedThisTurn?: number;
  onTapCard?: (cardIndex: number, gamertag: string) => void;
  onPassTurn?: () => void;
  heist?: SevynHeist | null;
  waitingForClue?: boolean;
}

export default function OperativeScreen({
  board,
  activeTeam,
  myTeam,
  activeTeamName,
  currentClue,
  guessesRemaining: _guessesRemaining,
  canTap,
  pendingTap,
  guessesUsedThisTurn,
  onTapCard,
  onPassTurn,
  heist: _heist,
  waitingForClue,
}: OperativeScreenProps) {
  void _heist; // reserved for future background
  void _guessesRemaining; // displayed elsewhere
  const { gamertag } = useAuth();
  const isMyTeamActive = activeTeam === myTeam;

  // Local tap confirmation state (before broadcasting)
  const [localTapIndex, setLocalTapIndex] = useState<number | null>(null);

  // Handle card tap — local confirmation first
  const handleTapCard = useCallback(
    (cardIndex: number) => {
      if (!canTap) return;
      setLocalTapIndex(cardIndex);
    },
    [canTap],
  );

  // Confirm local tap → broadcast to session, host will auto-reveal
  const handleConfirmLocalTap = useCallback(() => {
    if (localTapIndex == null || !onTapCard) return;
    onTapCard(localTapIndex, gamertag ?? "Player");
    setLocalTapIndex(null);
  }, [localTapIndex, onTapCard, gamertag]);

  // Cancel local tap
  const handleCancelLocalTap = useCallback(() => {
    setLocalTapIndex(null);
  }, []);

  // Can pass turn? Only after at least 1 guess
  const canPass = isMyTeamActive && (guessesUsedThisTurn ?? 0) > 0 && !pendingTap;

  return (
    <div className="flex min-h-dvh flex-col px-3 pb-4 pt-[130px] sm:px-4">
      {/* Plain word grid (no colors) + waiting overlay */}
      <div className="relative">
        <SevynGrid
          board={board}
          activeTeam={activeTeam}
          canTap={canTap && !pendingTap && !localTapIndex}
          onTapCard={handleTapCard}
          pendingCardIndex={pendingTap?.cardIndex ?? localTapIndex}
        />

        {/* Waiting for Boss's clue — overlaid on grid */}
        <div
          className="pointer-events-none absolute inset-x-0 flex justify-center transition-opacity duration-500"
          style={{ top: "40%", transform: "translateY(-50%)", opacity: waitingForClue ? 1 : 0 }}
        >
          <div className="rounded-xl bg-black/85 px-5 py-3 backdrop-blur-sm">
            <p className="text-sm font-semibold text-white/70 animate-pulse">
              Waiting for Boss&apos;s clue...
            </p>
          </div>
        </div>
      </div>

      {/* Local tap confirmation — only the tapper sees this */}
      {localTapIndex != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-72 rounded-2xl border border-white/20 bg-[#0D1B2E] p-6 text-center">
            <p className="text-lg font-bold text-white">
              &ldquo;{board[localTapIndex]?.word}&rdquo;
            </p>
            <p className="mt-2 text-sm text-white/60">
              Are you sure? Have you confirmed this with your team?
            </p>
            <div className="mt-4 flex gap-2">
              <button
                className="flex-1 rounded-lg bg-white/10 py-2 text-sm font-semibold text-white hover:bg-white/20"
                onClick={handleCancelLocalTap}
              >
                No
              </button>
              <button
                className="flex-1 rounded-lg bg-[#E84C1E] py-2 text-sm font-semibold text-white hover:bg-[#E84C1E]/80"
                onClick={handleConfirmLocalTap}
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Not my team's turn */}
      {!isMyTeamActive && !waitingForClue && currentClue && (
        <div className="mt-4 text-center">
          <p className="text-sm text-white/40">
            {activeTeamName} is guessing...
          </p>
        </div>
      )}

      {/* Pass Turn button */}
      {canPass && onPassTurn && (
        <div className="mt-4">
          <button
            className="w-full rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-semibold text-white/60 hover:bg-white/10"
            onClick={onPassTurn}
          >
            Pass Turn
          </button>
        </div>
      )}
    </div>
  );
}
