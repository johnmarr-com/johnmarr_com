"use client";

import { JMBannerText } from "./JMBannerText";

export interface JMGameScoreboardProps {
  leftLabel: string;
  rightLabel: string;
  leftScore: number;
  rightScore: number;
  pointsToWin: number;
  /** Override the left label + score color classes (defaults to white). */
  leftColorClass?: string;
  /** Override the right label + score color classes (defaults to white). */
  rightColorClass?: string;
  /** Render as an absolute overlay (for use inside a video/canvas container). */
  overlay?: boolean;
}

function ScoreColumn({
  label,
  score,
  colorClass,
  align,
}: {
  label: string;
  score: number;
  colorClass: string;
  align: "start" | "end";
}) {
  return (
    <div className={`flex flex-col ${align === "start" ? "items-start" : "items-end"}`} style={{ gap: 0 }}>
      <span className={`max-w-[110px] truncate text-sm font-extrabold uppercase tracking-wider ${colorClass} opacity-70`}>
        {label}
      </span>
      <span className={`text-6xl font-black tabular-nums leading-none ${colorClass}`}>
        {score}
      </span>
    </div>
  );
}

function CenterBanner({ pointsToWin }: { pointsToWin: number }) {
  return (
    <JMBannerText borderColor="#ffffff" borderWidth={1}>
      <span className="text-sm font-medium uppercase tracking-widest text-white/80">
        First to {pointsToWin}
      </span>
    </JMBannerText>
  );
}

export function JMGameScoreboard({
  leftLabel,
  rightLabel,
  leftScore,
  rightScore,
  pointsToWin,
  leftColorClass = "text-white",
  rightColorClass = "text-white",
  overlay = false,
}: JMGameScoreboardProps) {
  const top = 16;
  const side = 20;

  if (overlay) {
    return (
      <>
        <div className="absolute z-20" style={{ left: side, top }}>
          <ScoreColumn label={leftLabel} score={leftScore} colorClass={leftColorClass} align="start" />
        </div>
        <div className="absolute left-1/2 z-20 -translate-x-1/2 -translate-y-1/2" style={{ top: top + 40 }}>
          <CenterBanner pointsToWin={pointsToWin} />
        </div>
        <div className="absolute z-20" style={{ right: side, top }}>
          <ScoreColumn label={rightLabel} score={rightScore} colorClass={rightColorClass} align="end" />
        </div>
      </>
    );
  }

  // Each score column stacks label (text-sm ~20px) above score (text-6xl 60px),
  // total 80px. The score number's vertical center sits at 20 + 30 = 50px from
  // the top of the column. Anchor the banner there so it visually aligns with
  // the digits rather than the column midline.
  const scoreCenter = 50;

  return (
    <div className="relative mb-2 shrink-0" style={{ height: 80, marginTop: top }}>
      <div className="absolute left-0 top-0" style={{ left: side }}>
        <ScoreColumn label={leftLabel} score={leftScore} colorClass={leftColorClass} align="start" />
      </div>
      <div
        className="absolute left-1/2 z-20 -translate-x-1/2 -translate-y-1/2"
        style={{ top: scoreCenter }}
      >
        <CenterBanner pointsToWin={pointsToWin} />
      </div>
      <div className="absolute right-0 top-0" style={{ right: side }}>
        <ScoreColumn label={rightLabel} score={rightScore} colorClass={rightColorClass} align="end" />
      </div>
    </div>
  );
}
