"use client";

import type { GameSession } from "@/lib/game-sessions";
import type { SevynHeist, SevynTeam, SevynTeamRoster } from "../sevynTypes";
import { GameSectionHeader } from "@/app/games/_gamecore";
import { JMConfettiOverlay } from "@/JMKit";
import { SEVYN_COLORS } from "../SevynGame";
import { useMemo } from "react";

interface WinScreenProps {
  heist: SevynHeist;
  winningTeam: SevynTeam | null;
  loseByBomb: boolean;
  teams: Record<SevynTeam, SevynTeamRoster> | null;
  session: GameSession;
  t1Score: number;
  t2Score: number;
  t1Name?: string;
  t2Name?: string;
}

export default function WinScreen({
  heist,
  winningTeam,
  loseByBomb,
  teams,
  session,
  t1Score,
  t2Score,
  t1Name,
  t2Name,
}: WinScreenProps) {
  const playerMap = useMemo(() => {
    const m = new Map<string, string>();
    session.players.forEach((p) => m.set(p.uid, p.gamertag));
    return m;
  }, [session.players]);

  const winColor = winningTeam === "syndicate1" ? SEVYN_COLORS.t1 : SEVYN_COLORS.t2;
  const winTeamName = winningTeam === "syndicate1" ? (t1Name ?? "Team 1") : (t2Name ?? "Team 2");
  const winMembers = winningTeam && teams ? teams[winningTeam].members : [];

  return (
    <div className={`flex min-h-dvh flex-col items-center px-4 py-16 ${loseByBomb ? "bg-red-950/50" : ""}`}>
      {!loseByBomb && <JMConfettiOverlay />}

      <div className="w-full max-w-lg">
        {/* Target object */}
        {!loseByBomb && heist.targetObjectImageUrl && (
          <div className="mx-auto mb-6 h-40 w-40 overflow-hidden rounded-2xl border-2" style={{ borderColor: winColor }}>
            <div
              className="h-full w-full bg-cover bg-center"
              style={{ backgroundImage: `url(${heist.targetObjectImageUrl})` }}
            />
          </div>
        )}

        {/* Bomb loss */}
        {loseByBomb && heist.bomb.imageUrl && (
          <div className="mx-auto mb-6 h-40 w-40 overflow-hidden rounded-2xl border-2 border-red-600">
            <div
              className="h-full w-full bg-cover bg-center"
              style={{ backgroundImage: `url(${heist.bomb.imageUrl})` }}
            />
          </div>
        )}

        <GameSectionHeader
          eyebrow={heist.title}
          title={loseByBomb ? "The Job Is Over" : `${winTeamName} pulled the job.`}
          titleColorClass={loseByBomb ? "text-red-400" : "text-white"}
          eyebrowColorClass="text-[#E84C1E]/70"
        />

        {/* Score */}
        <div className="mt-6 flex justify-center gap-6">
          <div className="text-center">
            <p className="text-3xl font-black" style={{ color: SEVYN_COLORS.t1 }}>{t1Score}/7</p>
            <p className="text-xs text-white/40">{t1Name ?? "Team 1"}</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-black" style={{ color: SEVYN_COLORS.t2 }}>{t2Score}/7</p>
            <p className="text-xs text-white/40">{t2Name ?? "Team 2"}</p>
          </div>
        </div>

        {/* Winning team members */}
        {winMembers.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wider" style={{ color: winColor }}>
              Winning Team
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {winMembers.map((uid) => (
                <span
                  key={uid}
                  className="rounded-full px-3 py-1 text-sm font-semibold text-white"
                  style={{ backgroundColor: `${winColor}30`, border: `1px solid ${winColor}50` }}
                >
                  {playerMap.get(uid) ?? uid}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Assets collected */}
        <div className="mt-8">
          <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-white/40">
            Mission Assets
          </p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {heist.assets.map((asset, i) => (
              <div key={asset.id} className="text-center">
                {asset.imageUrl ? (
                  <div
                    className="mx-auto h-14 w-14 rounded-lg border bg-cover bg-center"
                    style={{
                      backgroundImage: `url(${asset.imageUrl})`,
                      borderColor: `${winColor}40`,
                    }}
                  />
                ) : (
                  <div
                    className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg border text-xs font-bold"
                    style={{ borderColor: `${winColor}40`, color: winColor }}
                  >
                    {i + 1}
                  </div>
                )}
                <p className="mt-1 text-[9px] leading-tight text-white/50">{asset.name}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
