"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Swords, Trophy, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  JMAIAvatarView,
} from "@/JMKit";
import {
  PLAY_STYLE_COLORS,
  loadPersonasFromDB,
  type AIPersona,
} from "./aiPersonas";

interface PickAIOpponentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (persona: AIPersona) => void;
}

export function PickAIOpponentModal({
  open,
  onOpenChange,
  onSelect,
}: PickAIOpponentModalProps) {
  const [personas, setPersonas] = useState<AIPersona[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    loadPersonasFromDB().then((list) => {
      setPersonas(list);
      setSelectedId(null);
    });
  }, [open]);

  const handleOpenChange = useCallback(
    (next: boolean) => onOpenChange(next),
    [onOpenChange],
  );

  const handleConfirm = useCallback(() => {
    if (!selectedId || !personas) return;
    const persona = personas.find((p) => p.id === selectedId);
    if (persona) onSelect(persona);
  }, [selectedId, personas, onSelect]);

  const selected = personas?.find((p) => p.id === selectedId) ?? null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto bg-black/95 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-black uppercase tracking-wider text-white">
            Choose Your Opponent
          </DialogTitle>
          <DialogDescription className="text-center text-white/50">
            Select an AI rival to battle.
          </DialogDescription>
        </DialogHeader>

        {personas === null ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-white/40" />
          </div>
        ) : personas.length === 0 ? (
          <p className="py-8 text-center text-sm text-white/40">
            No AI personas available.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 pt-1">
              {personas.map((persona) => {
                const isSelected = selectedId === persona.id;
                const styleClass = PLAY_STYLE_COLORS[persona.playStyle];
                const s = persona.stats;

                return (
                  <button
                    key={persona.id}
                    onClick={() => setSelectedId(persona.id)}
                    className={`flex flex-col items-center gap-2 rounded-2xl p-4 text-center transition-all ${
                      isSelected
                        ? "bg-red-500/15 ring-2 ring-red-500/60 scale-[1.03]"
                        : "bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    <JMAIAvatarView
                      size={72}
                      avatarName={persona.avatarName}
                      scaleOverride={persona.avatarScale}
                    />

                    <span className="text-sm font-bold text-white leading-tight">
                      {persona.name}
                    </span>

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

            {/* Confirm button — fixed at bottom */}
            <div className="sticky bottom-0 pt-3">
              <button
                onClick={handleConfirm}
                disabled={!selected}
                className={`w-full rounded-xl py-4 text-lg font-bold uppercase tracking-wider transition-all ${
                  selected
                    ? "bg-red-600 text-white shadow-lg shadow-red-600/30 hover:scale-[1.02] active:scale-95"
                    : "cursor-not-allowed bg-white/10 text-white/25"
                }`}
              >
                {selected ? (
                  <>Fight {selected.name}</>
                ) : (
                  "Select an Opponent"
                )}
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
