"use client";

import { useState, useCallback, useMemo } from "react";
import type { GameSession } from "@/lib/game-sessions";
import type { SevynTeam, SevynTeamRoster } from "../sevynTypes";
import { GameSectionHeader, GamePrimaryButton } from "@/app/games/_gamecore";
import { useAuth } from "@/lib/AuthProvider";
import { SEVYN_COLORS } from "../SevynGame";

interface BossSelectScreenProps {
  session: GameSession;
  teams: Record<SevynTeam, SevynTeamRoster>;
  isHost: boolean;
  /** Logo URLs from draft (persisted during team formation) */
  draftT1Logo?: string | null;
  draftT2Logo?: string | null;
  onElected: (s1Boss: string, s2Boss: string) => void;
  onBack?: (() => void) | undefined;
}

// ─── Shared components ─────────────────────────────────────

function TeamLogo({ logoUrl, color }: { logoUrl: string; color: string }) {
  return (
    <div className="mb-3 flex justify-center">
      <div
        className="relative aspect-square w-[160px] max-w-[75%] shrink-0 overflow-hidden rounded-full"
        style={{ backgroundColor: `${color}20` }}
      >
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${logoUrl})` }}
        />
        <div
          className="absolute inset-0"
          style={{ backgroundColor: color, mixBlendMode: "color" }}
        />
      </div>
    </div>
  );
}

function VsBadge() {
  return (
    <div
      className="pointer-events-none absolute left-1/2 z-10 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full border-2 border-white/20 bg-black text-xs font-black text-white"
      style={{ top: "calc((160px + 12px) / 2 - 20px + 12px)" }}
    >
      VS
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────

export default function BossSelectScreen({
  session,
  teams,
  isHost,
  draftT1Logo,
  draftT2Logo,
  onElected,
  onBack,
}: BossSelectScreenProps) {
  const { user } = useAuth();
  const myUid = user?.uid ?? "";

  const [boss1, setBoss1] = useState<string | null>(null);
  const [boss2, setBoss2] = useState<string | null>(null);

  const playerMap = useMemo(() => {
    const m = new Map<string, string>();
    session.players.forEach((p) => m.set(p.uid, p.gamertag));
    return m;
  }, [session.players]);

  const t1Members = teams.syndicate1.members;
  const t2Members = teams.syndicate2.members;

  const canLaunch = boss1 != null && boss2 != null;

  const handleLaunch = useCallback(() => {
    if (!canLaunch) return;
    onElected(boss1, boss2);
  }, [canLaunch, boss1, boss2, onElected]);

  // ─── Non-host: spectator view ─────────────────────────────

  if (!isHost) {
    return (
      <div className="flex min-h-dvh flex-col items-center px-4 py-16">
        <div className="w-full max-w-lg">
          <GameSectionHeader
            eyebrow="SEVYN"
            title="Selecting Bosses"
            titleColorClass="text-[#E84C1E]"
            eyebrowColorClass="text-[#E84C1E]/70"
          />

          <div className="relative mt-6 grid grid-cols-2 gap-3">
            <VsBadge />

            {/* Team 1 */}
            <div className="min-h-[200px] rounded-xl border-2 border-dashed border-[#E84C1E]/30 bg-[#E84C1E]/10 p-3">
              {draftT1Logo && <TeamLogo logoUrl={draftT1Logo} color={SEVYN_COLORS.t1} />}
              <div className="space-y-2">
                {t1Members.map((uid) => (
                  <div
                    key={uid}
                    className="flex items-center justify-center gap-1.5 rounded-full bg-black/30 px-3 py-2.5 text-sm font-semibold text-white"
                  >
                    {uid === myUid && <span className="text-yellow-400">&#9733;</span>}
                    {playerMap.get(uid) ?? uid}
                  </div>
                ))}
              </div>
            </div>

            {/* Team 2 */}
            <div className="min-h-[200px] rounded-xl border-2 border-dashed border-blue-400/30 bg-blue-400/10 p-3">
              {draftT2Logo && <TeamLogo logoUrl={draftT2Logo} color={SEVYN_COLORS.t2} />}
              <div className="space-y-2">
                {t2Members.map((uid) => (
                  <div
                    key={uid}
                    className="flex items-center justify-center gap-1.5 rounded-full bg-black/30 px-3 py-2.5 text-sm font-semibold text-white"
                  >
                    {uid === myUid && <span className="text-yellow-400">&#9733;</span>}
                    {playerMap.get(uid) ?? uid}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-white/40 animate-pulse">
            Host is selecting bosses...
          </p>
        </div>
      </div>
    );
  }

  // ─── Host: boss selection view ────────────────────────────

  return (
    <div className="flex min-h-dvh flex-col items-center px-4 py-16">
      {onBack && (
        <button
          className="absolute left-4 top-4 z-20 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/70 hover:bg-white/20"
          onClick={onBack}
        >
          &larr; Edit Teams
        </button>
      )}
      <div className="w-full max-w-lg">
        <GameSectionHeader
          eyebrow="SEVYN"
          title="Select Bosses"
          titleColorClass="text-[#E84C1E]"
          eyebrowColorClass="text-[#E84C1E]/70"
        />

        <div className="relative mt-6 grid grid-cols-2 gap-3">
          <VsBadge />

          {/* Team 1 */}
          <div className="min-h-[200px] rounded-xl border-2 border-dashed border-[#E84C1E]/30 bg-[#E84C1E]/10 p-3">
            {draftT1Logo && <TeamLogo logoUrl={draftT1Logo} color={SEVYN_COLORS.t1} />}
            <div className="space-y-2">
              {t1Members.map((uid) => {
                const isBoss = boss1 === uid;
                return (
                  <button
                    key={uid}
                    className={`w-full rounded-full px-3 py-2.5 text-center text-sm font-semibold transition ${
                      isBoss
                        ? "bg-yellow-400 text-black"
                        : "bg-black/30 text-white hover:bg-black/50"
                    }`}
                    onClick={() => setBoss1(isBoss ? null : uid)}
                  >
                    {playerMap.get(uid) ?? uid}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Team 2 */}
          <div className="min-h-[200px] rounded-xl border-2 border-dashed border-blue-400/30 bg-blue-400/10 p-3">
            {draftT2Logo && <TeamLogo logoUrl={draftT2Logo} color={SEVYN_COLORS.t2} />}
            <div className="space-y-2">
              {t2Members.map((uid) => {
                const isBoss = boss2 === uid;
                return (
                  <button
                    key={uid}
                    className={`w-full rounded-full px-3 py-2.5 text-center text-sm font-semibold transition ${
                      isBoss
                        ? "bg-yellow-400 text-black"
                        : "bg-black/30 text-white hover:bg-black/50"
                    }`}
                    onClick={() => setBoss2(isBoss ? null : uid)}
                  >
                    {playerMap.get(uid) ?? uid}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Launch */}
        <div className="mt-6">
          <GamePrimaryButton onClick={handleLaunch} disabled={!canLaunch}>
            {canLaunch ? "Launch Heist" : "Select a Boss for each team"}
          </GamePrimaryButton>
        </div>
      </div>
    </div>
  );
}
