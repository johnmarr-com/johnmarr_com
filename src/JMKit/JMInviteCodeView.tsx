"use client";

import {
  parseInviteCode,
  INVITE_COLOR_HEX,
  type InviteCodeSegment,
} from "@/lib/game-sessions";

interface JMInviteCodeViewProps {
  code: string;
  size?: "sm" | "md" | "lg";
}

const SIZES = {
  sm: { char: "text-3xl", label: "text-[9px]", gap: "gap-3", py: "py-2" },
  md: { char: "text-5xl", label: "text-[10px]", gap: "gap-5", py: "py-3" },
  lg: { char: "text-7xl", label: "text-xs", gap: "gap-6", py: "py-4" },
} as const;

function Segment({
  segment,
  size,
}: {
  segment: InviteCodeSegment;
  size: "sm" | "md" | "lg";
}) {
  const s = SIZES[size];
  const hex = INVITE_COLOR_HEX[segment.color];

  return (
    <div className="flex flex-col items-center">
      <span
        className={`${s.char} font-black leading-none`}
        style={{ color: hex }}
      >
        {segment.char}
      </span>
      <span
        className={`${s.label} mt-1 font-medium uppercase tracking-widest`}
        style={{ color: hex }}
      >
        {segment.color}
      </span>
    </div>
  );
}

export function JMInviteCodeView({ code, size = "md" }: JMInviteCodeViewProps) {
  const segments = parseInviteCode(code);
  const s = SIZES[size];

  return (
    <div className={`flex items-center justify-center ${s.gap} ${s.py}`}>
      {segments.map((seg, i) => (
        <Segment key={i} segment={seg} size={size} />
      ))}
    </div>
  );
}
