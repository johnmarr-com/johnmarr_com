"use client";

import { useMemo, useState } from "react";
import { JMAvatarView } from "@/JMKit";
import { useGameColors } from "@/app/games/_gamecore";
import type { GameSessionPlayer } from "@/lib/game-sessions";
import type { LineupReveal } from "../lineupTypes";

interface ResultsScreenProps {
  reveal: LineupReveal;
  factNumber: number;
  totalFacts: number;
  /** voterId → guessed authorId (this round). */
  votes: Record<string, string>;
  players: GameSessionPlayer[];
  /** Cumulative scores. */
  scores: Record<string, number>;
  /** Host-only "Advance" control — skip the results hold and move on now. */
  isHost?: boolean;
  onAdvance?: () => Promise<void>;
}

export default function ResultsScreen({
  reveal,
  factNumber,
  totalFacts,
  votes,
  players,
  scores,
  isHost = false,
  onAdvance,
}: ResultsScreenProps) {
  const { primary, secondary } = useGameColors();
  const [advancing, setAdvancing] = useState(false);

  const handleAdvanceClick = async () => {
    if (advancing || !onAdvance) return;
    setAdvancing(true);
    try {
      await onAdvance();
    } catch {
      setAdvancing(false); // re-enable on failure; the timer is still the fallback
    }
  };

  const playerMap = useMemo(() => {
    const m = new Map<string, GameSessionPlayer>();
    for (const p of players) m.set(p.uid, p);
    return m;
  }, [players]);

  const author = playerMap.get(reveal.authorUid);
  const eligibleCount = Math.max(0, players.length - 1);
  const correctCount = reveal.correctVoterUids.length;

  // Everyone's guess this round (the author doesn't guess their own fact).
  const guesses = Object.entries(votes)
    .filter(([voterUid]) => voterUid !== reveal.authorUid)
    .map(([voterUid, guessedUid]) => ({
      voter: playerMap.get(voterUid),
      voterUid,
      guessed: playerMap.get(guessedUid),
      correct: guessedUid === reveal.authorUid,
      delta: reveal.roundDeltas[voterUid] ?? 0,
    }))
    .sort((a, b) => (a.correct === b.correct ? 0 : a.correct ? -1 : 1));

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-4 overflow-y-auto px-4 pb-6 pt-24">
      {/* Reveal */}
      <div
        className="flex w-full max-w-md flex-col items-center gap-3 rounded-2xl border bg-black/50 p-5"
        style={{ borderColor: `${primary}4D`, boxShadow: "inset 0 4px 8px rgba(0,0,0,0.5), inset 0 -2px 4px rgba(255,255,255,0.1)" }}
      >
        <p className="text-xs font-black uppercase tracking-widest text-white/50">
          Fact {factNumber} of {totalFacts}
        </p>
        <p className="text-center text-lg font-semibold italic text-white">
          &ldquo;{reveal.fact}&rdquo;
        </p>
        <div className="mt-1 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-black">
          <div className="shrink-0" style={{ margin: -10 }}>
            <JMAvatarView width={116} avatarName={author?.avatarName ?? "default"} />
          </div>
        </div>
        <p className="text-sm font-black uppercase tracking-widest" style={{ color: primary }}>
          It was
        </p>
        <p className="-mt-2 text-2xl font-black leading-tight" style={{ color: secondary }}>
          {reveal.authorGamertag}
        </p>
        <p className="mt-1 text-sm font-bold uppercase tracking-wider text-white/70">
          {correctCount}/{eligibleCount} guessed it
        </p>
      </div>

      {/* Who guessed what */}
      {guesses.length > 0 && (
        <div
          className="w-full max-w-md rounded-xl border border-white/10 bg-black/40 px-4 py-3"
          style={{ boxShadow: "inset 0 4px 8px rgba(0,0,0,0.5), inset 0 -2px 4px rgba(255,255,255,0.1)" }}
        >
          <p className="mb-2 text-center text-xs font-black uppercase tracking-widest text-white/50">
            The Guesses
          </p>
          <div className="flex flex-col gap-2">
            {guesses.map((g) => (
              <div
                key={g.voterUid}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5"
                style={g.correct ? { backgroundColor: `${primary}1A` } : undefined}
              >
                <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-black">
                  <JMAvatarView width={32} avatarName={g.voter?.avatarName ?? "default"} />
                </div>
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-white">
                  {g.voter?.gamertag ?? g.voterUid}
                </span>
                <span className="shrink-0 text-xs font-semibold text-white/50">
                  → {g.guessed?.gamertag ?? "—"}
                </span>
                <span
                  className="ml-1 shrink-0 text-sm font-black tabular-nums"
                  style={{ color: g.delta > 0 ? primary : g.delta < 0 ? "#f87171" : "#ffffff60" }}
                >
                  {g.delta > 0 ? `+${g.delta}` : g.delta < 0 ? `${g.delta}` : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <div
        className="w-full max-w-md rounded-xl border border-white/10 bg-black/40 px-4 py-3"
        style={{ boxShadow: "inset 0 4px 8px rgba(0,0,0,0.5), inset 0 -2px 4px rgba(255,255,255,0.1)" }}
      >
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
                <span className="min-w-0 flex-1 truncate text-sm font-black" style={{ color: secondary }}>
                  {p.gamertag}
                </span>
                <span className="text-sm font-black tabular-nums" style={{ color: primary }}>
                  {scores[p.uid] ?? 0}
                </span>
              </div>
            ))}
        </div>
      </div>

      {/* Auto-advances after the hold; the host can skip ahead with Advance. */}
      <p className="mt-2 text-center text-sm font-semibold text-white">
        {factNumber < totalFacts ? "Next fact starting" : "Final results"}&hellip;
      </p>

      {isHost && onAdvance && (
        <button
          onClick={handleAdvanceClick}
          disabled={advancing}
          className="mt-1 w-full max-w-md rounded-xl py-4 text-lg font-black uppercase tracking-wider text-black shadow-lg transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-60"
          style={{ backgroundColor: primary, boxShadow: `0 10px 15px -3px ${primary}40` }}
        >
          {advancing ? "…" : factNumber < totalFacts ? "Advance ▸" : "Show Winner ▸"}
        </button>
      )}
    </div>
  );
}
