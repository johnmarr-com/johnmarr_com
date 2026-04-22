"use client";

import Image from "next/image";
import { JMAvatarView } from "@/JMKit";
import { useGameColors } from "@/app/games/_gamecore";
import type { GameSessionPlayer } from "@/lib/game-sessions";

interface BlarferRevealScreenProps {
  players: GameSessionPlayer[];
  blarfers: string[];
  assignments: Record<string, string>;
  votes: Record<string, string[]>;
  roundDeltas: Record<string, number>;
  voteCounts: Record<string, number>;
  detectedBlarfers: string[];
  undetectedBlarfers: string[];
  scores: Record<string, number>;
  roundNumber: number;
  totalRounds: number;
  isHost: boolean;
  revealed: boolean;
  onReveal: () => void;
  onContinue: () => void;
}

export default function BlarferRevealScreen({
  players,
  blarfers,
  votes,
  roundDeltas,
  detectedBlarfers,
  scores,
  roundNumber,
  totalRounds,
  isHost,
  revealed,
  onReveal,
  onContinue,
}: BlarferRevealScreenProps) {

  const { primary, danger } = useGameColors();

  // Players sorted by score descending
  const sortedPlayers = [...players].sort(
    (a, b) => (scores[b.uid] ?? 0) - (scores[a.uid] ?? 0),
  );

  // Count correct voters for a blarfer
  const getCorrectVoters = (blarferUid: string): GameSessionPlayer[] => {
    const voterUids: string[] = [];
    for (const [voterId, targets] of Object.entries(votes)) {
      if (targets.includes(blarferUid)) voterUids.push(voterId);
    }
    return players.filter((p) => voterUids.includes(p.uid));
  };

  const blarferLabel = blarfers.length === 1
    ? "the Blarfer"
    : `the ${blarfers.length} Blarfers`;

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-4 overflow-y-auto px-4 pt-[calc(1.5rem+75px)] pb-6">
      {/* Header */}
      <p className="text-lg font-black uppercase tracking-widest" style={{ color: primary }}>
        Round {roundNumber}/{totalRounds}
      </p>

      {!revealed ? (
        <>
          {isHost ? (
            <div className="flex w-full max-w-md flex-col items-center gap-5 py-4">
              <p className="text-center text-xl font-black text-white">
                Have {blarferLabel} reveal {blarfers.length === 1 ? "themself" : "themselves"}!
              </p>
              <div className="bf-flip-card w-full max-w-[300px]">
                <div className="bf-flip-card-inner">
                  <div className="bf-flip-card-front">
                    <Image
                      src="/images/games/blarf/Blarf-Vote.png"
                      alt=""
                      width={300}
                      height={300}
                      className="w-full object-contain drop-shadow-lg"
                    />
                  </div>
                  <div className="bf-flip-card-back">
                    <Image
                      src="/images/games/blarf/Blarf-Reveal.png"
                      alt="Reveal the Blarfer"
                      width={300}
                      height={300}
                      className="w-full object-contain drop-shadow-lg"
                    />
                  </div>
                </div>
              </div>
              <p className="text-center text-sm font-bold text-white">
                Let the group react, then show the results.
              </p>
              <button
                onClick={onReveal}
                className="w-full rounded-xl py-4 text-lg font-black uppercase tracking-wider transition-all hover:scale-[1.02] active:scale-95"
                style={{
                  backgroundColor: danger,
                  color: "#ffffff",
                  boxShadow: `0 10px 15px -3px ${danger}40`,
                }}
              >
                Show Results
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center py-8">
              <div className="bf-flip-card w-full max-w-[300px]">
                <div className="bf-flip-card-inner">
                  <div className="bf-flip-card-front">
                    <Image
                      src="/images/games/blarf/Blarf-Vote.png"
                      alt=""
                      width={300}
                      height={300}
                      className="w-full object-contain drop-shadow-lg"
                    />
                  </div>
                  <div className="bf-flip-card-back">
                    <Image
                      src="/images/games/blarf/Blarf-Reveal.png"
                      alt="Reveal the Blarfer"
                      width={300}
                      height={300}
                      className="w-full object-contain drop-shadow-lg"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Blarfer cards */}
          {blarfers.map((blarferUid, i) => {
            const blarfer = players.find((p) => p.uid === blarferUid);
            const detected = detectedBlarfers.includes(blarferUid);
            const correctVoters = getCorrectVoters(blarferUid);
            const delta = roundDeltas[blarferUid] ?? 0;

            return (
              <div
                key={blarferUid}
                className="w-full max-w-md animate-[bf-reveal-in_0.5s_ease-out_both] rounded-2xl border-2 p-5 shadow-lg"
                style={{
                  borderColor: detected ? "rgba(239,68,68,0.4)" : "rgba(34,197,94,0.4)",
                  backgroundColor: detected ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.1)",
                  animationDelay: `${i * 200}ms`,
                }}
              >
                <div className="flex items-center gap-4">
                  <div className="h-24 w-24 shrink-0 animate-gentle-pulse overflow-hidden rounded-full bg-black/30 ring-4 ring-red-500/50">
                    <JMAvatarView width={96} avatarName={blarfer?.avatarName ?? "default"} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xl font-black text-white">
                      {blarfer?.gamertag ?? "???"}
                    </p>
                    <p
                      className="text-sm font-black uppercase tracking-wider"
                      style={{ color: danger }}
                    >
                      BLARFER!
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-black tabular-nums ${delta >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {delta >= 0 ? `+${delta}` : delta}
                    </p>
                  </div>
                </div>

                <div className="mt-3 rounded-lg bg-black/20 px-3 py-2">
                  {detected ? (
                    <p className="text-sm font-bold text-red-300">
                      Detected by {correctVoters.map((p) => p.gamertag).join(", ")}
                    </p>
                  ) : (
                    <p className="text-sm font-bold text-green-300">
                      Went undetected! +3 bonus
                    </p>
                  )}
                </div>
              </div>
            );
          })}

          {/* Scoreboard */}
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-black/40 px-4 py-3 shadow-lg">
            <p className="mb-2 text-center text-xs font-black uppercase tracking-widest text-white/50">
              Scores
            </p>
            <div className="flex flex-col gap-2">
              {sortedPlayers.map((p) => {
                const delta = roundDeltas[p.uid] ?? 0;
                const isBlarfer = blarfers.includes(p.uid);
                return (
                  <div key={p.uid} className="flex items-center gap-3">
                    <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-black">
                      <JMAvatarView width={32} avatarName={p.avatarName ?? "default"} />
                    </div>
                    <span className="min-w-0 flex-1 truncate text-sm font-black text-white">
                      {p.gamertag}
                      {isBlarfer && (
                        <span className="ml-1.5 text-xs font-bold text-red-400">(BLARFER)</span>
                      )}
                    </span>
                    {delta !== 0 && (
                      <span className={`text-xs font-bold tabular-nums ${delta > 0 ? "text-green-400" : "text-red-400"}`}>
                        {delta > 0 ? `+${delta}` : delta}
                      </span>
                    )}
                    <span
                      className="text-sm font-black tabular-nums"
                      style={{ color: primary }}
                    >
                      {scores[p.uid] ?? 0}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Host continue */}
          {isHost && (
            <button
              onClick={onContinue}
              className="mt-2 w-full max-w-md rounded-xl py-4 text-lg font-black uppercase tracking-wider text-black transition-all hover:scale-[1.02] active:scale-95"
              style={{ backgroundColor: primary }}
            >
              {roundNumber < totalRounds ? "Next Round" : "See Winner"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
