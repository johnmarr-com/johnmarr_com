"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, Bot } from "lucide-react";
import { useJMStyle } from "@/JMStyle";
import { AIPersonaGrid } from "@/app/games/_gamecore/AIPersonaGrid";
import { getAllAIPersonas, type AIPersonaDoc } from "@/lib/ai-personas";
import { AIPersonaEditModal } from "./AIPersonaEditModal";

const EMPTY_SET = new Set<string>();

export function AdminAIPersonasPanel() {
  const { theme } = useJMStyle();
  const [personas, setPersonas] = useState<AIPersonaDoc[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const fetchPersonas = useCallback(async () => {
    setError(null);
    try {
      const list = await getAllAIPersonas();
      setPersonas(list);
    } catch (err) {
      console.error("Failed to fetch AI personas:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch personas");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    getAllAIPersonas()
      .then((list) => { if (!cancelled) setPersonas(list); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Failed to fetch personas"); });
    return () => { cancelled = true; };
  }, []);

  const gridItems = useMemo(
    () =>
      personas?.map((p) => ({
        id: p.id,
        name: p.name,
        playStyle: p.playStyle,
        skillLevel: p.skillLevel,
        description: p.description,
        avatarName: p.avatarName,
        avatarScale: p.avatarScale,
        stats: p.stats,
        isActive: p.isActive,
      })) ?? null,
    [personas],
  );

  const handleToggle = useCallback(
    (persona: { id: string }) => setSelectedId(persona.id),
    [],
  );

  return (
    <div className="mt-6 space-y-4">
      {/* Toolbar */}
      <div
        className="rounded-2xl border backdrop-blur-md"
        style={{
          backgroundColor: `${theme.surfaces.base}ee`,
          borderColor: theme.surfaces.elevated2,
        }}
      >
        <div className="flex items-center justify-between gap-4 px-8 py-5">
          <div className="flex items-center gap-3">
            <Bot size={20} style={{ color: theme.accents.goldenGlow }} />
            <div
              className="whitespace-nowrap text-sm font-medium"
              style={{ color: theme.text.secondary }}
            >
              AI Personas:{" "}
              <span style={{ color: theme.text.primary }}>
                {personas === null ? "..." : personas.length}
              </span>
            </div>
          </div>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all hover:scale-105"
            style={{
              backgroundColor: theme.accents.goldenGlow,
              color: theme.surfaces.base,
            }}
          >
            <Plus size={18} />
            New Persona
          </button>
        </div>
      </div>

      {/* Persona grid */}
      <div
        className="overflow-hidden rounded-2xl border p-4 backdrop-blur-md"
        style={{
          backgroundColor: `${theme.surfaces.base}ee`,
          borderColor: theme.surfaces.elevated2,
        }}
      >
        {error ? (
          <div
            className="px-8 py-12 text-center text-sm"
            style={{ color: theme.semantic.error }}
          >
            {error}
          </div>
        ) : (
          <AIPersonaGrid
            personas={gridItems}
            selectedIds={EMPTY_SET}
            onToggle={handleToggle}
            showInactiveBadge
            emptyMessage="No AI personas yet. Create your first one above."
          />
        )}
      </div>

      {/* Create modal */}
      {isCreateOpen && (
        <AIPersonaEditModal
          personaId={null}
          onClose={() => setIsCreateOpen(false)}
          onUpdated={() => {
            fetchPersonas();
            setIsCreateOpen(false);
          }}
        />
      )}

      {/* Edit modal */}
      {selectedId && (
        <AIPersonaEditModal
          personaId={selectedId}
          onClose={() => setSelectedId(null)}
          onUpdated={() => {
            fetchPersonas();
            setSelectedId(null);
          }}
        />
      )}
    </div>
  );
}
