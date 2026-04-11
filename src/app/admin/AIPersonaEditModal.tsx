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
import { getAvatarScale } from "@/lib/avatar-scale-map";

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
    try {
      const res = await fetch("/api/avatars");
      if (!res.ok) return;
      const data = await res.json();
      const items: JMAvatarItem[] = (data as { file: string; name: string }[]).map(
        (a) => ({
          filename: a.file,
          name: a.name,
          scale: getAvatarScale(a.file),
        }),
      );
      setAvatars(items);
    } catch {
      /* ignore */
    }
  }, []);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

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
          className="flex shrink-0 items-center justify-between border-b px-6 py-4"
          style={{ borderColor: "rgba(255, 255, 255, 0.15)" }}
        >
          <h2 className="text-lg font-semibold" style={{ color: theme.text.primary }}>
            {isCreate ? "New AI Persona" : (persona?.name ?? "Edit Persona")}
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 transition-colors hover:bg-white/10"
            style={{ color: theme.text.tertiary }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" style={{ color: theme.accents.goldenGlow }} />
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {/* Avatar */}
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                  className="transition-colors"
                >
                  {editState.avatarName ? (
                    <JMAIAvatarView size={128} avatarName={editState.avatarName} scaleOverride={editState.avatarScale} />
                  ) : (
                    <div
                      className="flex h-32 w-32 items-center justify-center rounded-full border-2 border-dashed transition-colors hover:border-white/40"
                      style={{ borderColor: "rgba(255,255,255,0.2)" }}
                    >
                      <span className="text-xs" style={{ color: theme.text.tertiary }}>Avatar</span>
                    </div>
                  )}
                </button>
                <div className="flex-1">
                  <label className="mb-1 block text-sm font-medium" style={{ color: theme.text.secondary }}>
                    Name
                  </label>
                  <input
                    type="text"
                    value={editState.name}
                    onChange={(e) => update({ name: e.target.value })}
                    placeholder="Agent VIPER"
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    style={{
                      backgroundColor: theme.surfaces.elevated1,
                      borderColor: theme.surfaces.elevated2,
                      color: theme.text.primary,
                    }}
                  />
                </div>
              </div>

              {/* Avatar picker (collapsible) */}
              {showAvatarPicker && avatars.length > 0 && (
                <div
                  className="max-h-[240px] overflow-y-auto rounded-xl border p-2"
                  style={{ borderColor: theme.surfaces.elevated2 }}
                >
                  <JMAvatarPicker
                    avatars={avatars}
                    mode="selector"
                    onSelect={(avatar: JMAvatarItem) => {
                      update({ avatarName: avatar.filename });
                      setShowAvatarPicker(false);
                    }}
                  />
                </div>
              )}

              {/* Avatar Scale */}
              {editState.avatarName && (
                <div>
                  <label className="mb-1 flex items-center justify-between text-sm font-medium" style={{ color: theme.text.secondary }}>
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
                    className="w-full accent-amber-400"
                  />
                  <div className="mt-0.5 flex justify-between text-[10px]" style={{ color: theme.text.tertiary }}>
                    <span>0.5x</span>
                    <span>1.0x</span>
                    <span>3.0x</span>
                  </div>

                  {/* Recolor button */}
                  {!showColorEditor && (
                    <button
                      type="button"
                      onClick={() => setShowColorEditor(true)}
                      className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-medium text-white/60 transition-colors hover:bg-white/5 hover:text-white"
                    >
                      <Palette size={14} />
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
                <label className="mb-1 block text-sm font-medium" style={{ color: theme.text.secondary }}>
                  Play Style
                </label>
                <div className="flex flex-wrap gap-2">
                  {PLAY_STYLES.map((style) => {
                    const active = editState.playStyle === style;
                    const colors = PLAY_STYLE_COLORS[style];
                    return (
                      <button
                        key={style}
                        onClick={() => update({ playStyle: style })}
                        className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-all ${
                          active ? colors : "text-white/40 bg-white/5"
                        } ${active ? "ring-1 ring-white/20" : "hover:bg-white/10"}`}
                      >
                        {style}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: theme.text.secondary }}>
                  Short Description
                </label>
                <input
                  type="text"
                  value={editState.description}
                  onChange={(e) => update({ description: e.target.value })}
                  placeholder="Ruthless and direct. Always goes for the kill shot."
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{
                    backgroundColor: theme.surfaces.elevated1,
                    borderColor: theme.surfaces.elevated2,
                    color: theme.text.primary,
                  }}
                />
              </div>

              {/* Prompt */}
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: theme.text.secondary }}>
                  AI Prompt
                </label>
                <textarea
                  value={editState.prompt}
                  onChange={(e) => update({ prompt: e.target.value })}
                  placeholder="You are an aggressive player who shows no mercy. You go for the big kill..."
                  rows={4}
                  className="w-full resize-y rounded-lg border px-3 py-2 text-sm"
                  style={{
                    backgroundColor: theme.surfaces.elevated1,
                    borderColor: theme.surfaces.elevated2,
                    color: theme.text.primary,
                  }}
                />
                <p className="mt-1 text-xs" style={{ color: theme.text.tertiary }}>
                  Injected into the system prompt for every AI call made by this persona.
                </p>
              </div>

              {/* Voice */}
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: theme.text.secondary }}>
                  Voice
                </label>
                <textarea
                  value={editState.voice}
                  onChange={(e) => update({ voice: e.target.value })}
                  placeholder="Speaks in short, punchy sentences. Uses military jargon. Never apologizes."
                  rows={3}
                  className="w-full resize-y rounded-lg border px-3 py-2 text-sm"
                  style={{
                    backgroundColor: theme.surfaces.elevated1,
                    borderColor: theme.surfaces.elevated2,
                    color: theme.text.primary,
                  }}
                />
                <p className="mt-1 text-xs" style={{ color: theme.text.tertiary }}>
                  Styles post-game transcripts and future in-game taunts.
                </p>
              </div>

              {/* Active toggle */}
              <button
                type="button"
                onClick={() => update({ isActive: !editState.isActive })}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors"
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
                  className="inline-block h-4 w-4 rounded-sm border"
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
                  className="rounded-xl border p-4"
                  style={{ borderColor: theme.surfaces.elevated2 }}
                >
                  <p className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: theme.text.tertiary }}>
                    Lifetime Stats
                  </p>
                  <div className="flex items-center gap-6 text-sm">
                    <span className="flex items-center gap-1.5" style={{ color: theme.text.secondary }}>
                      <Gamepad2 size={14} />
                      {persona.stats.gamesPlayed} Played
                    </span>
                    <span className="flex items-center gap-1.5 text-green-400">
                      <Trophy size={14} />
                      {persona.stats.wins} Wins
                    </span>
                    <span className="flex items-center gap-1.5 text-red-400">
                      <XCircle size={14} />
                      {persona.stats.losses} Losses
                    </span>
                  </div>
                  {persona.stats.gamesPlayed > 0 && (
                    <div className="mt-2">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-green-500"
                          style={{
                            width: `${(persona.stats.wins / persona.stats.gamesPlayed) * 100}%`,
                          }}
                        />
                      </div>
                      <p className="mt-1 text-xs" style={{ color: theme.text.tertiary }}>
                        {((persona.stats.wins / persona.stats.gamesPlayed) * 100).toFixed(0)}% win rate
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Error */}
              {error && (
                <p className="text-sm font-medium" style={{ color: theme.semantic.error }}>
                  {error}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!isLoading && (
          <div
            className="flex shrink-0 items-center justify-between border-t px-6 py-4"
            style={{ borderColor: "rgba(255, 255, 255, 0.15)" }}
          >
            {!isCreate ? (
              <div>
                {showDeleteConfirm ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm" style={{ color: theme.semantic.error }}>Delete?</span>
                    <button
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
                      style={{ backgroundColor: theme.semantic.error, color: "#fff" }}
                    >
                      {isDeleting ? "..." : "Yes"}
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors hover:bg-white/10"
                      style={{ color: theme.text.secondary }}
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-white/10"
                    style={{ color: theme.semantic.error }}
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                )}
              </div>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-3">
              {showSaveToast && (
                <span className="text-sm font-medium text-green-400">Saved!</span>
              )}
              <button
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:bg-white/10"
                style={{ color: theme.text.secondary }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isCreate ? !editState.name.trim() : (!hasChanges || isSaving)}
                className="rounded-lg px-4 py-2 text-sm font-medium transition-all disabled:opacity-40"
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
