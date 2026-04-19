"use client";

import { useState, useCallback } from "react";
import type { SevynBoardCard, SevynTeam, SevynClue, SevynPendingTap, SevynHeist } from "../sevynTypes";
import { useAuth } from "@/lib/AuthProvider";
import { SEVYN_COLORS } from "../SevynGame";
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
  onPassTurn?: () => void | Promise<void>;
  heist?: SevynHeist | null;
  waitingForClue?: boolean;
}

export default function OperativeScreen({
  board,
  activeTeam,
  myTeam,
  activeTeamName,
  currentClue: _currentClue,
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
  void _currentClue; // displayed in score bar
  const { gamertag } = useAuth();
  const isMyTeamActive = activeTeam === myTeam;

  // Local tap confirmation state (before broadcasting)
  const [localTapIndex, setLocalTapIndex] = useState<number | null>(null);
  const [passConfirmOpen, setPassConfirmOpen] = useState(false);

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
        <div className="transition-opacity duration-500" style={{ opacity: isMyTeamActive ? 1 : 0.25 }}>
          <SevynGrid
            board={board}
            activeTeam={activeTeam}
            canTap={canTap && !pendingTap && !localTapIndex}
            onTapCard={handleTapCard}
            pendingCardIndex={pendingTap?.cardIndex ?? localTapIndex}
          />
        </div>

        {/* Waiting for Boss's clue — active team operatives only */}
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

        {/* Other team is playing — non-active team operatives */}
        {!isMyTeamActive && !waitingForClue && (
          <div
            className="pointer-events-none absolute inset-x-0 flex justify-center"
            style={{ top: "40%", transform: "translateY(-50%)" }}
          >
            <div className="rounded-xl bg-black/85 px-5 py-3 backdrop-blur-sm">
              <p className="text-sm font-semibold animate-pulse">
                <span style={{ color: activeTeam === "syndicate1" ? SEVYN_COLORS.t1 : SEVYN_COLORS.t2 }}>
                  {activeTeamName}
                </span>
                <span className="text-white/70"> are playing...</span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Local tap confirmation — only the tapper sees this */}
      {localTapIndex != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-72 rounded-2xl border border-white/15 bg-neutral-900 p-6 text-center">
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

      {/* Pass turn — confirm then write session (any operative on active team) */}
      {canPass && onPassTurn && (
        <div className="mt-4">
          <button
            type="button"
            className="w-full rounded-xl border border-black/20 bg-[#F5D547] py-3 text-sm font-semibold text-black shadow-sm hover:bg-[#edd03d] active:bg-[#e4c735]"
            onClick={() => setPassConfirmOpen(true)}
          >
            Optional: Pass Turn
          </button>
        </div>
      )}

      {passConfirmOpen && onPassTurn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-72 rounded-2xl border border-white/15 bg-neutral-900 p-6 text-center">
            <p className="text-lg font-bold text-white">Pass this turn?</p>
            <p className="mt-2 text-sm text-white/60">
              Your team will stop guessing; the other syndicate gets the next clue.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-lg bg-white/10 py-2 text-sm font-semibold text-white hover:bg-white/20"
                onClick={() => setPassConfirmOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="flex-1 rounded-lg bg-[#F5D547] py-2 text-sm font-semibold text-black hover:bg-[#edd03d]"
                onClick={() => {
                  setPassConfirmOpen(false);
                  void onPassTurn();
                }}
              >
                Pass turn
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
