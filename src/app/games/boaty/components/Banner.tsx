"use client";

import { useGameColors } from "@/app/games/_gamecore";

interface BannerProps {
  label: "MY SWAMP" | "THEIR SWAMP";
}

/** Yellow banner that overlaps the top edge of the grid. */
export default function Banner({ label }: BannerProps) {
  const { secondary, danger } = useGameColors();
  const isMine = label === "MY SWAMP";
  return (
    <div
      className="relative z-10 mx-auto flex items-center justify-center rounded-xl px-6 py-2 text-center shadow-lg"
      style={{
        backgroundColor: isMine ? secondary : danger,
        aspectRatio: "3 / 1",
        width: "60%",
        maxWidth: 220,
        marginBottom: -16,
      }}
    >
      <p className="text-base font-black uppercase tracking-wider text-black sm:text-lg">
        {label}
      </p>
    </div>
  );
}
