"use client";

import { useState, useEffect } from "react";
import DefinitionCard from "./DefinitionCard";

interface WordEntry {
  authorId: string;
  word: string;
}

interface VotingScreenProps {
  definition: string;
  roundNumber: number;
  totalRounds: number;
  words: WordEntry[];
  currentUserId: string;
  deadline: number;
  hasVoted: boolean;
  voteCount: number;
  totalVoters: number;
  onVote: (authorId: string) => Promise<void>;
}

export default function VotingScreen({
  definition,
  roundNumber,
  totalRounds,
  words,
  currentUserId,
  deadline,
  hasVoted,
  voteCount,
  totalVoters,
  onVote,
}: VotingScreenProps) {
  const [confirmTarget, setConfirmTarget] = useState<WordEntry | null>(null);
  const [voting, setVoting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

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

  const handleConfirm = async () => {
    if (!confirmTarget || voting) return;
    setVoting(true);
    try {
      await onVote(confirmTarget.authorId);
    } catch {
      setVoting(false);
    }
    setConfirmTarget(null);
  };

  const timerColor =
    secondsLeft <= 10 ? "text-red-400" : secondsLeft <= 20 ? "text-amber-400" : "text-white/50";

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-4 overflow-y-auto px-4 py-6">
      <div className="animate-[wk-slide-down_0.5s_ease-out_both]">
        <DefinitionCard
          definition={definition}
          roundNumber={roundNumber}
          totalRounds={totalRounds}
          compact
        />
      </div>

      {/* Timer */}
      {deadline > 0 && !hasVoted && (
        <p className={`text-center text-sm font-bold tabular-nums ${timerColor}`}>
          {secondsLeft}s to vote
        </p>
      )}

      {!hasVoted ? (
        <div className="flex w-full max-w-md animate-[wk-fade-up_0.5s_ease-out_0.2s_both] flex-col gap-3">
          <p className="text-center text-sm font-bold uppercase tracking-wider text-white drop-shadow-md">
            Vote for your favourite
          </p>
          {[...words].sort((a, b) => {
            const aOwn = a.authorId === currentUserId ? 1 : 0;
            const bOwn = b.authorId === currentUserId ? 1 : 0;
            return aOwn - bOwn;
          }).map((w) => {
            const isOwn = w.authorId === currentUserId;
            return (
              <button
                key={w.authorId}
                onClick={() => { if (!isOwn) setConfirmTarget(w); }}
                disabled={isOwn}
                className={`w-full rounded-xl border px-4 py-4 text-center text-2xl font-black lowercase tracking-wider transition-all ${
                  isOwn
                    ? "cursor-default border-transparent bg-black/40 text-white/50"
                    : "border-transparent bg-blue-500/80 text-white hover:scale-[1.01] hover:bg-blue-500 active:scale-95"
                }`}
              >
                {w.word}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
          <p className="text-center text-sm font-bold uppercase tracking-wider text-white/50">
            Waiting for votes&hellip; ({voteCount}/{totalVoters})
          </p>
        </div>
      )}

      {/* Vote confirmation popup */}
      {confirmTarget && !hasVoted && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setConfirmTarget(null)}
        >
          <div
            className="mx-4 w-full max-w-sm rounded-2xl border border-white/15 p-6"
            style={{ backgroundColor: "#ff1493" }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-4 text-center text-lg font-bold text-white">
              Vote for &ldquo;{confirmTarget.word}&rdquo;?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmTarget(null)}
                className="flex-1 rounded-xl border border-black/20 bg-black/30 py-3 text-base font-bold uppercase tracking-wider text-white transition-all hover:bg-black/40 active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={voting}
                className="flex-1 rounded-xl py-3 text-base font-bold uppercase tracking-wider text-black transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                style={{ backgroundColor: "#8eff0e" }}
              >
                {voting ? "..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
