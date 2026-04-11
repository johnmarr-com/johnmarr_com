"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
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

interface InviteAIModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableSlots: number;
  currentAIIds: string[];
  onAddAI: (persona: AIPersona) => void;
  onRemoveAI: (personaId: string) => void;
}

export function InviteAIModal({
  open,
  onOpenChange,
  availableSlots,
  currentAIIds,
  onAddAI,
  onRemoveAI,
}: InviteAIModalProps) {
  const [personas, setPersonas] = useState<AIPersona[] | null>(null);

  useEffect(() => {
    if (!open) return;
    loadPersonasFromDB().then(setPersonas);
  }, [open]);

  const handleOpenChange = useCallback(
    (next: boolean) => onOpenChange(next),
    [onOpenChange],
  );

  const aiInLobby = new Set(currentAIIds);
  const lobbyFull = availableSlots <= 0 && aiInLobby.size === 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[80dvh] overflow-y-auto bg-black/95 sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center text-white">
            AI Personas
          </DialogTitle>
          <DialogDescription className="text-center text-white/50">
            Add AI opponents to your game.
          </DialogDescription>
        </DialogHeader>

        {lobbyFull && (
          <p className="text-center text-sm text-red-400">
            Lobby is full. Remove a player to add AI.
          </p>
        )}

        <div className="flex flex-col gap-1 pt-1">
          {personas === null ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-white/40" />
            </div>
          ) : personas.length === 0 ? (
            <p className="py-6 text-center text-sm text-white/40">
              No AI personas available. Create some in the admin panel.
            </p>
          ) : null}
          {personas?.map((persona) => {
            const isAdded = aiInLobby.has(persona.id);
            const styleClass = PLAY_STYLE_COLORS[persona.playStyle];
            const canAdd = !isAdded && availableSlots > 0;

            return (
              <button
                key={persona.id}
                onClick={() => isAdded ? onRemoveAI(persona.id) : canAdd && onAddAI(persona)}
                disabled={!isAdded && !canAdd}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  isAdded
                    ? "bg-red-500/10 ring-1 ring-red-500/20 hover:bg-red-500/15"
                    : "bg-white/5 hover:bg-white/10"
                }`}
              >
                <JMAIAvatarView size={36} avatarName={persona.avatarName} scaleOverride={persona.avatarScale} />

                <div className="flex flex-1 flex-col gap-0.5">
                  <span className="text-sm font-bold text-white">
                    {persona.name}
                  </span>
                  <span className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${styleClass}`}>
                    {persona.playStyle}
                  </span>
                </div>

                {isAdded ? (
                  <X className="h-5 w-5 shrink-0 text-red-400" />
                ) : (
                  <Plus className="h-5 w-5 shrink-0 text-white/40" />
                )}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
