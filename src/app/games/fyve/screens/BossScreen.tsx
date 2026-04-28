"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import type { FyveBoardCard, CardType, FyveTeam, FyveClue, FyveHeist, FyvePendingTap } from "../fyveTypes";
import { getAIAuthHeaders } from "@/app/games/_gamecore";
import { JMCloseCircleButton } from "@/JMKit/JMCloseCircleButton";
import { JMNumberPickerPopup } from "@/JMKit";
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
  const [numberPickerOpen, setNumberPickerOpen] = useState(false);
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
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
            onClick={() => { setClueModalOpen(false); setError(null); }}
            aria-label="Close"
          />
          <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-[28px] border border-white/15 bg-linear-to-b from-neutral-950 via-neutral-900 to-neutral-950 p-6 shadow-2xl shadow-black/50">
            <JMCloseCircleButton
              className="absolute right-4 top-4 z-20"
              onClick={() => { setClueModalOpen(false); setError(null); }}
            />
            <p className="mb-5 text-lg font-black uppercase tracking-wider" style={{ color: teamAccent }}>
              Create Clue
            </p>

            <form
              onSubmit={(e) => { e.preventDefault(); void handleSubmit(); }}
              className="flex flex-col gap-4"
            >
              <div className="flex items-center gap-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={clueWord}
                  onChange={(e) => {
                    setClueWord(e.target.value.replace(/\s/g, ""));
                    setError(null);
                  }}
                  placeholder="One word..."
                  className="flex-1 rounded-xl border border-white/20 bg-white/5 px-4 py-4 text-base font-bold text-white placeholder-white/30 outline-none"
                  onFocus={(e) => { e.currentTarget.style.borderColor = teamAccent; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = ""; }}
                  maxLength={30}
                  enterKeyHint="send"
                  autoComplete="off"
                  autoCapitalize="off"
                />
                <button
                  type="button"
                  onClick={() => setNumberPickerOpen(true)}
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 text-2xl font-black text-white transition-all active:scale-90"
                  style={{ borderColor: teamAccent, backgroundColor: `${teamAccent}20` }}
                >
                  {clueNumber}
                </button>
              </div>

              {error && (
                <p className="text-center text-sm font-bold text-red-400">{error}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-linear-to-br from-[#b8860b] via-[#daa520] to-[#8b6914] py-4 text-base font-black uppercase tracking-wider text-neutral-950 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
              >
                {submitting ? "Validating..." : "Share Clue"}
              </button>
            </form>
          </div>
        </div>,
        document.body,
      )}

      {/* Number picker popup */}
      <JMNumberPickerPopup
        open={numberPickerOpen}
        value={clueNumber}
        options={[1, 2, 3, 4, 5]}
        accentColor={teamAccent}
        onSelect={(n) => {
          setClueNumber(n);
          setNumberPickerOpen(false);
        }}
        onClose={() => setNumberPickerOpen(false)}
      />

      {/* Clue active — brief status for active team boss only */}
      {currentClue && isMyTeamActive && (
        <div className="mt-4 text-center">
          <p className="text-xs text-white/40">Operatives are guessing...</p>
        </div>
      )}
    </div>
  );
}
