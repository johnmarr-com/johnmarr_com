"use client";

import { Loader2, Swords, Trophy, XCircle } from "lucide-react";
import { JMAIAvatarView } from "@/JMKit";
import { PLAY_STYLE_COLORS, type AIPersona } from "./aiPersonas";

export interface AIPersonaGridItem {
  id: string;
  name: string;
  playStyle: AIPersona["playStyle"];
  description: string;
  avatarName?: string | undefined;
  avatarScale?: number | undefined;
  stats?: { gamesPlayed: number; wins: number; losses: number } | undefined;
  isActive?: boolean | undefined;
}

interface AIPersonaGridProps {
  personas: AIPersonaGridItem[] | null;
  selectedIds: Set<string>;
  onToggle: (persona: AIPersonaGridItem) => void;
  disabledIds?: Set<string>;
  showInactiveBadge?: boolean;
  emptyMessage?: string;
}

export function AIPersonaGrid({
  personas,
  selectedIds,
  onToggle,
  disabledIds,
  showInactiveBadge,
  emptyMessage = "No AI personas available.",
}: AIPersonaGridProps) {
  if (personas === null) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-white/40" />
      </div>
    );
  }

  if (personas.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-white/40">{emptyMessage}</p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {personas.map((persona) => {
        const isSelected = selectedIds.has(persona.id);
        const isDisabled = disabledIds?.has(persona.id) ?? false;
        const styleClass = PLAY_STYLE_COLORS[persona.playStyle];
        const s = persona.stats;

        return (
          <button
            key={persona.id}
            onClick={() => !isDisabled && onToggle(persona)}
            disabled={isDisabled}
            className={`flex flex-col items-center gap-2 rounded-2xl p-4 text-center transition-all ${
              isDisabled
                ? "cursor-not-allowed opacity-40"
                : isSelected
                  ? "bg-red-500/15 ring-2 ring-red-500/60 scale-[1.03]"
                  : "bg-white/5 hover:bg-white/10"
            }`}
          >
            <JMAIAvatarView
              size={72}
              avatarName={persona.avatarName}
              scaleOverride={persona.avatarScale}
            />

            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-white leading-tight">
                {persona.name}
              </span>
              {showInactiveBadge && persona.isActive === false && (
                <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-medium text-white/40">
                  Off
                </span>
              )}
            </div>

            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${styleClass}`}
            >
              {persona.playStyle}
            </span>

            <span className="text-xs text-white/40 leading-snug line-clamp-2">
              {persona.description}
            </span>

            {s && s.gamesPlayed > 0 && (
              <div className="flex items-center gap-2 text-[11px] text-white/30">
                <span className="flex items-center gap-0.5">
                  <Swords className="h-3 w-3" />
                  {s.gamesPlayed}
                </span>
                <span className="flex items-center gap-0.5 text-emerald-400/70">
                  <Trophy className="h-3 w-3" />
                  {s.wins}
                </span>
                <span className="flex items-center gap-0.5 text-red-400/70">
                  <XCircle className="h-3 w-3" />
                  {s.losses}
                </span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
