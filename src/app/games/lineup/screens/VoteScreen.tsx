"use client";

import { useState } from "react";
import { JMAvatarView } from "@/JMKit";
import { useGameColors, PhaseTimerBar } from "@/app/games/_gamecore";
import type { GameSessionPlayer } from "@/lib/game-sessions";
import FactCard from "./FactCard";

interface VoteScreenProps {
  fact: string;
  factNumber: number;
  totalFacts: number;
  players: GameSessionPlayer[];
  currentUserId: string;
  /** True when the fact on screen is the current player's own — they sit out. */
  isMyFact: boolean;
  deadline: number;
  timerDurationMs: number;
  hasVoted: boolean;
  voteCount: number;
  totalVoters: number;
  onVote: (votedForUid: string) => Promise<void>;
}

export default function VoteScreen({
  fact,
  factNumber,
  totalFacts,
  players,
  currentUserId,
  isMyFact,
  deadline,
  timerDurationMs,
  hasVoted,
  voteCount,
  totalVoters,
  onVote,
}: VoteScreenProps) {
  const { primary, tertiary, danger } = useGameColors();
  const [confirmTarget, setConfirmTarget] = useState<GameSessionPlayer | null>(null);
  const [dismissing, setDismissing] = useState(false);
  const [voting, setVoting] = useState(false);

  const dismissModal = () => {
    setDismissing(true);
    setTimeout(() => {
      setConfirmTarget(null);
      setDismissing(false);
    }, 200);
  };

  const handleConfirm = async () => {
    if (!confirmTarget || voting) return;
    setVoting(true);
    try {
      await onVote(confirmTarget.uid);
    } catch {
      setVoting(false);
    }
    dismissModal();
  };

  // The fact's author never guesses their own fact.
  if (isMyFact) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center gap-4 overflow-y-auto px-4 py-6">
        <FactCard fact={fact} factNumber={factNumber} totalFacts={totalFacts} compact />
        <div className="mt-6 flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-black/50 px-6 py-7 text-center">
          <p className="text-2xl">🤫</p>
          <p className="text-lg font-black uppercase tracking-wider" style={{ color: primary }}>
            This is your fact!
          </p>
          <p className="max-w-xs text-sm font-semibold text-white/70">
            Sit tight while everyone else guesses who wrote it.
          </p>
          <div className="mt-1 text-xs font-bold uppercase tracking-wider text-white/40">
            {voteCount}/{totalVoters} guessed
          </div>
        </div>
      </div>
    );
  }

  const options = players.filter((p) => p.uid !== currentUserId);

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-4 overflow-y-auto px-4 py-6">
      <FactCard fact={fact} factNumber={factNumber} totalFacts={totalFacts} compact />

      {!hasVoted && (
        <div className="w-full max-w-md">
          <PhaseTimerBar deadline={deadline} durationMs={timerDurationMs} />
        </div>
      )}

      {!hasVoted ? (
        <div className="mt-2 flex w-full max-w-md flex-col gap-3">
          <p className="mb-1 animate-[wk-fade-up_0.3s_ease-out_0.1s_both] text-center text-sm font-bold uppercase tracking-wider text-white drop-shadow-md">
            Whose fact is this?
          </p>
          {options.map((p, i) => {
            const delay = 0.15 + i * 0.08;
            const duration = Math.max(0.25, 0.4 - i * 0.03);
            return (
              <button
                key={p.uid}
                onClick={() => setConfirmTarget(p)}
                className="flex w-full items-center gap-3 rounded-xl border border-transparent px-4 py-3 text-left text-white transition-all hover:scale-[1.01] active:scale-95"
                style={{
                  background: `linear-gradient(135deg, #0d9488 0%, ${tertiary} 50%, #0d9488 100%)`,
                  animation: `wk-fade-up ${duration}s ease-out ${delay}s both`,
                }}
              >
                <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-black/40">
                  <JMAvatarView width={44} avatarName={p.avatarName ?? "default"} />
                </div>
                <span className="min-w-0 flex-1 truncate text-xl font-black tracking-wide">
                  {p.gamertag}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
          <p className="text-center text-sm font-bold uppercase tracking-wider text-white/50">
            Waiting for guesses&hellip; ({voteCount}/{totalVoters})
          </p>
        </div>
      )}

      {confirmTarget && !hasVoted && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
          style={{
            animation: `${dismissing ? "wk-overlay-out" : "wk-overlay-in"} 0.2s ease-out both`,
            backgroundColor: "rgba(0,0,0,0.7)",
          }}
          onClick={dismissModal}
        >
          <div
            className="mx-4 w-full max-w-sm rounded-2xl border-[6px] p-6"
            style={{
              backgroundColor: danger,
              borderColor: tertiary,
              animation: `${dismissing ? "wk-modal-out" : "wk-modal-in"} 0.2s ease-out both`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-4 text-center text-lg font-bold text-white">
              You think <strong>{confirmTarget.gamertag}</strong> wrote this?
            </p>
            <div className="flex gap-3">
              <button
                onClick={dismissModal}
                className="flex-1 rounded-xl border border-black/20 bg-black/30 py-3 text-base font-bold uppercase tracking-wider text-white transition-all hover:bg-black/40 active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={voting}
                className="flex-1 rounded-xl py-3 text-base font-bold uppercase tracking-wider text-black transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                style={{ backgroundColor: primary }}
              >
                {voting ? "…" : "Lock it in"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
