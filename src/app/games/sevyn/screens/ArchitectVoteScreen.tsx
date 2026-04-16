"use client";

import { useMemo, useEffect, useRef } from "react";
import type { GameSession } from "@/lib/game-sessions";
import type { SevynTeam, SevynTeamRoster } from "../sevynTypes";
import { GameSectionHeader, GameStatusMessage } from "@/app/games/_gamecore";
import { SEVYN_COLORS } from "../SevynGame";

interface ArchitectVoteScreenProps {
  session: GameSession;
  teams: Record<SevynTeam, SevynTeamRoster>;
  userId: string;
  myTeam: SevynTeam | null;
  myTeamName: string;
  isHost: boolean;
  votes: Record<string, string>;
  onVote: (candidateUid: string) => void;
  onElected: (s1Architect: string, s2Architect: string) => void;
}

function resolveVote(teamMembers: string[], votes: Record<string, string>): string | null {
  // Count votes from team members only
  const counts = new Map<string, number>();
  for (const uid of teamMembers) {
    const vote = votes[uid];
    if (vote && teamMembers.includes(vote)) {
      counts.set(vote, (counts.get(vote) ?? 0) + 1);
    }
  }
  if (counts.size === 0) return null;

  // Find max
  let maxCount = 0;
  for (const c of counts.values()) {
    if (c > maxCount) maxCount = c;
  }
  const tied = [...counts.entries()].filter(([, c]) => c === maxCount).map(([uid]) => uid);

  // If tie, pick random among tied
  return tied[Math.floor(Math.random() * tied.length)]!;
}

export default function ArchitectVoteScreen({
  session,
  teams,
  userId,
  myTeam,
  myTeamName,
  isHost,
  votes,
  onVote,
  onElected,
}: ArchitectVoteScreenProps) {
  const playerMap = useMemo(() => {
    const m = new Map<string, string>();
    session.players.forEach((p) => m.set(p.uid, p.gamertag));
    return m;
  }, [session.players]);

  const myTeamMembers = myTeam ? teams[myTeam].members : [];
  const myVote = votes[userId];

  // Check if all players have voted
  const allPlayers = [...teams.syndicate1.members, ...teams.syndicate2.members];
  const allVoted = allPlayers.every((uid) => votes[uid] != null);

  // Teammates who I can vote for (excluding myself — I vote for someone else to be architect)
  const voteCandidates = myTeamMembers.filter((uid) => uid !== userId);

  // Host auto-resolves once all votes are in (fire exactly once)
  const electedRef = useRef(false);
  useEffect(() => {
    if (!isHost || !allVoted || electedRef.current) return;
    const s1Architect = resolveVote(teams.syndicate1.members, votes);
    const s2Architect = resolveVote(teams.syndicate2.members, votes);
    if (s1Architect && s2Architect) {
      electedRef.current = true;
      onElected(s1Architect, s2Architect);
    }
  }, [isHost, allVoted, teams, votes, onElected]);

  return (
    <div className="flex min-h-dvh flex-col items-center px-4 py-16">
      <div className="w-full max-w-lg">
        <GameSectionHeader
          eyebrow="SEVYN"
          title="Elect Your Architect"
          titleColorClass="text-[#E84C1E]"
          eyebrowColorClass="text-[#E84C1E]/70"
        />

        <p className="mt-4 text-center text-sm text-white/60">
          Vote for a teammate to be your team&apos;s Architect.
          <br />
          The Architect gives clues. Operatives guess.
        </p>

        {!myTeam && (
          <GameStatusMessage message="You are not on a team" type="waiting" />
        )}

        {myTeam && (
          <div className="mt-6">
            <h3 className="mb-3 text-center text-xs font-bold uppercase tracking-wider"
              style={{ color: myTeam === "syndicate1" ? SEVYN_COLORS.t1 : SEVYN_COLORS.t2 }}
            >
              {myTeamName} — Your Vote
            </h3>

            {/* If only 2 players on team, the other one is auto-architect */}
            {voteCandidates.length === 0 ? (
              <p className="text-center text-sm text-white/60">
                You are the only candidate — you will be the Architect.
              </p>
            ) : (
              <div className="space-y-2">
                {voteCandidates.map((uid) => {
                  const isSelected = myVote === uid;
                  return (
                    <button
                      key={uid}
                      className={`w-full rounded-xl border p-3 text-center text-sm font-semibold transition ${
                        isSelected
                          ? "border-[#E84C1E] bg-[#E84C1E]/20 text-white"
                          : "border-white/10 bg-black/30 text-white/70 hover:border-white/30"
                      }`}
                      onClick={() => onVote(uid)}
                      disabled={!!myVote}
                    >
                      {playerMap.get(uid) ?? uid}
                      {isSelected && " ✓"}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Can also vote for yourself */}
            {!myVote && myTeamMembers.length > 1 && (
              <button
                className="mt-2 w-full rounded-xl border border-white/5 bg-black/20 p-3 text-center text-xs text-white/40 hover:border-white/20"
                onClick={() => onVote(userId)}
              >
                Vote for yourself
              </button>
            )}
          </div>
        )}

        {myVote && !allVoted && (
          <p className="mt-6 text-center text-sm text-white/40 animate-pulse">
            Waiting for all players to vote...
          </p>
        )}
      </div>
    </div>
  );
}
