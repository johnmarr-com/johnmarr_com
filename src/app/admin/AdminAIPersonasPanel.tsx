"use client";

import { useState, useEffect } from "react";
import { Plus, Bot, ChevronRight, Trophy, XCircle, Gamepad2 } from "lucide-react";
import { useJMStyle } from "@/JMStyle";
import { JMAIAvatarView } from "@/JMKit";
import { PLAY_STYLE_COLORS, type AIPlayStyle } from "@/app/games/_gamecore/aiPersonas";
import { getAllAIPersonas, type AIPersonaDoc } from "@/lib/ai-personas";
import { AIPersonaEditModal } from "./AIPersonaEditModal";

export function AdminAIPersonasPanel() {
  const { theme } = useJMStyle();
  const [personas, setPersonas] = useState<AIPersonaDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const fetchPersonas = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await getAllAIPersonas();
      setPersonas(list);
    } catch (err) {
      console.error("Failed to fetch AI personas:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch personas");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPersonas();
  }, []);

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
                {isLoading ? "..." : personas.length}
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

      {/* Persona list */}
      <div
        className="overflow-hidden rounded-2xl border backdrop-blur-md"
        style={{
          backgroundColor: `${theme.surfaces.base}ee`,
          borderColor: theme.surfaces.elevated2,
        }}
      >
        {isLoading ? (
          <div className="px-8 py-12 text-center">
            <div
              className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-t-transparent"
              style={{
                borderColor: theme.accents.goldenGlow,
                borderTopColor: "transparent",
              }}
            />
          </div>
        ) : error ? (
          <div
            className="px-8 py-12 text-center text-sm"
            style={{ color: theme.semantic.error }}
          >
            {error}
          </div>
        ) : personas.length === 0 ? (
          <div className="px-8 py-12 text-center">
            <div className="mb-2 text-sm" style={{ color: theme.text.tertiary }}>
              No AI personas yet
            </div>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="text-sm font-medium transition-colors hover:underline"
              style={{ color: theme.accents.goldenGlow }}
            >
              Create your first AI persona →
            </button>
          </div>
        ) : (
          <div
            className="divide-y"
            style={{ borderColor: theme.surfaces.elevated2 }}
          >
            {personas.map((p) => {
              const styleClass = PLAY_STYLE_COLORS[p.playStyle as AIPlayStyle] ?? PLAY_STYLE_COLORS.balanced;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className="flex w-full items-center gap-5 px-6 py-5 text-left transition-colors hover:bg-white/5"
                >
                  {/* Avatar */}
                  <JMAIAvatarView size={56} avatarName={p.avatarName} scaleOverride={p.avatarScale} />

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="truncate text-lg font-semibold"
                        style={{ color: theme.text.primary }}
                      >
                        {p.name}
                      </span>
                      {!p.isActive && (
                        <span
                          className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                          style={{
                            backgroundColor: theme.surfaces.elevated2,
                            color: theme.text.tertiary,
                          }}
                        >
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${styleClass}`}>
                        {p.playStyle}
                      </span>
                      <span
                        className="truncate text-sm"
                        style={{ color: theme.text.tertiary }}
                      >
                        {p.description}
                      </span>
                    </div>
                    {p.voice && (
                      <p
                        className="mt-1 truncate text-sm italic"
                        style={{ color: theme.text.tertiary }}
                      >
                        &ldquo;{p.voice}&rdquo;
                      </p>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="hidden shrink-0 items-center gap-4 text-sm sm:flex" style={{ color: theme.text.tertiary }}>
                    <span className="flex items-center gap-1.5">
                      <Gamepad2 size={16} />
                      {p.stats.gamesPlayed}
                    </span>
                    <span className="flex items-center gap-1.5 text-green-400">
                      <Trophy size={16} />
                      {p.stats.wins}
                    </span>
                    <span className="flex items-center gap-1.5 text-red-400">
                      <XCircle size={16} />
                      {p.stats.losses}
                    </span>
                  </div>

                  <ChevronRight size={20} className="shrink-0" style={{ color: theme.text.tertiary }} />
                </button>
              );
            })}
          </div>
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
