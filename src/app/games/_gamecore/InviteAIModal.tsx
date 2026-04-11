"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/JMKit";
import { loadPersonasFromDB, type AIPersona } from "./aiPersonas";
import { AIPersonaGrid } from "./AIPersonaGrid";

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

  const aiInLobby = useMemo(() => new Set(currentAIIds), [currentAIIds]);
  const lobbyFull = availableSlots <= 0 && aiInLobby.size === 0;

  const disabledIds = useMemo(() => {
    if (availableSlots > 0) return new Set<string>();
    const disabled = new Set<string>();
    personas?.forEach((p) => {
      if (!aiInLobby.has(p.id)) disabled.add(p.id);
    });
    return disabled;
  }, [personas, availableSlots, aiInLobby]);

  const handleToggle = useCallback(
    (persona: { id: string }) => {
      if (aiInLobby.has(persona.id)) {
        onRemoveAI(persona.id);
      } else {
        const full = personas?.find((p) => p.id === persona.id);
        if (full) onAddAI(full);
      }
    },
    [aiInLobby, personas, onAddAI, onRemoveAI],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto bg-black/95 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-black uppercase tracking-wider text-white">
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

        <AIPersonaGrid
          personas={personas}
          selectedIds={aiInLobby}
          onToggle={handleToggle}
          disabledIds={disabledIds}
          emptyMessage="No AI personas available. Create some in the admin panel."
        />

        <div className="sticky bottom-0 pt-3">
          <button
            onClick={() => onOpenChange(false)}
            className="w-full rounded-xl bg-red-600 py-4 text-lg font-bold uppercase tracking-wider text-white shadow-lg shadow-red-600/30 transition-all hover:scale-[1.02] active:scale-95"
          >
            Done
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
