"use client";

import { Settings2 } from "lucide-react";

interface BluffAiSettingsButtonProps {
  onClick: () => void;
  disabled?: boolean;
  /** Smaller for dense toolbars (e.g. bulk grid). */
  size?: "md" | "sm";
}

export function BluffAiSettingsButton({ onClick, disabled, size = "md" }: BluffAiSettingsButtonProps) {
  const pad = size === "sm" ? "px-2 py-1.5 text-[10px]" : "px-3 py-2.5 text-xs";
  const icon = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title="AI image settings (Ideogram)"
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/20 bg-white/5 font-bold uppercase tracking-wider text-white/80 transition-colors hover:border-amber-400/40 hover:bg-white/10 disabled:opacity-40 ${pad}`}
    >
      <span>AI</span>
      <Settings2 className={icon} aria-hidden />
    </button>
  );
}
