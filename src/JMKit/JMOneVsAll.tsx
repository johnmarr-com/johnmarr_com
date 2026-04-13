"use client";

/**
 * One vs All — VS row UI forked from {@link JMTournamentVs} for Bluff Box and future tweaks.
 * `JMTournamentVs` remains the canonical shared component; this copy is safe to diverge.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import JMAvatarView from "./JMAvatarView";

/** Default avatar size for the VS row (2× the previous 72px baseline). */
export const OneVsAll_DEFAULT_AVATAR_WIDTH = 144;

export type OneVsAllRoleTone = "amber" | "blue" | "violet" | "emerald" | "neutral";

export interface OneVsAllSide {
  /** Primary label under the avatar */
  name?: string;
  avatarName?: string;
  /** Passed to {@link JMAvatarView} (default {@link OneVsAll_DEFAULT_AVATAR_WIDTH}) */
  avatarWidth?: number;
  /**
   * Role line (e.g. “SHARING” / “GUESSING”) — plain text in the top corner of the card (no pill).
   */
  roleLabel?: string | null;
  roleTone?: OneVsAllRoleTone;
  /** Smaller line under the gamertag (e.g. “Stand-in”) */
  secondaryBadge?: string;
  /** Show empty / waiting state instead of player */
  empty?: boolean;
  emptyLabel?: string;
}

export interface OneVsAllProps {
  /** Centered above the left player (e.g. static game logo) */
  leftHeader?: ReactNode;
  /** Centered above the right player (e.g. “ROUND 3”) */
  rightHeader?: ReactNode;
  left: OneVsAllSide;
  right: OneVsAllSide;
  /** Center word (default “VS”) */
  vsLabel?: string;
  /** Full-bleed background image behind the matchup (e.g. game splash); opacity via {@link backgroundImageOpacity}. */
  backgroundImageURL?: string;
  /** Opacity of {@link backgroundImageURL} (0–1). Default 0.3 (30% visibility). */
  backgroundImageOpacity?: number;
  className?: string;
  /** Roster, scores, or other content below the matchup row */
  children?: ReactNode;
}

const ROLE_CORNER: Record<OneVsAllRoleTone, string> = {
  amber: "text-amber-200 drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]",
  blue: "text-blue-200 drop-shadow-[0_0_10px_rgba(96,165,250,0.45)]",
  violet: "text-violet-200 drop-shadow-[0_0_10px_rgba(167,139,250,0.4)]",
  emerald: "text-emerald-200 drop-shadow-[0_0_10px_rgba(52,211,153,0.4)]",
  neutral: "text-white/90",
};

/** Middle column width — keep header spacer and VS column aligned */
const VS_COL = "w-[min(6.5rem,18vw)] min-w-[4.75rem] shrink-0";

function SidePanel({
  side,
  align,
}: {
  side: OneVsAllSide;
  align: "left" | "right";
}) {
  const {
    name,
    avatarName,
    avatarWidth = OneVsAll_DEFAULT_AVATAR_WIDTH,
    roleLabel,
    roleTone = "neutral",
    secondaryBadge,
    empty,
    emptyLabel = "Waiting…",
  } = side;

  const gradientRing =
    align === "left"
      ? "from-amber-400/50 via-amber-400/10 to-transparent"
      : "from-blue-400/50 via-blue-400/10 to-transparent";

  const cornerTone = ROLE_CORNER[roleTone] ?? ROLE_CORNER.neutral;

  if (empty || !name) {
    return (
      <div
        className={cn(
          "relative z-10 min-h-56 min-w-0 flex-1 overflow-hidden rounded-2xl p-px",
          align === "left" ? "bg-linear-to-br" : "bg-linear-to-bl",
          gradientRing,
        )}
      >
        <div className="flex h-full min-h-56 flex-col items-center justify-center rounded-2xl bg-neutral-950/80 px-3 py-8 backdrop-blur-md">
          <div className="mb-3 h-28 w-28 rounded-full border border-dashed border-white/15 bg-white/3" />
          <span className="text-sm font-medium tracking-wide text-white/35">{emptyLabel}</span>
        </div>
      </div>
    );
  }

  const showRole = Boolean(roleLabel);

  return (
    <div
      className={cn(
        "relative z-10 min-h-56 min-w-0 flex-1 overflow-hidden rounded-2xl p-px shadow-lg",
        align === "left" ? "bg-linear-to-br" : "bg-linear-to-bl",
        gradientRing,
      )}
    >
      <div
        className={cn(
          "relative flex min-h-56 flex-col items-center justify-center gap-2 rounded-2xl px-4 pb-6 pt-10 backdrop-blur-md",
          align === "left"
            ? "bg-linear-to-b from-amber-950/40 to-neutral-950/90"
            : "bg-linear-to-b from-blue-950/40 to-neutral-950/90",
        )}
      >
        {showRole && (
          <span
            className={cn(
              "pointer-events-none absolute left-1/2 top-3 z-10 max-w-[min(100%,12rem)] -translate-x-1/2 text-center text-[11px] font-black uppercase leading-tight tracking-[0.18em]",
              cornerTone,
            )}
          >
            {roleLabel}
          </span>
        )}
        <div
          className={cn(
            "relative rounded-full p-[2px]",
            align === "left"
              ? "bg-linear-to-br from-amber-300/60 to-amber-600/20 shadow-[0_0_36px_rgba(251,191,36,0.22)]"
              : "bg-linear-to-br from-blue-300/60 to-blue-700/20 shadow-[0_0_36px_rgba(96,165,250,0.22)]",
          )}
        >
          <div className="overflow-hidden rounded-full bg-neutral-950">
            <JMAvatarView width={avatarWidth} avatarName={avatarName ?? "default"} />
          </div>
        </div>
        <p className="max-w-full truncate px-1 text-center text-xl font-extrabold tracking-tight text-white sm:text-2xl">
          {name}
        </p>
        {secondaryBadge && (
          <span className="text-center text-[11px] font-bold uppercase tracking-wider text-yellow-200/95">
            {secondaryBadge}
          </span>
        )}
      </div>
    </div>
  );
}

function VsEmblem({ label }: { label: string }) {
  return (
    <div className="relative flex flex-col items-center justify-center">
      <div
        className="pointer-events-none absolute inset-[-22px] rounded-full bg-linear-to-br from-amber-400/45 via-fuchsia-500/35 to-blue-500/45 blur-2xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-[-12px] rounded-full bg-linear-to-br from-amber-300/55 via-fuchsia-400/50 to-blue-400/55 blur-lg"
        aria-hidden
      />
      <div className="flex h-24 w-24 items-center justify-center rounded-full border border-white/25 bg-linear-to-b from-white/12 to-black/50 p-px shadow-[0_8px_32px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-md sm:h-28 sm:w-28">
        <div className="flex h-full w-full items-center justify-center rounded-full bg-black/55">
          <span
            className="select-none bg-linear-to-b from-white via-white to-white/55 bg-clip-text text-2xl font-black italic tracking-tight text-transparent drop-shadow-[0_2px_8px_rgba(255,255,255,0.25)] sm:text-3xl"
            style={{ fontFamily: "system-ui, sans-serif" }}
          >
            {label}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Bracket-style **VS** row: optional column headers (logo / round), two fighters, center emblem.
 * Role labels are centered at the top of each side; avatar + gamertag stay centered.
 */
export function OneVsAll({
  leftHeader,
  rightHeader,
  left,
  right,
  vsLabel = "VS",
  backgroundImageURL,
  backgroundImageOpacity = 0.3,
  className,
  children,
}: OneVsAllProps) {
  const showTopRow = leftHeader != null || rightHeader != null;
  const bgOpacity =
    Number.isFinite(backgroundImageOpacity) && backgroundImageOpacity >= 0 && backgroundImageOpacity <= 1
      ? backgroundImageOpacity
      : 0.3;

  return (
    <div className={cn("relative flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-3 sm:px-4", className)}>
      {backgroundImageURL != null && backgroundImageURL.length > 0 ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(${backgroundImageURL})`,
            opacity: bgOpacity,
          }}
        />
      ) : null}

      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        {showTopRow && (
          <div className="-mx-3 mb-2 px-[25px] sm:-mx-4">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3">
              <div className="flex min-w-0 items-center justify-start">{leftHeader}</div>
              <div className={VS_COL} aria-hidden />
              <div className="flex min-w-0 items-center justify-end">{rightHeader}</div>
            </div>
          </div>
        )}

        <div className="mb-4 grid min-h-0 grid-cols-[1fr_auto_1fr] items-stretch gap-2 sm:gap-3">
          <SidePanel side={left} align="left" />
          <div className={cn(VS_COL, "relative z-0 flex min-h-0 items-center justify-center")}>
            <VsEmblem label={vsLabel} />
          </div>
          <SidePanel side={right} align="right" />
        </div>

        {children != null ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
        ) : null}
      </div>
    </div>
  );
}
