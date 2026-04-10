"use client";

import { useState, useCallback } from "react";
import { UserX } from "lucide-react";
import { JMBannerText } from "@/JMKit";
import JMAvatarView from "@/JMKit/JMAvatarView";
import type { GameSessionPlayer } from "@/lib/game-sessions";

interface SketchinessVotingProps {
  players: GameSessionPlayer[];
  playOrder: string[];
  aiPlayerId: string | null;
  userId: string;
  moleId: string | null;
  votes: Record<string, string>;
  onVote: (targetUid: string) => Promise<void>;
  onProceed: () => void;
  isHost: boolean;
}

export default function SketchinessVoting({
  players,
  playOrder,
  aiPlayerId,
  userId,
  moleId,
  votes,
  onVote,
  onProceed,
  isHost,
}: SketchinessVotingProps) {
  const [voting, setVoting] = useState(false);
  const hasVoted = !!votes[userId];

  const humanPlayers = playOrder.filter((uid) => uid !== aiPlayerId);
  const totalVoters = humanPlayers.length;
  const totalVotes = Object.keys(votes).length;
  const allVotesIn = totalVotes >= totalVoters;

  const handleVote = useCallback(
    async (targetUid: string) => {
      if (hasVoted || voting) return;
      setVoting(true);
      try {
        await onVote(targetUid);
      } finally {
        setVoting(false);
      }
    },
    [hasVoted, voting, onVote],
  );

  // Tally votes
  const voteTally: Record<string, number> = {};
  Object.values(votes).forEach((target) => {
    voteTally[target] = (voteTally[target] ?? 0) + 1;
  });
  const topVoted = allVotesIn
    ? Object.entries(voteTally).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
    : null;
  const moleFound = topVoted === moleId;

  const getPlayerName = (uid: string) => {
    if (uid === aiPlayerId) return "Agent SILICON";
    return players.find((p) => p.uid === uid)?.gamertag ?? "Unknown";
  };

  const getPlayerAvatar = (uid: string) => {
    if (uid === aiPlayerId) return undefined;
    return players.find((p) => p.uid === uid)?.avatarName;
  };

  return (
    <div className="fixed inset-0 z-10 flex flex-col items-center">
      <div className="flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-6 px-6">
        <JMBannerText borderColor="rgba(239, 68, 68, 0.4)">
          <h1 className="px-4 py-2 text-xl font-black uppercase tracking-wider text-red-400">
            <UserX className="mr-2 inline h-5 w-5" />
            Mole Hunt
          </h1>
        </JMBannerText>

        <p className="text-center text-sm text-white/50">
          One agent may be a mole. Vote for who you suspect.
        </p>

        {!allVotesIn ? (
          <>
            <div className="w-full space-y-2">
              {humanPlayers
                .filter((uid) => uid !== userId)
                .map((uid) => (
                  <button
                    key={uid}
                    onClick={() => handleVote(uid)}
                    disabled={hasVoted || voting}
                    className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 transition-all ${
                      hasVoted && votes[userId] === uid
                        ? "border-red-400/40 bg-red-400/10"
                        : "border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-50"
                    }`}
                  >
                    <div className="h-8 w-8 shrink-0">
                      {getPlayerAvatar(uid) ? (
                        <JMAvatarView width={32} avatarName={getPlayerAvatar(uid)!} />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white/60">
                          {getPlayerName(uid).charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <span className="text-sm font-bold text-white">
                      {getPlayerName(uid)}
                    </span>
                    {hasVoted && votes[userId] === uid && (
                      <span className="ml-auto text-xs text-red-400">Your vote</span>
                    )}
                  </button>
                ))}
            </div>

            <p className="text-xs text-white/30">
              {hasVoted
                ? `Waiting for other agents... (${totalVotes}/${totalVoters})`
                : voting
                  ? "Submitting vote..."
                  : "Select the agent you suspect."}
            </p>
          </>
        ) : (
          /* Results */
          <div className="w-full space-y-4">
            <div className="space-y-1.5">
              {humanPlayers.map((uid) => (
                <div
                  key={uid}
                  className={`flex items-center gap-3 rounded-lg border px-4 py-2 ${
                    uid === topVoted ? "border-red-400/40 bg-red-400/10" : "border-white/5 bg-white/5"
                  }`}
                >
                  <div className="h-7 w-7">
                    {getPlayerAvatar(uid) ? (
                      <JMAvatarView width={28} avatarName={getPlayerAvatar(uid)!} />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white/60">
                        {getPlayerName(uid).charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <span className="text-sm font-bold text-white">{getPlayerName(uid)}</span>
                  <span className="ml-auto text-xs text-white/40">{voteTally[uid] ?? 0} votes</span>
                  {uid === moleId && (
                    <span className="rounded-full bg-red-400/20 px-2 py-0.5 text-[9px] font-bold text-red-400">
                      MOLE
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-center">
              <p className={`text-lg font-black uppercase ${moleFound ? "text-green-400" : "text-red-400"}`}>
                {moleFound
                  ? "Mole identified! The syndicate is safe."
                  : moleId
                    ? `The mole was ${getPlayerName(moleId)}. They slipped through.`
                    : "No mole this round."}
              </p>
            </div>

            {isHost && (
              <button
                onClick={onProceed}
                className="w-full rounded-xl bg-white py-4 text-lg font-bold uppercase tracking-wider text-black transition-all hover:scale-[1.02] active:scale-95"
              >
                Continue
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
