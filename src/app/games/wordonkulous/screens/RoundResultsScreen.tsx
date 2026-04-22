"use client";

import { useEffect, useRef, useMemo } from "react";
import { JMAvatarView } from "@/JMKit";
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
  isHost: boolean;
  onContinue: () => void;
}

const AUTO_ADVANCE_MS = 0; // disabled for dev

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
  isHost,
  onContinue,
}: RoundResultsScreenProps) {
  const autoRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Host auto-advance
  useEffect(() => {
    if (!isHost || AUTO_ADVANCE_MS <= 0) return;
    autoRef.current = setTimeout(onContinue, AUTO_ADVANCE_MS);
    return () => { if (autoRef.current) clearTimeout(autoRef.current); };
  }, [isHost, onContinue]);

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
        <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-2xl border bg-black/50 p-5" style={{ borderColor: "rgba(142,255,14,0.3)", boxShadow: "inset 0 4px 8px rgba(0,0,0,0.5), inset 0 -2px 4px rgba(255,255,255,0.1)" }}>
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
                    <p className="h-5 text-sm font-black uppercase tracking-widest leading-5" style={{ color: "#8eff0e" }}>
                      {firstPlace.length >= 2 ? "Tie" : "Winner"}
                    </p>
                    <p className="mt-1 text-xl font-black leading-tight" style={{ color: "#00fffc" }}>{p?.gamertag ?? uid}</p>
                  </div>
                  {/* Center: Avatar */}
                  <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-full bg-black">
                    <div className="shrink-0" style={{ margin: -12 }}>
                      <JMAvatarView width={136} avatarName={p?.avatarName ?? "default"} />
                    </div>
                  </div>
                  {/* Right: Votes + points, left-aligned */}
                  <div className="z-10 flex min-w-0 flex-1 flex-col items-start" style={{ paddingTop: 26 }}>
                    <p className="h-5 text-sm font-black uppercase tracking-widest leading-5" style={{ color: "#8eff0e" }}>
                      {voteCounts[uid] ?? 0} {(voteCounts[uid] ?? 0) === 1 ? "vote" : "votes"}
                    </p>
                    <p className="mt-1 text-sm font-black uppercase tracking-widest leading-tight" style={{ color: "#00fffc" }}>
                      +{roundDeltas[uid] ?? 0} pts
                    </p>
                  </div>
                </div>
                {/* Winning word — overlaps bottom of avatar */}
                <p className="-mt-4 z-10 text-2xl font-black lowercase tracking-wider" style={{ color: "#8eff0e" }}>
                  &ldquo;{submissions[uid]}&rdquo;
                </p>
              </div>
            );
          })}
        </div>
      )}

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
                <span className="min-w-0 flex-1 truncate text-sm font-black" style={{ color: "#00fffc" }}>{p.gamertag}</span>
                <span className="text-sm font-black tabular-nums" style={{ color: "#8eff0e" }}>
                  {scores[p.uid] ?? 0}
                </span>
              </div>
            ))}
        </div>
      </div>

      {/* Continue button (host only) */}
      {isHost && (
        <button
          onClick={() => {
            if (autoRef.current) clearTimeout(autoRef.current);
            onContinue();
          }}
          className="mt-2 w-full max-w-md rounded-xl py-4 text-lg font-bold uppercase tracking-wider text-black shadow-lg transition-all hover:scale-[1.02] active:scale-95"
          style={{ backgroundColor: "#8eff0e", boxShadow: "0 10px 15px -3px rgba(142,255,14,0.25)" }}
        >
          {roundNumber < totalRounds ? "Next Round" : "Final Results"}
        </button>
      )}

      {!isHost && (
        <p className="mt-2 text-center text-sm font-semibold text-white">
          Waiting for host to continue&hellip;
        </p>
      )}
    </div>
  );
}
