"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import DefinitionCard from "./DefinitionCard";

interface SubmitWordScreenProps {
  definition: string;
  roundNumber: number;
  totalRounds: number;
  deadline: number;
  hasSubmitted: boolean;
  submissionCount: number;
  totalPlayers: number;
  onSubmit: (word: string) => Promise<void>;
}

export default function SubmitWordScreen({
  definition,
  roundNumber,
  totalRounds,
  deadline,
  hasSubmitted,
  submissionCount,
  totalPlayers,
  onSubmit,
}: SubmitWordScreenProps) {
  const [word, setWord] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Countdown timer
  useEffect(() => {
    if (deadline <= 0) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsLeft(left);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [deadline]);

  // Auto-focus input
  useEffect(() => {
    if (!hasSubmitted) inputRef.current?.focus();
  }, [hasSubmitted]);

  const handleSubmit = async () => {
    const trimmed = word.trim();
    if (trimmed.length === 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(trimmed);
    } catch {
      setError("Failed to submit. Try again.");
      setSubmitting(false);
    }
  };

  const timerColor =
    secondsLeft <= 10 ? "text-red-400" : secondsLeft <= 30 ? "text-amber-400" : "text-white/50";

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-5 overflow-y-auto px-4 py-6">
      <div className="animate-[wk-slide-down_0.5s_ease-out_both]">
        <DefinitionCard
          definition={definition}
          roundNumber={roundNumber}
          totalRounds={totalRounds}
        />
      </div>

      {!hasSubmitted ? (
        <div className="flex w-full max-w-md animate-[wk-fade-up_0.5s_ease-out_0.2s_both] flex-col items-center gap-4">
          {/* Timer */}
          {deadline > 0 && (
            <p className={`text-center text-sm font-bold tabular-nums ${timerColor}`}>
              {secondsLeft}s remaining
            </p>
          )}

          {/* Input */}
          <div className="w-full">
            <label className="mb-3 block text-center text-sm font-bold uppercase tracking-wider text-white drop-shadow-md">
              Create a <strong>crazy word</strong><br />for the <strong>crazy definition</strong>
            </label>
            <input
              ref={inputRef}
              type="text"
              value={word}
              onChange={(e) => setWord(e.target.value.slice(0, 40))}
              onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
              placeholder="type your made-up word..."
              maxLength={40}
              autoFocus
              autoComplete="off"
              autoCapitalize="none"
              className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-4 text-center text-xl font-bold lowercase tracking-wider text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
            />
            <p className="mt-1 text-right text-xs text-white/30">
              {word.trim().length}/40
            </p>
          </div>

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={word.trim().length === 0 || submitting}
            className={`w-full rounded-xl py-4 text-lg font-bold uppercase tracking-wider transition-all ${
              word.trim().length > 0 && !submitting
                ? "text-black shadow-lg hover:scale-[1.02] active:scale-95"
                : "cursor-not-allowed bg-white/20 text-white/50"
            }`}
            style={word.trim().length > 0 && !submitting ? { backgroundColor: "#8eff0e", boxShadow: "0 10px 15px -3px rgba(142,255,14,0.25)" } : undefined}
          >
            {submitting ? (
              <Loader2 className="mx-auto h-5 w-5 animate-spin" />
            ) : (
              "Submit"
            )}
          </button>

          {error && (
            <p className="text-center text-sm font-medium text-red-400">{error}</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-yellow-400 border-t-transparent" />
          <p className="text-center text-sm font-bold uppercase tracking-wider text-white">
            Waiting for others&hellip; ({submissionCount}/{totalPlayers})
          </p>
        </div>
      )}
    </div>
  );
}
