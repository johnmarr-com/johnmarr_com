"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Loader2, Trash2, Trophy, XCircle, Gamepad2, Palette } from "lucide-react";
import { useJMStyle } from "@/JMStyle";
import { JMAIAvatarView } from "@/JMKit";
import { JMAvatarColorEditor } from "@/JMKit/JMAvatarColorEditor";
import JMAvatarPicker from "@/JMKit/JMAvatarPicker";
import type { JMAvatarItem } from "@/JMKit/JMAvatarPicker";
import { PLAY_STYLE_COLORS, type AIPlayStyle } from "@/app/games/_gamecore/aiPersonas";
import {
  getAIPersona,
  createAIPersona,
  updateAIPersona,
  deleteAIPersona,
  type AIPersonaDoc,
} from "@/lib/ai-personas";
import { getAllLevels, type UserLevel } from "@/lib/levels";
import { getAvatarScale } from "@/lib/avatar-scale-map";
import { useAuth } from "@/lib/AuthProvider";

const PLAY_STYLES: AIPlayStyle[] = [
  "aggressive",
  "cautious",
  "creative",
  "analytical",
  "chaotic",
  "balanced",
];

interface EditState {
  name: string;
  avatarName: string;
  avatarScale: number;
  playStyle: AIPlayStyle;
  skillLevel: number; // matches /levels collection entries (1..10+)
  description: string;
  prompt: string;
  voice: string;
  isActive: boolean;
}

const DEFAULT_STATE: EditState = {
  name: "",
  avatarName: "",
  avatarScale: 1.0,
  playStyle: "balanced",
  skillLevel: 7, // Champion — algorithmic `standard` tier
  description: "",
  prompt: "",
  voice: "",
  isActive: true,
};

function stateFromDoc(doc: AIPersonaDoc): EditState {
  return {
    name: doc.name,
    avatarName: doc.avatarName,
    avatarScale: doc.avatarScale ?? 1.0,
    playStyle: doc.playStyle,
    skillLevel: doc.skillLevel ?? 7,
    description: doc.description,
    prompt: doc.prompt,
    voice: doc.voice ?? "",
    isActive: doc.isActive,
  };
}

interface AIPersonaEditModalProps {
  personaId: string | null;
  onClose: () => void;
  onUpdated: () => void;
}

export function AIPersonaEditModal({ personaId, onClose, onUpdated }: AIPersonaEditModalProps) {
  const { theme } = useJMStyle();
  const { user } = useAuth();
  const isCreate = personaId === null;

  const [persona, setPersona] = useState<AIPersonaDoc | null>(null);
  const [isLoading, setIsLoading] = useState(!isCreate);
  const [error, setError] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>(DEFAULT_STATE);
  const [originalState, setOriginalState] = useState<EditState>(DEFAULT_STATE);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showColorEditor, setShowColorEditor] = useState(false);
  const [avatars, setAvatars] = useState<JMAvatarItem[]>([]);
  const [levels, setLevels] = useState<UserLevel[]>([]);

  useEffect(() => {
    getAllLevels().then(setLevels).catch(() => setLevels([]));
  }, []);

  const update = useCallback(
    (partial: Partial<EditState>) => setEditState((prev) => ({ ...prev, ...partial })),
    [],
  );

  useEffect(() => {
    if (isCreate) return;
    const load = async () => {
      setIsLoading(true);
      try {
        const doc = await getAIPersona(personaId!);
        if (!doc) {
          setError("Persona not found");
          return;
        }
        setPersona(doc);
        const s = stateFromDoc(doc);
        setEditState(s);
        setOriginalState(s);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load persona");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [personaId, isCreate]);

  const loadAvatars = useCallback(async () => {
    if (!user) return;
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/avatars?includeCustom=1", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const items: JMAvatarItem[] = (data as { file: string; name: string }[]).map(
        (a) => ({
          filename: a.file,
          name: a.name,
          scale: getAvatarScale(a.file),
        }),
      );
      const isCustomFile = (filename: string) => filename.includes("-custom~~");
      items.sort((a, b) => {
        const aC = isCustomFile(a.filename) ? 0 : 1;
        const bC = isCustomFile(b.filename) ? 0 : 1;
        if (aC !== bC) return aC - bC;
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      });
      setAvatars(items);
    } catch {
      /* ignore */
    }
  }, [user]);

  useEffect(() => {
    loadAvatars();
  }, [loadAvatars]);

  const hasChanges = JSON.stringify(editState) !== JSON.stringify(originalState);

  const handleSave = async () => {
    if (!editState.name.trim()) return;
    setIsSaving(true);
    setError(null);
    try {
      if (isCreate) {
        await createAIPersona({
          name: editState.name.trim(),
          avatarName: editState.avatarName,
          playStyle: editState.playStyle,
          skillLevel: editState.skillLevel,
          description: editState.description.trim(),
          prompt: editState.prompt.trim(),
          voice: editState.voice.trim(),
          avatarScale: editState.avatarScale,
          isActive: editState.isActive,
        });
        onUpdated();
        return;
      }

      await updateAIPersona(personaId!, {
        name: editState.name.trim(),
        avatarName: editState.avatarName,
        playStyle: editState.playStyle,
        skillLevel: editState.skillLevel,
        description: editState.description.trim(),
        prompt: editState.prompt.trim(),
        voice: editState.voice.trim(),
        avatarScale: editState.avatarScale,
        isActive: editState.isActive,
      });

      const fresh = stateFromDoc({
        ...persona!,
        ...editState,
        name: editState.name.trim(),
        description: editState.description.trim(),
        prompt: editState.prompt.trim(),
        voice: editState.voice.trim(),
      });
      setOriginalState(fresh);
      setShowSaveToast(true);
      setTimeout(() => setShowSaveToast(false), 2000);
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!personaId) return;
    setIsDeleting(true);
    try {
      await deleteAIPersona(personaId);
      onUpdated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" aria-hidden />

      {/* Avatar picker overlay — above everything */}
      {showAvatarPicker && avatars.length > 0 && (
        <div className="fixed inset-0 z-[110] flex flex-col bg-black/95">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-6 sm:py-4">
            <h3 className="text-xl font-semibold text-white sm:text-lg">Choose Avatar</h3>
            <button
              type="button"
              onClick={() => setShowAvatarPicker(false)}
              className="rounded-full p-2 transition-colors hover:bg-white/10 text-white/60"
              aria-label="Close avatar picker"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 sm:p-4">
            <JMAvatarPicker
              avatars={avatars}
              mode="selector"
              onSelect={(avatar: JMAvatarItem) => {
                update({ avatarName: avatar.filename });
                setShowAvatarPicker(false);
              }}
            />
          </div>
        </div>
      )}

      <div
        className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border-2"
        style={{
          backgroundColor: "rgba(20, 20, 20, 1)",
          borderColor: "rgba(255, 255, 255, 0.2)",
          maxHeight: "90vh",
        }}
      >
        {/* Header */}
        <div
          className="flex shrink-0 items-center justify-between border-b px-4 py-3 sm:px-6 sm:py-4"
          style={{ borderColor: "rgba(255, 255, 255, 0.15)" }}
        >
          <h2 className="pr-2 text-lg font-semibold sm:text-xl" style={{ color: theme.text.primary }}>
            {isCreate ? "New AI Persona" : (persona?.name ?? "Edit Persona")}
          </h2>
          <button
            onClick={onClose}
            className="shrink-0 rounded-full p-2 transition-colors hover:bg-white/10"
            style={{ color: theme.text.tertiary }}
            type="button"
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" style={{ color: theme.accents.goldenGlow }} />
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {/* Avatar */}
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-4">
                <button
                  type="button"
                  onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                  className="transition-colors"
                >
                  {editState.avatarName ? (
                    <JMAIAvatarView
                      size={160}
                      avatarName={editState.avatarName}
                      scaleOverride={editState.avatarScale}
                    />
                  ) : (
                    <div
                      className="flex h-40 w-40 items-center justify-center rounded-full border-2 border-dashed transition-colors hover:border-white/40 sm:h-32 sm:w-32"
                      style={{ borderColor: "rgba(255,255,255,0.2)" }}
                    >
                      <span className="text-sm sm:text-xs" style={{ color: theme.text.tertiary }}>Avatar</span>
                    </div>
                  )}
                </button>
                <div className="w-full flex-1">
                  <label className="mb-1.5 block text-base font-medium sm:text-sm" style={{ color: theme.text.secondary }}>
                    Name
                  </label>
                  <input
                    type="text"
                    value={editState.name}
                    onChange={(e) => update({ name: e.target.value })}
                    placeholder="Agent VIPER"
                    className="min-h-[48px] w-full rounded-lg border px-3.5 py-2.5 text-base sm:min-h-0 sm:py-2 sm:text-sm"
                    style={{
                      backgroundColor: theme.surfaces.elevated1,
                      borderColor: theme.surfaces.elevated2,
                      color: theme.text.primary,
                    }}
                  />
                </div>
              </div>

              {/* Avatar picker rendered as overlay — see bottom of component */}

              {/* Avatar Scale */}
              {editState.avatarName && (
                <div>
                  <label className="mb-1.5 flex items-center justify-between text-base font-medium sm:text-sm" style={{ color: theme.text.secondary }}>
                    <span>Avatar Scale</span>
                    <span className="tabular-nums" style={{ color: theme.text.tertiary }}>
                      {editState.avatarScale.toFixed(2)}x
                    </span>
                  </label>
                  <input
                    type="range"
                    min={0.5}
                    max={3.0}
                    step={0.05}
                    value={editState.avatarScale}
                    onChange={(e) => update({ avatarScale: parseFloat(e.target.value) })}
                    className="h-3 w-full accent-amber-400 sm:h-2"
                  />
                  <div className="mt-1 flex justify-between text-xs sm:text-[10px]" style={{ color: theme.text.tertiary }}>
                    <span>0.5x</span>
                    <span>1.0x</span>
                    <span>3.0x</span>
                  </div>

                  {/* Recolor button */}
                  {!showColorEditor && (
                    <button
                      type="button"
                      onClick={() => setShowColorEditor(true)}
                      className="mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-base font-medium text-white/60 transition-colors hover:bg-white/5 hover:text-white sm:min-h-0 sm:py-2 sm:text-sm"
                    >
                      <Palette className="h-5 w-5 sm:h-4 sm:w-4" />
                      Recolor Avatar
                    </button>
                  )}
                </div>
              )}

              {/* Color Editor */}
              {showColorEditor && editState.avatarName && (
                <div
                  className="rounded-xl border p-4"
                  style={{ borderColor: "rgba(255,255,255,0.15)" }}
                >
                  <JMAvatarColorEditor
                    avatarFilename={editState.avatarName}
                    onSave={(newFilename) => {
                      update({ avatarName: newFilename });
                      setShowColorEditor(false);
                    }}
                    onCancel={() => setShowColorEditor(false)}
                  />
                </div>
              )}

              {/* Play Style */}
              <div>
                <label className="mb-1.5 block text-base font-medium sm:text-sm" style={{ color: theme.text.secondary }}>
                  Play Style
                </label>
                <div className="flex flex-wrap gap-2.5 sm:gap-2">
                  {PLAY_STYLES.map((style) => {
                    const active = editState.playStyle === style;
                    const colors = PLAY_STYLE_COLORS[style];
                    return (
                      <button
                        type="button"
                        key={style}
                        onClick={() => update({ playStyle: style })}
                        className={`min-h-[44px] rounded-full px-4 py-2.5 text-sm font-bold uppercase tracking-wider transition-all sm:min-h-0 sm:px-3 sm:py-1.5 sm:text-xs ${
                          active ? colors : "text-white/40 bg-white/5"
                        } ${active ? "ring-1 ring-white/20" : "hover:bg-white/10"}`}
                      >
                        {style}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Skill Level — pulls from the shared /levels roster so AI tiers
                * track the same progression players earn badges on. Algorithm
                * strength is derived from level ranges (L1-3 basic / L4-7
                * standard / L8+ sharp) in aiEngineTierForLevel(). */}
              <div>
                <label className="mb-1.5 block text-base font-medium sm:text-sm" style={{ color: theme.text.secondary }}>
                  Skill Level
                </label>
                <div className="flex flex-wrap gap-2.5 sm:gap-2">
                  {levels.length === 0 ? (
                    <span className="text-sm text-white/40 sm:text-xs">Loading levels…</span>
                  ) : (
                    levels.map((lvl) => {
                      const active = editState.skillLevel === lvl.level;
                      return (
                        <button
                          type="button"
                          key={lvl.id}
                          onClick={() => update({ skillLevel: lvl.level })}
                          className={`min-h-[44px] max-w-full rounded-full px-3.5 py-2.5 text-left text-sm font-bold uppercase leading-tight tracking-wider transition-all sm:min-h-0 sm:max-w-none sm:px-3 sm:py-1.5 sm:text-xs ${
                            active
                              ? "bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/30"
                              : "bg-white/5 text-white/40 hover:bg-white/10"
                          }`}
                          title={`Min ${lvl.minPoints} pts`}
                        >
                          L{lvl.level} · {lvl.title}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="mb-1.5 block text-base font-medium sm:text-sm" style={{ color: theme.text.secondary }}>
                  Short Description
                </label>
                <input
                  type="text"
                  value={editState.description}
                  onChange={(e) => update({ description: e.target.value })}
                  placeholder="Ruthless and direct. Always goes for the kill shot."
                  className="min-h-[48px] w-full rounded-lg border px-3.5 py-2.5 text-base sm:min-h-0 sm:py-2 sm:text-sm"
                  style={{
                    backgroundColor: theme.surfaces.elevated1,
                    borderColor: theme.surfaces.elevated2,
                    color: theme.text.primary,
                  }}
                />
              </div>

              {/* Prompt */}
              <div>
                <label className="mb-1.5 block text-base font-medium sm:text-sm" style={{ color: theme.text.secondary }}>
                  AI Prompt
                </label>
                <textarea
                  value={editState.prompt}
                  onChange={(e) => update({ prompt: e.target.value })}
                  placeholder="You are an aggressive player who shows no mercy. You go for the big kill..."
                  rows={4}
                  className="w-full resize-y rounded-lg border px-3.5 py-2.5 text-base leading-relaxed sm:px-3 sm:py-2 sm:text-sm"
                  style={{
                    backgroundColor: theme.surfaces.elevated1,
                    borderColor: theme.surfaces.elevated2,
                    color: theme.text.primary,
                  }}
                />
                <p className="mt-1.5 text-sm sm:text-xs" style={{ color: theme.text.tertiary }}>
                  Injected into the system prompt for every AI call made by this persona.
                </p>
              </div>

              {/* Voice */}
              <div>
                <label className="mb-1.5 block text-base font-medium sm:text-sm" style={{ color: theme.text.secondary }}>
                  Voice
                </label>
                <textarea
                  value={editState.voice}
                  onChange={(e) => update({ voice: e.target.value })}
                  placeholder="Speaks in short, punchy sentences. Uses military jargon. Never apologizes."
                  rows={3}
                  className="w-full resize-y rounded-lg border px-3.5 py-2.5 text-base leading-relaxed sm:px-3 sm:py-2 sm:text-sm"
                  style={{
                    backgroundColor: theme.surfaces.elevated1,
                    borderColor: theme.surfaces.elevated2,
                    color: theme.text.primary,
                  }}
                />
                <p className="mt-1.5 text-sm sm:text-xs" style={{ color: theme.text.tertiary }}>
                  Styles post-game transcripts and future in-game taunts.
                </p>
              </div>

              {/* Active toggle */}
              <button
                type="button"
                onClick={() => update({ isActive: !editState.isActive })}
                className="flex min-h-[48px] items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-base transition-colors sm:min-h-0 sm:py-2 sm:text-sm"
                style={{
                  backgroundColor: editState.isActive
                    ? `${theme.accents.goldenGlow}20`
                    : theme.surfaces.elevated2,
                  color: editState.isActive
                    ? theme.accents.goldenGlow
                    : theme.text.tertiary,
                }}
              >
                <span
                  className="inline-block h-5 w-5 shrink-0 rounded-sm border sm:h-4 sm:w-4"
                  style={{
                    borderColor: editState.isActive
                      ? theme.accents.goldenGlow
                      : theme.text.tertiary,
                    backgroundColor: editState.isActive
                      ? theme.accents.goldenGlow
                      : "transparent",
                  }}
                />
                Active (visible in game lobbies)
              </button>

              {/* Stats (read-only, edit mode only) */}
              {!isCreate && persona && (
                <div
                  className="rounded-xl border p-4 sm:p-4"
                  style={{ borderColor: theme.surfaces.elevated2 }}
                >
                  <p className="mb-2 text-sm font-bold uppercase tracking-widest sm:text-xs" style={{ color: theme.text.tertiary }}>
                    Lifetime Stats
                  </p>
                  <div className="flex flex-wrap items-center gap-4 text-base sm:gap-6 sm:text-sm">
                    <span className="flex items-center gap-1.5" style={{ color: theme.text.secondary }}>
                      <Gamepad2 className="h-5 w-5 sm:h-4 sm:w-4" />
                      {persona.stats.gamesPlayed} Played
                    </span>
                    <span className="flex items-center gap-1.5 text-green-400">
                      <Trophy className="h-5 w-5 sm:h-4 sm:w-4" />
                      {persona.stats.wins} Wins
                    </span>
                    <span className="flex items-center gap-1.5 text-red-400">
                      <XCircle className="h-5 w-5 sm:h-4 sm:w-4" />
                      {persona.stats.losses} Losses
                    </span>
                  </div>
                  {persona.stats.gamesPlayed > 0 && (
                    <div className="mt-2">
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10 sm:h-2">
                        <div
                          className="h-full rounded-full bg-green-500"
                          style={{
                            width: `${(persona.stats.wins / persona.stats.gamesPlayed) * 100}%`,
                          }}
                        />
                      </div>
                      <p className="mt-1 text-sm sm:text-xs" style={{ color: theme.text.tertiary }}>
                        {((persona.stats.wins / persona.stats.gamesPlayed) * 100).toFixed(0)}% win rate
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Error */}
              {error && (
                <p className="text-base font-medium sm:text-sm" style={{ color: theme.semantic.error }}>
                  {error}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!isLoading && (
          <div
            className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t px-4 py-3 sm:px-6 sm:py-4"
            style={{ borderColor: "rgba(255, 255, 255, 0.15)" }}
          >
            {!isCreate ? (
              <div>
                {showDeleteConfirm ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base sm:text-sm" style={{ color: theme.semantic.error }}>Delete?</span>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="min-h-[44px] rounded-lg px-4 py-2 text-base font-medium transition-colors sm:min-h-0 sm:px-3 sm:py-1.5 sm:text-sm"
                      style={{ backgroundColor: theme.semantic.error, color: "#fff" }}
                    >
                      {isDeleting ? "..." : "Yes"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="min-h-[44px] rounded-lg px-4 py-2 text-base font-medium transition-colors hover:bg-white/10 sm:min-h-0 sm:px-3 sm:py-1.5 sm:text-sm"
                      style={{ color: theme.text.secondary }}
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex min-h-[44px] items-center gap-1.5 rounded-lg px-3.5 py-2 text-base transition-colors hover:bg-white/10 sm:min-h-0 sm:py-1.5 sm:text-sm"
                    style={{ color: theme.semantic.error }}
                  >
                    <Trash2 className="h-5 w-5 sm:h-4 sm:w-4" />
                    Delete
                  </button>
                )}
              </div>
            ) : (
              <div />
            )}

            <div className="ml-auto flex flex-wrap items-center justify-end gap-2.5 sm:gap-3">
              {showSaveToast && (
                <span className="text-base font-medium text-green-400 sm:text-sm">Saved!</span>
              )}
              <button
                type="button"
                onClick={handleSave}
                disabled={isCreate ? !editState.name.trim() : (!hasChanges || isSaving)}
                className="min-h-[48px] rounded-lg px-5 py-2.5 text-base font-medium transition-all disabled:opacity-40 sm:min-h-0 sm:px-4 sm:py-2 sm:text-sm"
                style={{
                  backgroundColor: theme.accents.goldenGlow,
                  color: theme.surfaces.base,
                }}
              >
                {isSaving ? "Saving..." : isCreate ? "Create" : "Save"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
