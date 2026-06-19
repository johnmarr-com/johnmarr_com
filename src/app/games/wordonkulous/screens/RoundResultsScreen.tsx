"use client";

import { useMemo } from "react";
import { JMAvatarView } from "@/JMKit";
import { useGameColors } from "@/app/games/_gamecore";
import type { GameSessionPlayer } from "@/lib/game-sessions";
import DefinitionCard from "./DefinitionCard";

interface RoundResultsScreenProps {
  definition: string;
  roundNumber: number;
  totalRounds: number;
  submissions: Record<string, string>;
  votes: Record<string, string>;
  players: GameSessionPlayer[];
  /** Points earned THIS round per player */
  roundDeltas: Record<string, number>;
  /** Vote counts per author */
  voteCounts: Record<string, number>;
  firstPlace: string[];
  scores: Record<string, number>;
}

export default function RoundResultsScreen({
  definition,
  roundNumber,
  totalRounds,
  submissions,
  players,
  roundDeltas,
  voteCounts,
  firstPlace,
  scores,
}: RoundResultsScreenProps) {
  const { primary, secondary } = useGameColors();

  const playerMap = useMemo(() => {
    const m = new Map<string, GameSessionPlayer>();
    for (const p of players) m.set(p.uid, p);
    return m;
  }, [players]);

  const getPlayer = (uid: string) => playerMap.get(uid);


  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-4 overflow-y-auto px-4 py-6">
      <DefinitionCard
        definition={definition}
        roundNumber={roundNumber}
        totalRounds={totalRounds}
        compact
      />

      {/* 1st Place */}
      {firstPlace.length > 0 && (
        <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-2xl border bg-black/50 p-5" style={{ borderColor: `${primary}4D`, boxShadow: "inset 0 4px 8px rgba(0,0,0,0.5), inset 0 -2px 4px rgba(255,255,255,0.1)" }}>
          {firstPlace.map((uid, idx) => {
            const p = getPlayer(uid);
            return (
              <div key={uid} className="flex w-full flex-col items-center">
                {idx > 0 && (
                  <hr className="mb-4 w-full border-white/15" />
                )}
                {/* Top row: left labels / avatar / right labels — all top-aligned */}
                <div className="flex w-full items-start gap-3">
                  {/* Left: Winner + name, right-aligned */}
                  <div className="z-10 flex min-w-0 flex-1 flex-col items-end" style={{ paddingTop: 26 }}>
                    <p className="h-5 text-sm font-black uppercase tracking-widest leading-5" style={{ color: primary }}>
                      {firstPlace.length >= 2 ? "Tie" : "Winner"}
                    </p>
                    <p className="mt-1 text-xl font-black leading-tight" style={{ color: secondary }}>{p?.gamertag ?? uid}</p>
                  </div>
                  {/* Center: Avatar */}
                  <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-full bg-black">
                    <div className="shrink-0" style={{ margin: -12 }}>
                      <JMAvatarView width={136} avatarName={p?.avatarName ?? "default"} />
                    </div>
                  </div>
                  {/* Right: Votes + points, left-aligned */}
                  <div className="z-10 flex min-w-0 flex-1 flex-col items-start" style={{ paddingTop: 26 }}>
                    <p className="h-5 text-sm font-black uppercase tracking-widest leading-5" style={{ color: primary }}>
                      {voteCounts[uid] ?? 0} {(voteCounts[uid] ?? 0) === 1 ? "vote" : "votes"}
                    </p>
                    <p className="mt-1 text-sm font-black uppercase tracking-widest leading-tight" style={{ color: secondary }}>
                      +{roundDeltas[uid] ?? 0} pts
                    </p>
                  </div>
                </div>
                {/* Winning word — overlaps bottom of avatar */}
                <p className="-mt-4 z-10 text-2xl font-black lowercase tracking-wider" style={{ color: primary }}>
                  &ldquo;{submissions[uid]}&rdquo;
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Everyone's words — who made what (part of the fun) */}
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-black/40 px-4 py-3" style={{ boxShadow: "inset 0 4px 8px rgba(0,0,0,0.5), inset 0 -2px 4px rgba(255,255,255,0.1)" }}>
        <p className="mb-2 text-center text-xs font-black uppercase tracking-widest text-white/50">
          The Words
        </p>
        <div className="flex flex-col gap-2">
          {Object.entries(submissions)
            .sort((a, b) => (voteCounts[b[0]] ?? 0) - (voteCounts[a[0]] ?? 0))
            .map(([uid, word]) => {
              const p = getPlayer(uid);
              const isWinner = firstPlace.includes(uid);
              const v = voteCounts[uid] ?? 0;
              return (
                <div
                  key={uid}
                  className="flex items-center gap-3 rounded-lg px-2 py-1.5"
                  style={isWinner ? { backgroundColor: `${primary}1A` } : undefined}
                >
                  <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-black">
                    <JMAvatarView width={32} avatarName={p?.avatarName ?? "default"} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-base font-black lowercase tracking-wider"
                      style={{ color: isWinner ? primary : "#ffffff" }}
                    >
                      &ldquo;{word}&rdquo;
                    </p>
                    <p className="truncate text-xs font-bold" style={{ color: secondary }}>
                      {p?.gamertag ?? uid}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-black tabular-nums text-white/60">
                    {v} {v === 1 ? "vote" : "votes"}
                  </span>
                </div>
              );
            })}
        </div>
      </div>

      {/* Leaderboard */}
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-black/40 px-4 py-3" style={{ boxShadow: "inset 0 4px 8px rgba(0,0,0,0.5), inset 0 -2px 4px rgba(255,255,255,0.1)" }}>
        <p className="mb-2 text-center text-xs font-black uppercase tracking-widest text-white/50">
          Leaderboard
        </p>
        <div className="flex flex-col gap-2">
          {[...players]
            .sort((a, b) => (scores[b.uid] ?? 0) - (scores[a.uid] ?? 0))
            .map((p) => (
              <div key={p.uid} className="flex items-center gap-3">
                <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-black">
                  <JMAvatarView width={32} avatarName={p.avatarName ?? "default"} />
                </div>
                <span className="min-w-0 flex-1 truncate text-sm font-black" style={{ color: secondary }}>{p.gamertag}</span>
                <span className="text-sm font-black tabular-nums" style={{ color: primary }}>
                  {scores[p.uid] ?? 0}
                </span>
              </div>
            ))}
        </div>
      </div>

      {/* Server-authoritative: the engine advances after the results hold. */}
      <p className="mt-2 text-center text-sm font-semibold text-white">
        {roundNumber < totalRounds ? "Next round starting" : "Final results"}&hellip;
      </p>
    </div>
  );
}
