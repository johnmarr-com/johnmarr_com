"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Loader2, Swords, Trophy, XCircle } from "lucide-react";
import { JMAIAvatarView } from "@/JMKit";
import { PLAY_STYLE_COLORS, type AIPersona, DEFAULT_AI_SKILL_LEVEL } from "./aiPersonas";
import { getAllLevels, type UserLevel } from "@/lib/levels";
import { levelBgStyle } from "@/lib/level-colors";

export interface AIPersonaGridItem {
  id: string;
  name: string;
  playStyle: AIPersona["playStyle"];
  skillLevel?: number | undefined;
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

// Module-level level cache. Fetched once per session, shared across every grid
// instance (admin list + InviteAIModal + PickAIOpponentModal). Keeps the banner
// render fast and avoids n re-fetches when multiple modals mount in a session.
let levelsCache: UserLevel[] | null = null;
let levelsPromise: Promise<UserLevel[]> | null = null;
function fetchLevelsOnce(): Promise<UserLevel[]> {
  if (levelsCache) return Promise.resolve(levelsCache);
  if (!levelsPromise) {
    levelsPromise = getAllLevels()
      .then((lv) => {
        levelsCache = lv;
        return lv;
      })
      .catch(() => {
        levelsPromise = null;
        return [];
      });
  }
  return levelsPromise;
}

export function AIPersonaGrid({
  personas,
  selectedIds,
  onToggle,
  disabledIds,
  showInactiveBadge,
  emptyMessage = "No AI personas available.",
}: AIPersonaGridProps) {
  const [levels, setLevels] = useState<UserLevel[]>(levelsCache ?? []);

  useEffect(() => {
    if (levels.length > 0) return;
    let cancelled = false;
    fetchLevelsOnce().then((lv) => {
      if (!cancelled) setLevels(lv);
    });
    return () => {
      cancelled = true;
    };
  }, [levels.length]);

  if (personas === null) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-white/40" />
      </div>
    );
  }

  if (personas.length === 0) {
    return (
      <p className="py-8 text-center text-base text-white/40">{emptyMessage}</p>
    );
  }

  // Group personas by resolved level. Missing skillLevel → DEFAULT_AI_SKILL_LEVEL.
  const byLevel = new Map<number, AIPersonaGridItem[]>();
  for (const p of personas) {
    const lvl = p.skillLevel ?? DEFAULT_AI_SKILL_LEVEL;
    const arr = byLevel.get(lvl);
    if (arr) arr.push(p);
    else byLevel.set(lvl, [p]);
  }
  const occupiedLevels = [...byLevel.keys()].sort((a, b) => a - b);
  const levelsByNum = new Map(levels.map((l) => [l.level, l]));

  return (
    // Top padding + tall gap so each card's floating badge (-top-16, 144px tall)
    // clears the previous card and isn't clipped at the very top of the list.
    <div className="flex flex-col gap-20 pt-20">
      {occupiedLevels.map((lvlNum) => {
        const bucket = byLevel.get(lvlNum)!;
        const lvlDoc = levelsByNum.get(lvlNum);
        const iconUrl = lvlDoc?.iconIsometricURL ?? lvlDoc?.iconRealisticURL ?? null;
        return (
          <div
            key={lvlNum}
            className="relative rounded-3xl border border-white/10 px-4 pb-4 pt-24 backdrop-blur-sm"
            style={levelBgStyle(lvlNum)}
          >
            {/* Level badge — floats above the top edge of the card so it reads
             * as a banner. Badge art already carries the level name. */}
            <div className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2">
              {iconUrl ? (
                <Image
                  src={iconUrl}
                  alt={lvlDoc?.title ?? `Level ${lvlNum}`}
                  width={144}
                  height={144}
                  className="h-36 w-36 object-contain drop-shadow-[0_6px_16px_rgba(0,0,0,0.6)]"
                  unoptimized
                />
              ) : (
                <span className="flex h-36 w-36 items-center justify-center rounded-full bg-white/10 text-xl font-black text-white/70 ring-4 ring-black/40">
                  L{lvlNum}
                </span>
              )}
            </div>

            {/* Persona grid for this level. */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {bucket.map((persona) => {
                const isSelected = selectedIds.has(persona.id);
                const isDisabled = disabledIds?.has(persona.id) ?? false;
                const styleClass = PLAY_STYLE_COLORS[persona.playStyle];
                const s = persona.stats;

                return (
                  <button
                    key={persona.id}
                    onClick={() => !isDisabled && onToggle(persona)}
                    disabled={isDisabled}
                    className={`flex flex-col items-center gap-0 rounded-2xl p-3 text-center transition-all sm:p-4 ${
                      isDisabled
                        ? "cursor-not-allowed opacity-40"
                        : isSelected
                          ? "bg-red-500/15 ring-2 ring-red-500/60 scale-[1.03]"
                          : "bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    <JMAIAvatarView
                      size={100}
                      avatarName={persona.avatarName}
                      scaleOverride={persona.avatarScale}
                    />
                    <div className="h-1.5 w-full shrink-0" aria-hidden />
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="mt-2 text-base font-bold leading-tight text-white sm:text-sm">
                        {persona.name}
                      </span>
                      {showInactiveBadge && persona.isActive === false && (
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/40 sm:text-xs">
                          Off
                        </span>
                      )}
                    </div>
                    <div className="mt-2 h-3 w-full shrink-0" aria-hidden />
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider sm:text-[11px] ${styleClass}`}
                    >
                      {persona.playStyle}
                    </span>
                    <span className="mt-3 line-clamp-2 text-sm leading-snug text-white/40 sm:text-xs">
                      {persona.description}
                    </span>

                    {s && s.gamesPlayed > 0 && (
                      <div className="mt-2 mb-3 flex items-center gap-2.5 text-sm text-white/30 sm:text-xs">
                        <span className="flex items-center gap-1">
                          <Swords className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                          {s.gamesPlayed}
                        </span>
                        <span className="flex items-center gap-1 text-emerald-400/70">
                          <Trophy className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                          {s.wins}
                        </span>
                        <span className="flex items-center gap-1 text-red-400/70">
                          <XCircle className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                          {s.losses}
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
