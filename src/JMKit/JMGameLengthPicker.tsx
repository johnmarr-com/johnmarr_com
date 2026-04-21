"use client";

import { useState } from "react";
import { ChevronRight, Timer } from "lucide-react";
import type { GameLengthPreset } from "@/app/games/_gamecore/gameLengthPresets";

export interface JMGameLengthPickerProps {
  /** Game-specific presets (e.g. Quick / Standard / Marathon) */
  presets: readonly GameLengthPreset[];
  /** Currently selected preset key */
  selectedKey: string;
  /** Called when the host picks a different preset */
  onChange: (preset: GameLengthPreset) => void;
}

/**
 * Tappable display div showing the current game-length choice.
 * Opens a picker popup on tap so the host can switch presets.
 */
export function JMGameLengthPicker({
  presets,
  selectedKey,
  onChange,
}: JMGameLengthPickerProps) {
  const [open, setOpen] = useState(false);
  const current = presets.find((p) => p.key === selectedKey) ?? presets[0];

  if (!current) return null;

  return (
    <>
      {/* Display div */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-left transition-colors hover:bg-white/10"
      >
        {current.icon
          ? <current.icon className="h-7 w-7 shrink-0" style={{ color: current.iconColor ?? "white" }} />
          : <Timer className="h-5 w-5 shrink-0 text-white/50" />
        }
        <div className="min-w-0 flex-1">
          <p className="text-base font-black text-white">{current.label}</p>
          <p className="text-sm text-white/70">
            {current.rounds} rounds &middot; ~{current.estimatedMinutes} min
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-white/40" />
      </button>

      {/* Picker popup */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="mx-4 w-full max-w-sm rounded-2xl border border-white/15 bg-neutral-900 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-4 text-center text-sm font-black uppercase tracking-widest text-white/70">
              Game Length
            </p>

            <div className="flex flex-col gap-2">
              {presets.map((preset) => {
                const isSelected = preset.key === selectedKey;
                return (
                  <button
                    key={preset.key}
                    onClick={() => {
                      onChange(preset);
                      setOpen(false);
                    }}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all active:scale-95 ${
                      isSelected
                        ? "border-amber-400/40 bg-amber-400/10"
                        : "border-white/10 bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    {preset.icon
                      ? <preset.icon className="h-7 w-7 shrink-0" style={{ color: preset.iconColor ?? (isSelected ? "#fbbf24" : "rgba(255,255,255,0.4)") }} />
                      : <Timer className={`h-5 w-5 shrink-0 ${isSelected ? "text-amber-400" : "text-white/40"}`} />
                    }
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-base font-black ${isSelected ? "text-amber-400" : "text-white"}`}
                      >
                        {preset.label}
                      </p>
                      <p className={`text-sm ${isSelected ? "text-amber-400/70" : "text-white/70"}`}>
                        {preset.rounds} rounds &middot; ~{preset.estimatedMinutes} min
                      </p>
                    </div>
                    {isSelected && (
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-400/70">
                        Selected
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setOpen(false)}
              className="mt-4 w-full rounded-xl border border-white/15 bg-white/5 py-3 text-center text-sm font-bold uppercase tracking-wider text-white/60 transition-all hover:bg-white/10 active:scale-95"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
}
