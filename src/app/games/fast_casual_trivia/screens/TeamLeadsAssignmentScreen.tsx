"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, Loader2 } from "lucide-react";
import type { GameSession } from "@/lib/game-sessions";
import type { JMContent } from "@/lib/content-types";
import {
  GameBgUnderlay,
  GamePrimaryButton,
  pickRandomTeams,
  type TeamIdentity,
  useGameColors,
} from "@/app/games/_gamecore";
import { JMTeamLogoPicker } from "@/JMKit/JMTeamLogoPicker";
import { JMColorPickerPopup } from "@/JMKit";
import {
  FCT_TEAM_COLORS,
  type FctTeam,
  type FctTeamColor,
} from "../fastCasualTriviaTypes";

interface TeamLeadsAssignmentScreenProps {
  isHost: boolean;
  session: GameSession;
  gameData: JMContent;
  onComplete: (teams: FctTeam[]) => Promise<void>;
  onBack: () => Promise<void>;
}

interface LeadAssignment {
  playerId: string;
  playerName: string;
  color: FctTeamColor;
  logo: TeamIdentity;
}

function pickInitialColors(count: number): FctTeamColor[] {
  // Distribute distinct colors. If more leads than the roster, reuse from start.
  const out: FctTeamColor[] = [];
  for (let i = 0; i < count; i++) {
    out.push(FCT_TEAM_COLORS[i % FCT_TEAM_COLORS.length]!);
  }
  return out;
}

export function TeamLeadsAssignmentScreen({
  isHost,
  session,
  gameData,
  onComplete,
  onBack,
}: TeamLeadsAssignmentScreenProps) {
  const colors = useGameColors();
  const bgURL = gameData.splashBgURL;
  const bgDim = gameData.splashBgDim ?? 50;

  const players = session.players;

  const [assignments, setAssignments] = useState<LeadAssignment[]>(() => {
    const initialColors = pickInitialColors(players.length);
    const initialLogos = pickRandomTeams(players.length);
    return players.map((p, i) => ({
      playerId: p.uid,
      playerName: p.gamertag,
      color: initialColors[i]!,
      logo: initialLogos[i]!,
    }));
  });

  const [colorPickerIdx, setColorPickerIdx] = useState<number | null>(null);
  const [logoPickerIdx, setLogoPickerIdx] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const usedColorNames = useMemo(
    () => new Set(assignments.map((a) => a.color.name)),
    [assignments],
  );

  const handleConfirm = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const teams: FctTeam[] = assignments.map((a, i) => ({
        id: `team-${i}`,
        name: a.logo.name,
        colorName: a.color.name,
        colorHex: a.color.hex,
        logoId: a.logo.name,
        leadPlayerId: a.playerId,
        memberPlayerIds: [a.playerId],
      }));
      await onComplete(teams);
    } catch {
      setSubmitting(false);
    }
  };

  // ─── Non-host spectator view ─────────────────────────────

  if (!isHost) {
    return (
      <div className="fixed inset-0 z-10 flex items-center justify-center overflow-hidden bg-black">
        <GameBgUnderlay url={bgURL} />
        <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${bgDim / 100})` }} />
        <div className="relative z-10 flex flex-col items-center gap-3 text-center text-white">
          <Loader2 size={28} className="animate-spin opacity-60" />
          <p className="text-base font-semibold">Host is assigning team leads…</p>
        </div>
      </div>
    );
  }

  // ─── Host interactive view ────────────────────────────────

  return (
    <div className="fixed inset-0 z-10 overflow-y-auto bg-black">
      <GameBgUnderlay url={bgURL} />
      <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${bgDim / 100})` }} />

      <button
        type="button"
        onClick={() => void onBack()}
        aria-label="Back to mode select"
        className="absolute left-3 top-3 z-20 flex h-10 items-center gap-1 rounded-full pl-3 pr-5 text-sm font-semibold transition-colors active:scale-95"
        style={{
          backgroundColor: "rgba(0,0,0,0.5)",
          border: "1px solid rgba(255,255,255,0.20)",
          color: "#fff",
        }}
      >
        <ChevronLeft size={18} strokeWidth={2.5} />
        Back
      </button>

      <div className="relative z-10 mx-auto flex min-h-full w-full max-w-md flex-col px-4 py-8 text-white">
        <header className="text-center">
          <h1 className="text-2xl font-extrabold">Team Leads</h1>
          <p className="mt-1 text-sm text-white/70">
            Each player is a team lead. Tap a color dot or logo to customize.
          </p>
        </header>

        <ul className="mt-5 flex flex-col gap-2">
          {assignments.map((a, i) => (
            <li
              key={a.playerId}
              className="flex items-center gap-3 rounded-xl border p-3"
              style={{
                backgroundColor: "rgba(0,0,0,0.5)",
                borderColor: "rgba(255,255,255,0.15)",
              }}
            >
              {/* Color dot */}
              <button
                type="button"
                aria-label="Change team color"
                onClick={() => setColorPickerIdx(i)}
                className="h-11 w-11 shrink-0 rounded-full transition-transform active:scale-90"
                style={{
                  backgroundColor: a.color.hex,
                  border: "2px solid rgba(255,255,255,0.5)",
                }}
              />

              {/* Team logo */}
              <button
                type="button"
                aria-label="Change team logo"
                onClick={() => setLogoPickerIdx(i)}
                className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full transition-transform active:scale-90"
                style={{ backgroundColor: `${a.color.hex}20` }}
              >
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: `url(${a.logo.logoUrl})` }}
                />
                <div
                  className="absolute inset-0"
                  style={{ backgroundColor: a.color.hex, mixBlendMode: "color" }}
                />
              </button>

              {/* Names */}
              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-sm font-bold uppercase tracking-wider"
                  style={{ color: a.color.hex }}
                >
                  {a.logo.name}
                </p>
                <p className="truncate text-sm font-semibold text-white">{a.playerName}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-6">
          <GamePrimaryButton onClick={handleConfirm} disabled={submitting}>
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                Saving…
              </span>
            ) : (
              "Continue"
            )}
          </GamePrimaryButton>
        </div>
      </div>

      {/* Color picker popup */}
      <JMColorPickerPopup
        open={colorPickerIdx != null}
        colors={FCT_TEAM_COLORS}
        currentName={
          colorPickerIdx != null ? assignments[colorPickerIdx]!.color.name : null
        }
        usedNames={
          colorPickerIdx != null
            ? new Set(
                [...usedColorNames].filter(
                  (n) => n !== assignments[colorPickerIdx]!.color.name,
                ),
              )
            : new Set()
        }
        accentColor={colors.primary}
        onSelect={(picked) => {
          if (colorPickerIdx == null) return;
          const idx = colorPickerIdx;
          setAssignments((prev) =>
            prev.map((a, i) => (i === idx ? { ...a, color: picked } : a)),
          );
          setColorPickerIdx(null);
        }}
        onClose={() => setColorPickerIdx(null)}
      />

      {/* Logo picker popup */}
      {logoPickerIdx != null && (
        <JMTeamLogoPicker
          color={assignments[logoPickerIdx]!.color.hex}
          currentName={assignments[logoPickerIdx]!.logo.name}
          onSelect={(team) => {
            setAssignments((prev) =>
              prev.map((a, i) => (i === logoPickerIdx ? { ...a, logo: team } : a)),
            );
            setLogoPickerIdx(null);
          }}
          onClose={() => setLogoPickerIdx(null)}
        />
      )}
    </div>
  );
}
