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
  const selectedIds = useMemo(
    () => new Set(selectedId ? [selectedId] : []),
    [selectedId],
  );

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

        <AIPersonaGrid
          personas={personas}
          selectedIds={selectedIds}
          onToggle={(p) => setSelectedId(p.id === selectedId ? null : p.id)}
        />

        {selected && (
          <div className="sticky bottom-0 pt-3">
            <button
              onClick={handleConfirm}
              className="w-full rounded-xl bg-red-600 py-4 text-lg font-bold uppercase tracking-wider text-white shadow-lg shadow-red-600/30 transition-all hover:scale-[1.02] active:scale-95"
            >
              Fight {selected.name}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
