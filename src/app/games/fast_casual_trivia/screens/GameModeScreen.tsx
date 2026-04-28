"use client";

import { useState } from "react";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import type { JMContent } from "@/lib/content-types";
import { GameBgUnderlay, useGameColors } from "@/app/games/_gamecore";
import { JMNumberPickerPopup } from "@/JMKit";
import { contrastTextColor, type FctMode } from "../fastCasualTriviaTypes";

const MODE_IMG_SINGLE = "/images/games/trivia/GameMode_Players.jpg";
const MODE_IMG_FULL_TEAM = "/images/games/trivia/GameMode_Team.jpg";
const MODE_IMG_TEAM_LEADS = "/images/games/trivia/GameMode_TeamLead.jpg";

interface GameModeScreenProps {
  isHost: boolean;
  gameData: JMContent;
  /** Total players in the lobby (host + guests). Drives auto team count for Team Leads. */
  playerCount: number;
  onSelect: (mode: FctMode, teamCount: number) => Promise<void>;
}

const FULL_TEAM_OPTIONS = [2, 3, 4];

export function GameModeScreen({
  isHost,
  gameData,
  playerCount,
  onSelect,
}: GameModeScreenProps) {
  const colors = useGameColors();
  const [selectedMode, setSelectedMode] = useState<FctMode | null>(null);
  /** Number of teams chosen for Full Team mode. 0 = none chosen yet. */
  const [fullTeamCount, setFullTeamCount] = useState<number>(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const bgURL = gameData.splashBgURL;
  const bgDim = gameData.splashBgDim ?? 50;

  const submit = async (mode: FctMode, count: number) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onSelect(mode, count);
    } catch {
      setSubmitting(false);
    }
  };

  const handleSinglePlay = () => {
    void submit("single", 0);
  };

  const handleTeamLeads = () => {
    // Every player is a team lead — count = number of players.
    const count = Math.max(2, playerCount);
    setSelectedMode("team_leads");
    void submit("team_leads", count);
  };

  const handleFullTeamCountPick = (n: number) => {
    setFullTeamCount(n);
    setPickerOpen(false);
    // Auto-advance — no intermediate Next button.
    void submit("full_team", n);
  };

  if (!isHost) {
    return (
      <div className="fixed inset-0 z-10 flex items-center justify-center overflow-hidden bg-black">
        <GameBgUnderlay url={bgURL} />
        <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${bgDim / 100})` }} />
        <div className="relative z-10 flex flex-col items-center gap-3 text-center text-white">
          <Loader2 size={28} className="animate-spin opacity-60" />
          <p className="text-base font-semibold">Waiting for the host to choose a mode…</p>
        </div>
      </div>
    );
  }

  const fullTeamSelected = selectedMode === "full_team";

  return (
    <div className="fixed inset-0 z-10 overflow-y-auto bg-black">
      <GameBgUnderlay url={bgURL} />
      <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${bgDim / 100})` }} />

      <div className="relative z-10 mx-auto flex min-h-full w-full max-w-md flex-col gap-4 px-5 py-8 text-white">
        <header className="text-center">
          <h1 className="text-2xl font-extrabold">Choose a mode</h1>
          <p className="mt-1 text-sm text-white/70">How do you want this room to play?</p>
        </header>

        {/* SINGLE PLAY */}
        <ModeSection title="Single Play" panelColor={colors.primary}>
          <ModeButton
            imageSrc={MODE_IMG_SINGLE}
            label="Single Play"
            description="Every person's device is connected. Every player plays for themself."
            selected={selectedMode === "single"}
            primaryColor={colors.primary}
            onTap={handleSinglePlay}
            loading={submitting && selectedMode === "single"}
          />
        </ModeSection>

        {/* TEAMS */}
        <ModeSection title="Teams" panelColor={colors.secondary}>
          <ModeButton
            imageSrc={MODE_IMG_FULL_TEAM}
            label="Full Team"
            description="Every person's device is connected. Every player is part of a team."
            selected={fullTeamSelected}
            primaryColor={colors.primary}
            onTap={() => {
              setSelectedMode("full_team");
              // Reset count so user must re-pick when switching back.
              setFullTeamCount(0);
            }}
          />

          {/* Accordion: team-count selector — only for Full Team. */}
          <div
            className="grid overflow-hidden transition-[grid-template-rows] duration-300 ease-out"
            style={{
              gridTemplateRows: fullTeamSelected ? "1fr" : "0fr",
            }}
          >
            <div className="min-h-0">
              <button
                onClick={() => setPickerOpen(true)}
                disabled={!fullTeamSelected}
                className="mt-2 flex w-full items-center justify-between rounded-xl border px-4 py-3 text-base font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  borderColor: "rgba(255,255,255,0.20)",
                  backgroundColor: "rgba(0,0,0,0.5)",
                  color: "#fff",
                }}
              >
                <span>How many teams?</span>
                <span
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full text-lg font-black tabular-nums"
                  style={{
                    backgroundColor: colors.primary,
                    color: contrastTextColor(colors.primary),
                  }}
                >
                  {fullTeamCount > 0 ? fullTeamCount : "–"}
                </span>
              </button>
            </div>
          </div>

          <ModeButton
            imageSrc={MODE_IMG_TEAM_LEADS}
            label="Team Leads"
            description={`Only Team Leads' devices are connected. Team players gather around their team lead. (${playerCount} ${
              playerCount === 1 ? "team lead" : "team leads"
            } based on this lobby.)`}
            selected={false}
            dimmed={fullTeamSelected}
            primaryColor={colors.primary}
            loading={submitting && selectedMode === "team_leads"}
            onTap={handleTeamLeads}
          />
        </ModeSection>
      </div>

      <JMNumberPickerPopup
        open={pickerOpen}
        value={fullTeamCount > 0 ? fullTeamCount : null}
        options={FULL_TEAM_OPTIONS}
        accentColor={colors.primary}
        onSelect={handleFullTeamCountPick}
        onClose={() => setPickerOpen(false)}
      />
    </div>
  );
}

// ─── Section + button helpers ───────────────────────────────

function ModeSection({
  title,
  panelColor,
  children,
}: {
  title: string;
  panelColor: string;
  children: React.ReactNode;
}) {
  const titleColor = contrastTextColor(panelColor);
  return (
    <section
      className="rounded-2xl border p-4"
      style={{
        backgroundColor: panelColor,
        borderColor: `${panelColor}66`,
      }}
    >
      <h2
        className="mb-3 text-xs font-black uppercase tracking-widest"
        style={{ color: titleColor, opacity: 0.85 }}
      >
        {title}
      </h2>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function ModeButton({
  imageSrc,
  label,
  description,
  selected,
  dimmed = false,
  primaryColor,
  loading = false,
  onTap,
}: {
  imageSrc: string;
  label: string;
  description: string;
  selected: boolean;
  dimmed?: boolean;
  primaryColor: string;
  loading?: boolean;
  onTap: () => void;
}) {
  return (
    <button
      onClick={onTap}
      disabled={loading}
      className="flex w-full items-stretch gap-4 rounded-xl text-left transition-all disabled:opacity-60"
      style={{
        backgroundColor: "rgba(0,0,0,0.5)",
        border: selected ? `3px solid ${primaryColor}` : "1px solid rgba(255,255,255,0.15)",
        padding: selected ? "calc(1rem - 2px)" : "1rem",
        opacity: dimmed ? 0.5 : 1,
      }}
    >
      {/* Square thumbnail — height stretches to match content. No border. */}
      <div
        className="relative aspect-square shrink-0 self-stretch overflow-hidden rounded-xl"
        style={{ minHeight: "140px" }}
      >
        <Image
          src={imageSrc}
          alt={label}
          fill
          className="object-cover"
          sizes="160px"
          unoptimized
        />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <Loader2 size={22} className="animate-spin text-white" />
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <p className="text-lg font-bold" style={{ color: selected ? primaryColor : "#fff" }}>
          {label}
        </p>
        <p className="mt-1 text-sm leading-snug text-white/80">{description}</p>
      </div>
    </button>
  );
}
