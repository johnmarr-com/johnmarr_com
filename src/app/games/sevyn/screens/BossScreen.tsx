"use client";

import { useState, useCallback } from "react";
import type { SevynBoardCard, CardType, SevynTeam, SevynClue, SevynHeist, SevynPendingTap } from "../sevynTypes";
import { GamePrimaryButton } from "@/app/games/_gamecore";
import { getAIAuthHeaders } from "@/app/games/_gamecore";
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
  myTeam: _myTeam,
  activeTeamName,
  currentClue,
  isMyTurn,
  pendingTap,
  onSubmitClue,
  heist: _heist,
}: BossScreenProps) {
  void _heist; // reserved for background
  void _myTeam; // displayed in score bar
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
      <SevynGrid
        board={board}
        colorMap={colorMap}
        activeTeam={activeTeam}
        canTap={false}
        pendingCardIndex={pendingTap?.cardIndex ?? null}
      />

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

      {/* Waiting state when not my turn */}
      {!isMyTurn && !currentClue && (
        <div className="mt-4 text-center">
          <p className="text-sm text-white/40 animate-pulse">
            Waiting for {activeTeamName}&apos;s Boss...
          </p>
        </div>
      )}

      {/* Clue active — brief status only (score bar shows the clue) */}
      {currentClue && (
        <div className="mt-4 text-center">
          <p className="text-xs text-white/40">Operatives are guessing...</p>
        </div>
      )}
    </div>
  );
}
