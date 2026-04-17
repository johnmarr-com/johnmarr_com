"use client";

import { useState, useCallback } from "react";
import type { SevynBoardCard, CardType, SevynTeam, SevynClue, SevynHeist, SevynPendingTap } from "../sevynTypes";
import { GamePrimaryButton } from "@/app/games/_gamecore";
import { getAIAuthHeaders } from "@/app/games/_gamecore";
import { SEVYN_COLORS } from "../SevynGame";
import SevynGrid from "./SevynGrid";


interface BossScreenProps {
  board: SevynBoardCard[];
  colorMap: CardType[] | null;
  activeTeam: SevynTeam;
  myTeam: SevynTeam;
  activeTeamName: string;
  currentClue: SevynClue | null;
  isMyTurn: boolean;
  pendingTap?: SevynPendingTap | null;
  onSubmitClue?: (word: string, number: number) => void;
  heist?: SevynHeist | null;
}

export default function BossScreen({
  board,
  colorMap,
  activeTeam,
  myTeam,
  activeTeamName,
  currentClue,
  isMyTurn,
  pendingTap,
  onSubmitClue,
  heist: _heist,
}: BossScreenProps) {
  void _heist; // reserved for background
  const isMyTeamActive = activeTeam === myTeam;
  const [clueWord, setClueWord] = useState("");
  const [clueNumber, setClueNumber] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!onSubmitClue) return;
    const word = clueWord.trim();
    if (!word) {
      setError("Enter a clue word");
      return;
    }
    if (word.includes(" ")) {
      setError("Clue must be a single word");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Server-side validation
      const headers = await getAIAuthHeaders();
      const res = await fetch("/api/games/sevyn", {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "validate-clue",
          clueWord: word,
          boardWords: board.filter((c) => !c.revealed).map((c) => c.word),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (!data.valid) {
          setError(data.reason);
          setSubmitting(false);
          return;
        }
      }

      onSubmitClue(word.toUpperCase(), clueNumber);
      setClueWord("");
      setClueNumber(1);
    } catch {
      setError("Failed to validate clue");
    } finally {
      setSubmitting(false);
    }
  }, [clueWord, clueNumber, board, onSubmitClue]);

  return (
    <div className="flex min-h-dvh flex-col px-3 pb-4 pt-[130px] sm:px-4">
      {/* Color-coded grid */}
      <div className="relative">
        <div className="transition-opacity duration-500" style={{ opacity: isMyTeamActive ? 1 : 0.25 }}>
          <SevynGrid
            board={board}
            colorMap={colorMap}
            activeTeam={activeTeam}
            canTap={false}
            pendingCardIndex={pendingTap?.cardIndex ?? null}
          />
        </div>

        {/* Other team is playing — non-active team boss */}
        {!isMyTeamActive && (
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

      {/* Clue input panel — only visible when it's my turn */}
      {isMyTurn && !currentClue && (
        <div className="mt-4 rounded-xl border border-[#E84C1E]/30 bg-black/50 p-4 backdrop-blur-sm">
          <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-[#E84C1E]">
            Give Your Clue
          </p>

          <div className="flex gap-2">
            <input
              type="text"
              value={clueWord}
              onChange={(e) => {
                setClueWord(e.target.value.replace(/\s/g, ""));
                setError(null);
              }}
              placeholder="One word..."
              className="flex-1 rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-[#E84C1E]"
              maxLength={30}
              autoFocus
            />
            <select
              value={clueNumber}
              onChange={(e) => setClueNumber(Number(e.target.value))}
              className="w-14 rounded-lg border border-white/20 bg-white/5 px-2 py-2 text-center text-sm text-white outline-none focus:border-[#E84C1E]"
            >
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <option key={n} value={n} className="bg-[#0D1B2E]">
                  {n}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p className="mt-2 text-center text-xs text-red-400">{error}</p>
          )}

          <div className="mt-3">
            <GamePrimaryButton onClick={handleSubmit} loading={submitting} disabled={submitting}>
              Submit Clue
            </GamePrimaryButton>
          </div>
        </div>
      )}

      {/* Clue active — brief status for active team boss only */}
      {currentClue && isMyTeamActive && (
        <div className="mt-4 text-center">
          <p className="text-xs text-white/40">Operatives are guessing...</p>
        </div>
      )}
    </div>
  );
}
