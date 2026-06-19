"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { JMAvatarView } from "@/JMKit";
import { useGameColors, PhaseTimerBar } from "@/app/games/_gamecore";
import { submitVotes } from "../blarfApi";
import { getVotesPerPlayer } from "../blarfTypes";
import type { GameSessionPlayer } from "@/lib/game-sessions";

interface MultiVoteScreenProps {
  sessionId: string;
  players: GameSessionPlayer[];
  currentUserId: string;
  playerCount: number;
  deadline: number;
  durationMs: number;
  hasVoted: boolean;
  voteCount: number;
  totalVoters: number;
  roundNumber: number;
  totalRounds: number;
}

export default function MultiVoteScreen({
  sessionId,
  players,
  currentUserId,
  playerCount,
  deadline,
  durationMs,
  hasVoted,
  voteCount,
  totalVoters,
  roundNumber,
  totalRounds,
}: MultiVoteScreenProps) {
  const { primary, secondary, danger } = useGameColors();
  const totalVotesAllowed = getVotesPerPlayer(playerCount);
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  const votesUsed = Object.values(allocations).reduce((a, b) => a + b, 0);
  const votesRemaining = totalVotesAllowed - votesUsed;

  const addVote = useCallback((uid: string) => {
    if (uid === currentUserId || votesRemaining <= 0) return;
    setAllocations((prev) => ({ ...prev, [uid]: (prev[uid] ?? 0) + 1 }));
  }, [currentUserId, votesRemaining]);

  const removeVote = useCallback((uid: string) => {
    setAllocations((prev) => {
      const current = prev[uid] ?? 0;
      if (current <= 0) return prev;
      const next = { ...prev };
      if (current === 1) {
        delete next[uid];
      } else {
        next[uid] = current - 1;
      }
      return next;
    });
  }, []);

  const handleSubmit = async () => {
    if (submitting || votesRemaining > 0) return;
    setSubmitting(true);
    // Build the votes array (duplicate UIDs for stacked votes)
    const votes: string[] = [];
    for (const [uid, count] of Object.entries(allocations)) {
      for (let i = 0; i < count; i++) votes.push(uid);
    }
    try {
      const result = await submitVotes(sessionId, votes);
      if (!result.ok) setSubmitting(false);
    } catch {
      setSubmitting(false);
    }
  };

  if (hasVoted) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center gap-4 overflow-y-auto px-4 pt-[calc(1.5rem+75px)] pb-6">
        <p className="text-lg font-black uppercase tracking-widest" style={{ color: primary }}>
          Round {roundNumber}/{totalRounds}
        </p>
        <div className="flex flex-col items-center gap-5 py-4">
          <Image
            src="/images/games/blarf/Blarf-Vote.png"
            alt="Vote submitted"
            width={300}
            height={300}
            className="w-full max-w-[300px] object-contain drop-shadow-lg animate-gentle-pulse"
          />
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
          <p className="text-center text-lg font-bold text-white">
            Waiting for other players&hellip;
            <br />
            <span className="text-base">({voteCount} of {totalVoters} voted)</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-4 overflow-y-auto px-4 pt-[calc(1.5rem+75px)] pb-6">
      {/* Header */}
      <p className="text-lg font-black uppercase tracking-widest" style={{ color: primary }}>
        Round {roundNumber}/{totalRounds}
      </p>
      <p className="-mt-2 text-sm font-bold text-white/60">
        {voteCount} of {totalVoters} players voted
      </p>

      {/* Timer */}
      <div className="w-full max-w-md">
        <PhaseTimerBar deadline={deadline} durationMs={durationMs} />
      </div>
      <div className="rounded-full px-6 py-2.5" style={{ backgroundColor: votesRemaining > 0 ? danger : secondary }}>
        <p className="text-lg font-black text-white">
          {votesRemaining > 0
            ? `Who Blarfed? — ${votesRemaining} vote${votesRemaining !== 1 ? "s" : ""}`
            : "Ready — confirm below!"}
        </p>
      </div>

      {/* Player grid */}
      <div className="grid w-full max-w-md grid-cols-2 gap-3 sm:grid-cols-3">
        {players.map((player) => {
          const isSelf = player.uid === currentUserId;
          const myVotes = allocations[player.uid] ?? 0;

          return (
            <button
              key={player.uid}
              onClick={() => {
                if (isSelf) return;
                if (myVotes > 0 && votesRemaining <= 0) {
                  removeVote(player.uid);
                } else {
                  addVote(player.uid);
                }
              }}
              disabled={isSelf}
              className={`relative flex flex-col items-center rounded-xl border-2 px-3 pb-3 pt-4 transition-all ${
                isSelf
                  ? "cursor-default border-transparent bg-black/30 opacity-40"
                  : myVotes > 0
                    ? "border-amber-400 bg-amber-400/15 hover:bg-amber-400/20"
                    : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
              } active:scale-95`}
            >
              <div className="relative h-22 w-22">
                <div className="h-full w-full overflow-hidden rounded-full bg-black/30">
                  <JMAvatarView width={88} avatarName={player.avatarName ?? "default"} />
                </div>
                {myVotes > 0 && (
                  <div
                    className="absolute -right-1 -top-1 z-20 flex h-7 w-7 items-center justify-center rounded-full text-sm font-black text-black shadow-lg"
                    style={{ backgroundColor: primary }}
                  >
                    {myVotes}
                  </div>
                )}
              </div>
              <span className={`relative z-10 -mt-2.5 truncate rounded-full bg-black/50 px-2.5 py-0.5 text-xs font-bold ${isSelf ? "text-white/40" : "text-white"}`}>
                {player.gamertag}
                {isSelf && " (you)"}
              </span>
              {myVotes > 0 && votesRemaining <= 0 && !isSelf && (
                <span className="text-xs font-bold text-amber-400/60">tap to remove</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Submit button */}
      {votesRemaining === 0 && (
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="mt-2 w-full max-w-md rounded-xl py-4 text-lg font-black uppercase tracking-wider text-black transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
          style={{ backgroundColor: primary }}
        >
          {submitting ? "Submitting..." : `Confirm Vote${totalVotesAllowed !== 1 ? "s" : ""}`}
        </button>
      )}
    </div>
  );
}
