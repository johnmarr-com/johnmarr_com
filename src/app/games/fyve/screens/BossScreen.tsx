"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import type { FyveBoardCard, CardType, FyveTeam, FyveClue, FyveHeist, FyvePendingTap } from "../fyveTypes";
import { getAIAuthHeaders } from "@/app/games/_gamecore";
import { JMCloseCircleButton } from "@/JMKit/JMCloseCircleButton";
import { FYVE_COLORS } from "../FyveGame";
import FyveGrid from "./FyveGrid";
import HeistProgressBars from "./HeistProgressBars";


interface BossScreenProps {
  board: FyveBoardCard[];
  colorMap: CardType[] | null;
  activeTeam: FyveTeam;
  myTeam: FyveTeam;
  activeTeamName: string;
  currentClue: FyveClue | null;
  isMyTurn: boolean;
  pendingTap?: FyvePendingTap | null;
  onSubmitClue?: (word: string, number: number) => void;
  heist?: FyveHeist | null;
  t1Score: number;
  t2Score: number;
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
  t1Score,
  t2Score,
}: BossScreenProps) {
  void _heist; // reserved for background
  const isMyTeamActive = activeTeam === myTeam;
  const teamAccent = myTeam === "syndicate1" ? "#E84C1E" : "#3B82F6";
  const [clueWord, setClueWord] = useState("");
  const [clueNumber, setClueNumber] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [clueModalOpen, setClueModalOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the input when modal opens
  useEffect(() => {
    if (!clueModalOpen) return;
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, [clueModalOpen]);

  // Listen for top-bar "Create Clue" button tap
  useEffect(() => {
    if (!isMyTurn || currentClue) return;
    const open = () => setClueModalOpen(true);
    window.addEventListener("fyve-open-clue-modal", open);
    return () => window.removeEventListener("fyve-open-clue-modal", open);
  }, [isMyTurn, currentClue]);

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
      const res = await fetch("/api/games/fyve", {
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
      setClueModalOpen(false);
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
          <FyveGrid
            board={board}
            colorMap={colorMap}
            activeTeam={activeTeam}
            canTap={false}
            pendingCardIndex={pendingTap?.cardIndex ?? null}
          />
        </div>

        {/* Other team is playing — non-active team boss */}
        {!isMyTeamActive && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="rounded-2xl border border-[#daa520] bg-black/85 px-7 py-4 backdrop-blur-sm">
              <p className="text-base font-bold animate-pulse">
                <span style={{ color: activeTeam === "syndicate1" ? FYVE_COLORS.t1 : FYVE_COLORS.t2 }}>
                  {activeTeamName}
                </span>
                <span className="text-white/70"> are playing...</span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Heist progress bars */}
      <HeistProgressBars t1Score={t1Score} t2Score={t2Score} activeTeam={activeTeam} />

      {/* Create Clue button — only visible when it's my turn */}
      {isMyTurn && !currentClue && (
        <div className="mt-4">
          <button
            type="button"
            className="w-full rounded-xl bg-linear-to-br from-[#b8860b] via-[#daa520] to-[#8b6914] py-4.5 text-base font-bold text-neutral-950 active:scale-[0.98] transition-transform"
            onClick={() => setClueModalOpen(true)}
          >
            Create Clue
          </button>
        </div>
      )}

      {/* Clue modal — portaled so keyboard doesn't push the grid */}
      {clueModalOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => { setClueModalOpen(false); setError(null); }}
            aria-label="Close"
          />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-white/10 bg-neutral-950 p-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-bold uppercase tracking-wider" style={{ color: teamAccent }}>
                Clue:
              </p>
              <JMCloseCircleButton onClick={() => { setClueModalOpen(false); setError(null); }} />
            </div>

            <form
              onSubmit={(e) => { e.preventDefault(); void handleSubmit(); }}
              className="flex flex-col gap-3"
            >
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={clueWord}
                  onChange={(e) => {
                    setClueWord(e.target.value.replace(/\s/g, ""));
                    setError(null);
                  }}
                  placeholder="One word..."
                  className="flex-1 rounded-lg border border-white/20 bg-white/5 px-3 py-3 text-sm text-white placeholder-white/30 outline-none"
                  onFocus={(e) => { e.currentTarget.style.borderColor = teamAccent; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = ""; }}
                  maxLength={30}
                  enterKeyHint="send"
                  autoComplete="off"
                  autoCapitalize="off"
                />
                <select
                  value={clueNumber}
                  onChange={(e) => setClueNumber(Number(e.target.value))}
                  className="w-16 rounded-lg border border-white/20 bg-white/5 px-2 py-3 text-center text-sm text-white outline-none"
                  onFocus={(e) => { e.currentTarget.style.borderColor = teamAccent; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = ""; }}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n} className="bg-neutral-900">
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              {error && (
                <p className="text-center text-sm text-red-400">{error}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-linear-to-br from-[#b8860b] via-[#daa520] to-[#8b6914] py-3 text-sm font-bold text-neutral-950 disabled:opacity-50"
              >
                {submitting ? "Validating..." : "Share Clue"}
              </button>
            </form>
          </div>
        </div>,
        document.body,
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
