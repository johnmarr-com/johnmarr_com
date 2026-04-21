"use client";

import JMAvatarView from "./JMAvatarView";

export interface JMWinnerLoserCardProps {
  /** "winner" or "loser" — controls title text and default colors */
  variant: "winner" | "loser";
  /** Title displayed above the avatar (e.g. "Winner!", "Loser!") */
  title?: string;
  /** Color for the title */
  titleColor?: string;
  /** Player's avatar name */
  avatarName: string;
  /** Player's gamertag / display name */
  name: string;
  /** Color for the name */
  nameColor?: string;
  /** Subtitle below the name (e.g. "12 points!") */
  subtitle?: string;
  /** Color for the subtitle */
  subtitleColor?: string;
}

const DEFAULTS = {
  winner: {
    title: "Winner!",
    titleColor: "#8eff0e",
    nameColor: "#00fffc",
    subtitleColor: "#8eff0e",
  },
  loser: {
    title: "Loser!",
    titleColor: "#ff4444",
    nameColor: "#ffffff",
    subtitleColor: "#ff4444",
  },
};

export function JMWinnerLoserCard({
  variant,
  title,
  titleColor,
  avatarName,
  name,
  nameColor,
  subtitle,
  subtitleColor,
}: JMWinnerLoserCardProps) {
  const d = DEFAULTS[variant];
  const resolvedTitle = title ?? d.title;
  const resolvedTitleColor = titleColor ?? d.titleColor;
  const resolvedNameColor = nameColor ?? d.nameColor;
  const resolvedSubtitleColor = subtitleColor ?? d.subtitleColor;

  return (
    <div className="flex flex-col items-center">
      {/* Title */}
      <h1
        className="relative z-20 text-6xl font-black uppercase tracking-wider sm:text-7xl"
        style={{
          color: resolvedTitleColor,
          filter: `drop-shadow(0 0 16px ${resolvedTitleColor}40)`,
        }}
      >
        {resolvedTitle}
      </h1>

      {/* Avatar */}
      <div className="relative -mt-14 h-72 w-72">
        {/* Solid circle behind the avatar to prevent transparency bleed-through.
            Matches JMAvatarView's internal circle (90% of 288 = 259px). */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black"
          style={{ width: 259, height: 259 }}
        />
        <div className="relative">
          <JMAvatarView width={288} avatarName={avatarName} />
        </div>
      </div>

      {/* Name + subtitle */}
      <div className="relative z-10 -mt-14 flex flex-col items-center gap-1">
        <p
          className="text-center text-4xl font-black uppercase tracking-wider"
          style={{
            color: resolvedNameColor,
            filter: "drop-shadow(0 0 8px rgba(0,0,0,0.5))",
          }}
        >
          {name}
        </p>
        {subtitle && (
          <p
            className="text-center text-xl font-black uppercase tracking-wider"
            style={{ color: resolvedSubtitleColor }}
          >
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
