"use client";

import { JMBannerText } from "@/JMKit";

interface GameSectionHeaderProps {
  eyebrow?: string;
  title: string;
  /** Wrap title in a JMBannerText polygon */
  useBanner?: boolean;
  /** Border color for JMBannerText (defaults to green) */
  bannerBorderColor?: string;
  /** Title text color class (defaults to text-green-400) */
  titleColorClass?: string;
  /** Eyebrow text color class (defaults to text-green-400/70) */
  eyebrowColorClass?: string;
}

export function GameSectionHeader({
  eyebrow,
  title,
  useBanner = false,
  bannerBorderColor = "rgba(34, 197, 94, 0.4)",
  titleColorClass = "text-green-400",
  eyebrowColorClass = "text-green-400/70",
}: GameSectionHeaderProps) {
  const titleEl = (
    <h1 className={`px-4 py-2 text-2xl font-black uppercase tracking-wider ${titleColorClass}`}>
      {title}
    </h1>
  );

  return (
    <div className="text-center">
      {eyebrow && (
        <p className={`mb-1 text-xs font-bold uppercase tracking-[0.3em] ${eyebrowColorClass}`}>
          {eyebrow}
        </p>
      )}
      {useBanner ? (
        <JMBannerText borderColor={bannerBorderColor}>{titleEl}</JMBannerText>
      ) : (
        titleEl
      )}
    </div>
  );
}
