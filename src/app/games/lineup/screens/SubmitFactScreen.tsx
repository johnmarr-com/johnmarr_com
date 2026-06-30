"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useGameColors, PhaseTimerBar } from "@/app/games/_gamecore";

interface SubmitFactScreenProps {
  deadline: number;
  timerDurationMs: number;
  hasSubmitted: boolean;
  submissionCount: number;
  totalPlayers: number;
  onSubmit: (fact: string) => Promise<void>;
}

const MAX = 200;
const MIN = 2;

export default function SubmitFactScreen({
  deadline,
  timerDurationMs,
  hasSubmitted,
  submissionCount,
  totalPlayers,
  onSubmit,
}: SubmitFactScreenProps) {
  const { primary } = useGameColors();
  const [fact, setFact] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!hasSubmitted) inputRef.current?.focus();
  }, [hasSubmitted]);

  const handleSubmit = async () => {
    const trimmed = fact.trim();
    if (trimmed.length < MIN || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(trimmed);
    } catch {
      setError("Failed to submit. Try again.");
      setSubmitting(false);
    }
  };

  const ready = fact.trim().length >= MIN && !submitting;

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-5 overflow-y-auto px-4 pb-6 pt-28">
      {!hasSubmitted ? (
        <div className="flex w-full max-w-md animate-[wk-fade-up_0.5s_ease-out_both] flex-col items-center gap-7">
          <PhaseTimerBar deadline={deadline} durationMs={timerDurationMs} />

          <div className="w-full">
            <label className="mb-6 block text-center text-sm font-bold uppercase tracking-wider text-white drop-shadow-md">
              Share a <strong>fun fact</strong> about yourself
              <br />
              that nobody here knows
            </label>
            <textarea
              ref={inputRef}
              value={fact}
              onChange={(e) => setFact(e.target.value.slice(0, MAX))}
              placeholder="e.g. I once won a hot-dog eating contest…"
              maxLength={MAX}
              rows={3}
              autoFocus
              className="w-full resize-none rounded-xl border border-white/15 bg-black/40 px-4 py-4 text-center text-lg font-semibold text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
            />
            <p className="mt-1 text-right text-xs text-white/30">
              {fact.trim().length}/{MAX}
            </p>
          </div>

          <button
            onClick={handleSubmit}
            disabled={!ready}
            className={`w-full rounded-xl py-4 text-lg font-bold uppercase tracking-wider transition-all ${
              ready
                ? "text-black shadow-lg hover:scale-[1.02] active:scale-95"
                : "cursor-not-allowed bg-white/20 text-white/50"
            }`}
            style={ready ? { backgroundColor: primary, boxShadow: `0 10px 15px -3px ${primary}40` } : undefined}
          >
            {submitting ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : "Submit Fact"}
          </button>

          {error && <p className="text-center text-sm font-medium text-red-400">{error}</p>}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-yellow-400 border-t-transparent" />
          <p className="text-center text-sm font-bold uppercase tracking-wider text-white">
            Fact locked in! Waiting for others&hellip; ({submissionCount}/{totalPlayers})
          </p>
        </div>
      )}
    </div>
  );
}
