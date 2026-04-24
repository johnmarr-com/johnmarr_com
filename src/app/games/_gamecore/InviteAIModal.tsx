"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  JMCloseCircleButton,
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
      <DialogContent
        hideCloseButton
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        overlayClassName="fixed inset-0 z-50 bg-black/70 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        className="max-h-[85dvh] w-full max-w-md gap-0 overflow-hidden rounded-[28px] border border-white/15 bg-linear-to-b from-neutral-950 via-neutral-900 to-neutral-950 p-0 shadow-2xl shadow-black/50"
      >
        <div
          className="pointer-events-none absolute inset-0 rounded-[28px] bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(251,191,36,0.1),transparent),radial-gradient(ellipse_60%_40%_at_100%_50%,rgba(59,130,246,0.07),transparent)]"
          aria-hidden
        />
        <DialogClose asChild>
          <JMCloseCircleButton className="absolute right-4 top-4 z-20 sm:right-5 sm:top-5" />
        </DialogClose>
        <div className="relative z-10 flex max-h-[85dvh] flex-col gap-4 overflow-y-auto overflow-x-hidden px-5 pt-5 pb-0 sm:px-6 sm:pt-6">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl font-black uppercase tracking-wider text-white sm:text-xl">
              AI Personas
            </DialogTitle>
            <DialogDescription className="text-center text-base text-white/50 sm:text-sm">
              Add AI opponents to your game.
            </DialogDescription>
          </DialogHeader>

          {lobbyFull && (
            <p className="text-center text-base text-red-400 sm:text-sm">
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

          <div className="sticky bottom-0 z-30 -mx-5 mt-2 border-t border-white/10 bg-black px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] sm:-mx-6 sm:px-6 sm:pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="w-full min-h-[52px] rounded-xl bg-white py-3.5 text-lg font-bold uppercase tracking-wider text-black shadow-lg shadow-white/20 transition-all hover:scale-[1.02] active:scale-95 sm:min-h-0 sm:py-4 sm:text-base"
            >
              Done
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
