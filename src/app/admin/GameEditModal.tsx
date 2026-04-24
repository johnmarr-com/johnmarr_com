"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Save, Trash2, Loader2, Eye, EyeOff } from "lucide-react";
import { useJMStyle } from "@/JMStyle";
import { JMImageUpload, JMAudioUpload } from "@/JMKit";
import { getContent, updateContent, deleteContent, uploadContentImage, uploadGameBackgroundMusic } from "@/lib/content";
import type { JMContent } from "@/lib/content-types";
import type { GameAssembly } from "@/app/games/_gamecore/registry/types";
import { GameAssemblyEditor } from "./GameAssemblyEditor";

interface GameEditModalProps {
  gameId: string;
  onClose: () => void;
  onUpdated: () => void;
}

interface EditState {
  name: string;
  gameLikeLabel: string;
  subtitle: string;
  description: string;
  slug: string;
  coverURL: string;
  backdropURL: string;
  splashBgURL: string;
  splashBgDim: number;
  splashIconURL: string;
  splashLogoURL: string;
  backgroundMusicURL: string;
  backgroundMusicVolume: number;
  bgMusicLandingOnly: boolean;
  minPlayers: number;
  maxPlayers: number;
  trueSoloMode: boolean;
  retentionDays: number;
  primaryColor: string;
  secondaryColor: string;
  tertiaryColor: string;
  dangerColor: string;
  isPublished: boolean;
  assembly: GameAssembly | undefined;
}

function stateFromGame(game: JMContent): EditState {
  return {
    name: game.name,
    gameLikeLabel: game.gameLikeLabel ?? "",
    subtitle: game.subtitle ?? "",
    description: game.description,
    slug: game.slug ?? "",
    coverURL: game.coverURL,
    backdropURL: game.backdropURL ?? "",
    splashBgURL: game.splashBgURL ?? "",
    splashBgDim: game.splashBgDim ?? 50,
    splashIconURL: game.splashIconURL ?? "",
    splashLogoURL: game.splashLogoURL ?? "",
    backgroundMusicURL: game.backgroundMusicURL ?? "",
    backgroundMusicVolume: game.backgroundMusicVolume ?? 0.3,
    bgMusicLandingOnly: game.bgMusicLandingOnly ?? false,
    minPlayers: game.minPlayers ?? 1,
    maxPlayers: game.maxPlayers ?? 2,
    trueSoloMode: game.trueSoloMode ?? false,
    retentionDays: game.retentionDays ?? 1,
    primaryColor: game.primaryColor ?? "",
    secondaryColor: game.secondaryColor ?? "",
    tertiaryColor: game.tertiaryColor ?? "",
    dangerColor: game.dangerColor ?? "",
    isPublished: game.isPublished,
    assembly: (game as unknown as Record<string, unknown>)["assembly"] as GameAssembly | undefined,
  };
}

export function GameEditModal({ gameId, onClose, onUpdated }: GameEditModalProps) {
  const { theme } = useJMStyle();

  const [game, setGame] = useState<JMContent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editState, setEditState] = useState<EditState | null>(null);
  const [originalState, setOriginalState] = useState<EditState | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveToast, setShowSaveToast] = useState(false);

  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleCoverUpload = useCallback(
    async (file: File) => uploadContentImage(file, gameId, "cover"),
    [gameId],
  );

  const handleBannerUpload = useCallback(
    async (file: File) => uploadContentImage(file, gameId, "backdrop"),
    [gameId],
  );

  const handleSplashBgUpload = useCallback(
    async (file: File) => uploadContentImage(file, gameId, "splashBg"),
    [gameId],
  );

  const handleSplashIconUpload = useCallback(
    async (file: File) => uploadContentImage(file, gameId, "splashIcon"),
    [gameId],
  );

  const handleSplashLogoUpload = useCallback(
    async (file: File) => uploadContentImage(file, gameId, "splashLogo"),
    [gameId],
  );

  const handleBgMusicUpload = useCallback(
    async (file: File) => uploadGameBackgroundMusic(file, gameId),
    [gameId],
  );

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const data = await getContent(gameId);
        if (!data) {
          setError("Game not found");
          return;
        }
        setGame(data);
        const s = stateFromGame(data);
        setEditState(s);
        setOriginalState(s);
      } catch (err) {
        console.error("Failed to load game:", err);
        setError(err instanceof Error ? err.message : "Failed to load game");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [gameId]);

  const hasChanges =
    editState && originalState && JSON.stringify(editState) !== JSON.stringify(originalState);

  const handleSave = async () => {
    if (!editState || !hasChanges) return;

    setIsSaving(true);
    setError(null);
    try {
      const { deleteField } = await import("firebase/firestore");
      const updates: Parameters<typeof updateContent>[1] = {
        name: editState.name.trim(),
        description: editState.description.trim(),
        coverURL: editState.coverURL.trim(),
        isPublished: editState.isPublished,
      };
      if (editState.gameLikeLabel.trim()) {
        updates.gameLikeLabel = editState.gameLikeLabel.trim();
      } else {
        (updates as Record<string, unknown>)["gameLikeLabel"] = deleteField();
      }
      if (editState.subtitle.trim()) updates.subtitle = editState.subtitle.trim();
      if (editState.slug.trim()) updates.slug = editState.slug.trim();
      if (editState.backdropURL.trim()) updates.backdropURL = editState.backdropURL.trim();
      if (editState.splashBgURL.trim()) updates.splashBgURL = editState.splashBgURL.trim();
      updates.splashBgDim = editState.splashBgDim;
      if (editState.splashIconURL.trim()) updates.splashIconURL = editState.splashIconURL.trim();
      if (editState.splashLogoURL.trim()) updates.splashLogoURL = editState.splashLogoURL.trim();
      if (editState.backgroundMusicURL.trim()) {
        updates.backgroundMusicURL = editState.backgroundMusicURL.trim();
        updates.backgroundMusicVolume = editState.backgroundMusicVolume;
      }
      updates.bgMusicLandingOnly = editState.bgMusicLandingOnly;
      if (editState.minPlayers > 0) updates.minPlayers = editState.minPlayers;
      if (editState.maxPlayers > 0) updates.maxPlayers = editState.maxPlayers;
      updates.trueSoloMode = editState.trueSoloMode;
      updates.retentionDays = editState.retentionDays;
      if (editState.primaryColor.trim()) updates.primaryColor = editState.primaryColor.trim();
      if (editState.secondaryColor.trim()) updates.secondaryColor = editState.secondaryColor.trim();
      if (editState.tertiaryColor.trim()) updates.tertiaryColor = editState.tertiaryColor.trim();
      if (editState.dangerColor.trim()) updates.dangerColor = editState.dangerColor.trim();
      if (editState.assembly) updates.assembly = editState.assembly;

      await updateContent(gameId, updates);

      setOriginalState({ ...editState });
      setShowSaveToast(true);
      setTimeout(() => setShowSaveToast(false), 2000);
      onUpdated();
    } catch (err) {
      console.error("Failed to save:", err);
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteContent(gameId);
      onUpdated();
      onClose();
    } catch (err) {
      console.error("Failed to delete:", err);
      setError(err instanceof Error ? err.message : "Failed to delete game");
      setIsDeleting(false);
    }
  };

  const update = (patch: Partial<EditState>) => {
    setEditState((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />

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
            {game?.name ?? "Edit Game"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 transition-colors hover:bg-white/10"
            style={{ color: theme.text.secondary }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={24} className="animate-spin" style={{ color: theme.accents.goldenGlow }} />
            </div>
          ) : error && !editState ? (
            <div className="py-12 text-center text-sm" style={{ color: theme.semantic.error }}>
              {error}
            </div>
          ) : editState ? (
            <div className="space-y-5">
              {/* Published toggle */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => update({ isPublished: !editState.isPublished })}
                  className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: editState.isPublished
                      ? `${theme.semantic.success}20`
                      : theme.surfaces.elevated2,
                    color: editState.isPublished ? theme.semantic.success : theme.text.tertiary,
                  }}
                >
                  {editState.isPublished ? <Eye size={14} /> : <EyeOff size={14} />}
                  {editState.isPublished ? "Published" : "Draft"}
                </button>
              </div>

              {/* Title */}
              <div>
                <label className="mb-2 block text-sm font-medium" style={{ color: theme.text.secondary }}>
                  Title
                </label>
                <input
                  type="text"
                  value={editState.name}
                  onChange={(e) => update({ name: e.target.value })}
                  className="w-full rounded-lg border px-4 py-3 text-sm focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: "rgba(0, 0, 0, 0.4)",
                    borderColor: "rgba(255, 255, 255, 0.2)",
                    color: theme.text.primary,
                    // @ts-expect-error CSS custom property
                    "--tw-ring-color": theme.accents.goldenGlow,
                  }}
                />
              </div>

              {/* Game like label (landing top-right) */}
              <div>
                <label className="mb-2 block text-sm font-medium" style={{ color: theme.text.secondary }}>
                  Game Like Label
                </label>
                <input
                  type="text"
                  value={editState.gameLikeLabel}
                  onChange={(e) => update({ gameLikeLabel: e.target.value })}
                  placeholder="Game meets Game"
                  className="w-full rounded-lg border px-4 py-3 text-sm focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: "rgba(0, 0, 0, 0.4)",
                    borderColor: "rgba(255, 255, 255, 0.2)",
                    color: theme.text.primary,
                    // @ts-expect-error CSS custom property
                    "--tw-ring-color": theme.accents.goldenGlow,
                  }}
                />
              </div>

              {/* Subtitle */}
              <div>
                <label className="mb-2 block text-sm font-medium" style={{ color: theme.text.secondary }}>
                  Subtitle
                </label>
                <input
                  type="text"
                  value={editState.subtitle}
                  onChange={(e) => update({ subtitle: e.target.value })}
                  placeholder="Optional subtitle..."
                  className="w-full rounded-lg border px-4 py-3 text-sm focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: "rgba(0, 0, 0, 0.4)",
                    borderColor: "rgba(255, 255, 255, 0.2)",
                    color: theme.text.primary,
                    // @ts-expect-error CSS custom property
                    "--tw-ring-color": theme.accents.goldenGlow,
                  }}
                />
              </div>

              {/* Description */}
              <div>
                <label className="mb-2 block text-sm font-medium" style={{ color: theme.text.secondary }}>
                  Description
                </label>
                <textarea
                  value={editState.description}
                  onChange={(e) => update({ description: e.target.value })}
                  rows={3}
                  className="w-full resize-none rounded-lg border px-4 py-3 text-sm focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: "rgba(0, 0, 0, 0.4)",
                    borderColor: "rgba(255, 255, 255, 0.2)",
                    color: theme.text.primary,
                    // @ts-expect-error CSS custom property
                    "--tw-ring-color": theme.accents.goldenGlow,
                  }}
                />
              </div>

              {/* Game Path */}
              <div>
                <label className="mb-2 block text-sm font-medium" style={{ color: theme.text.secondary }}>
                  Game Path
                </label>
                <input
                  type="text"
                  value={editState.slug}
                  onChange={(e) =>
                    update({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })
                  }
                  placeholder="sweeptheleg"
                  className="w-full rounded-lg border px-4 py-3 text-sm focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: "rgba(0, 0, 0, 0.4)",
                    borderColor: "rgba(255, 255, 255, 0.2)",
                    color: theme.text.primary,
                    // @ts-expect-error CSS custom property
                    "--tw-ring-color": theme.accents.goldenGlow,
                  }}
                />
                <p className="mt-1 text-xs" style={{ color: theme.text.tertiary }}>
                  URL: /games/{editState.slug || "..."}
                </p>
              </div>

              {/* Cover & Banner */}
              <div className="flex flex-col gap-4">
                <JMImageUpload
                  label="Cover (1:1)"
                  value={editState.coverURL}
                  onChange={(url) => update({ coverURL: url || "" })}
                  onUpload={handleCoverUpload}
                  aspectRatio="square"
                  previewSize={200}
                  maxWidth={640}
                  required
                />
                <JMImageUpload
                  label="Banner (16:9)"
                  value={editState.backdropURL}
                  onChange={(url) => update({ backdropURL: url || "" })}
                  onUpload={handleBannerUpload}
                  aspectRatio="landscape"
                  previewSize={200}
                  maxWidth={1920}
                />
              </div>

              {/* Splash Screen Images */}
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: theme.text.tertiary }}>
                  Splash Screen
                </p>
                <div className="flex flex-col gap-4">
                  <JMImageUpload
                    label="Splash Background"
                    value={editState.splashBgURL}
                    onChange={(url) => update({ splashBgURL: url || "" })}
                    onUpload={handleSplashBgUpload}
                    aspectRatio="landscape"
                    previewSize={200}
                  />
                  {editState.splashBgURL && (
                    <div>
                      <label
                        className="mb-1 block text-sm font-medium"
                        style={{ color: theme.text.secondary }}
                      >
                        Background Dim — {editState.splashBgDim}%
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={editState.splashBgDim}
                        onChange={(e) => update({ splashBgDim: parseInt(e.target.value) })}
                        className="w-full accent-yellow-400"
                      />
                    </div>
                  )}
                  <JMImageUpload
                    label="Splash Logo (2:1)"
                    value={editState.splashLogoURL}
                    onChange={(url) => update({ splashLogoURL: url || "" })}
                    onUpload={handleSplashLogoUpload}
                    aspectRatio="wide"
                    previewSize={200}
                  />
                  <JMImageUpload
                    label="Splash Icon (4:3)"
                    value={editState.splashIconURL}
                    onChange={(url) => update({ splashIconURL: url || "" })}
                    onUpload={handleSplashIconUpload}
                    aspectRatio="landscape"
                    previewSize={200}
                  />
                </div>
              </div>

              {/* Background Music */}
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: theme.text.tertiary }}>
                  Background Music
                </p>
                <p className="mb-3 text-xs" style={{ color: theme.text.tertiary }}>
                  Loops during gameplay. Falls back to <code>/music/{editState.slug || "..."}.mp3</code> if not set.
                </p>
                <JMAudioUpload
                  label="Music Track"
                  {...(editState.backgroundMusicURL ? { value: editState.backgroundMusicURL } : {})}
                  onChange={(url) => update({ backgroundMusicURL: url || "" })}
                  onUpload={handleBgMusicUpload}
                  maxSizeMB={30}
                />
                {editState.backgroundMusicURL && (
                  <div className="mt-3">
                    <label
                      className="mb-1 block text-sm font-medium"
                      style={{ color: theme.text.secondary }}
                    >
                      Volume — {Math.round(editState.backgroundMusicVolume * 100)}%
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={editState.backgroundMusicVolume}
                      onChange={(e) => update({ backgroundMusicVolume: parseFloat(e.target.value) })}
                      className="w-full accent-yellow-400"
                    />
                  </div>
                )}
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => update({ bgMusicLandingOnly: !editState.bgMusicLandingOnly })}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors"
                    style={{
                      backgroundColor: editState.bgMusicLandingOnly
                        ? `${theme.accents.goldenGlow}20`
                        : theme.surfaces.elevated2,
                      color: editState.bgMusicLandingOnly
                        ? theme.accents.goldenGlow
                        : theme.text.tertiary,
                    }}
                  >
                    <span
                      className="inline-block h-4 w-4 rounded-sm border"
                      style={{
                        borderColor: editState.bgMusicLandingOnly
                          ? theme.accents.goldenGlow
                          : theme.text.tertiary,
                        backgroundColor: editState.bgMusicLandingOnly
                          ? theme.accents.goldenGlow
                          : "transparent",
                      }}
                    />
                    Background music only plays on landing page
                  </button>
                  <p className="mt-1 ml-1 text-xs" style={{ color: theme.text.tertiary }}>
                    When on, music stops when the game starts.
                  </p>
                </div>
              </div>

              {/* Min / Max Players */}
              <div className="flex gap-6">
                <div>
                  <label
                    className="mb-1 block text-sm font-medium"
                    style={{ color: theme.text.secondary }}
                  >
                    Min Players
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={editState.minPlayers}
                    onChange={(e) => update({ minPlayers: e.target.valueAsNumber || 0 })}
                    onBlur={(e) => { if (!e.target.value || editState.minPlayers < 1) update({ minPlayers: 1 }); }}
                    className="w-24 rounded-lg border px-3 py-2 text-sm"
                    style={{
                      backgroundColor: theme.surfaces.elevated1,
                      borderColor: theme.surfaces.elevated2,
                      color: theme.text.primary,
                    }}
                  />
                </div>
                <div>
                  <label
                    className="mb-1 block text-sm font-medium"
                    style={{ color: theme.text.secondary }}
                  >
                    Max Players
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={20}
                    value={editState.maxPlayers}
                    onChange={(e) => update({ maxPlayers: e.target.valueAsNumber || 0 })}
                    onBlur={(e) => { if (!e.target.value || editState.maxPlayers < 2) update({ maxPlayers: 2 }); }}
                    className="w-24 rounded-lg border px-3 py-2 text-sm"
                    style={{
                      backgroundColor: theme.surfaces.elevated1,
                      borderColor: theme.surfaces.elevated2,
                      color: theme.text.primary,
                    }}
                  />
                </div>
              </div>

              {/* True Solo Mode */}
              <button
                type="button"
                onClick={() => update({ trueSoloMode: !editState.trueSoloMode })}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors"
                style={{
                  backgroundColor: editState.trueSoloMode
                    ? `${theme.accents.goldenGlow}20`
                    : theme.surfaces.elevated2,
                  color: editState.trueSoloMode
                    ? theme.accents.goldenGlow
                    : theme.text.tertiary,
                }}
              >
                <span
                  className="inline-block h-4 w-4 rounded-sm border"
                  style={{
                    borderColor: editState.trueSoloMode
                      ? theme.accents.goldenGlow
                      : theme.text.tertiary,
                    backgroundColor: editState.trueSoloMode
                      ? theme.accents.goldenGlow
                      : "transparent",
                  }}
                />
                True Solo Mode (no AI opponent)
              </button>
              <p className="mt-[-12px] ml-1 text-xs" style={{ color: theme.text.tertiary }}>
                When on, the &quot;Play Solo&quot; button won&apos;t mention AI.
              </p>

              {/* Data Retention */}
              <div>
                <label
                  className="mb-2 block text-sm font-medium"
                  style={{ color: theme.text.secondary }}
                >
                  Delete Game Data
                </label>
                <div className="flex gap-2">
                  {([1, 30] as const).map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => update({ retentionDays: days })}
                      className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                      style={{
                        backgroundColor:
                          editState.retentionDays === days
                            ? `${theme.accents.goldenGlow}20`
                            : theme.surfaces.elevated2,
                        color:
                          editState.retentionDays === days
                            ? theme.accents.goldenGlow
                            : theme.text.tertiary,
                      }}
                    >
                      {days === 1 ? "Daily" : "Monthly"}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-xs" style={{ color: theme.text.tertiary }}>
                  Sessions and sketches older than {editState.retentionDays === 1 ? "24 hours" : "30 days"} are cleaned up automatically.
                </p>
              </div>

              {/* Game Colors */}
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: theme.text.tertiary }}>
                  Game Colors
                </p>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="mb-1 block text-sm font-medium" style={{ color: theme.text.secondary }}>
                      Primary
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={editState.primaryColor || "#ffffff"}
                        onChange={(e) => setEditState({ ...editState, primaryColor: e.target.value })}
                        className="h-9 w-9 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                      />
                      <input
                        type="text"
                        value={editState.primaryColor}
                        onChange={(e) => setEditState({ ...editState, primaryColor: e.target.value })}
                        placeholder="#E84C1E"
                        className="w-full rounded-lg border px-3 py-2 text-sm font-mono"
                        style={{
                          backgroundColor: "rgba(0, 0, 0, 0.4)",
                          borderColor: "rgba(255, 255, 255, 0.2)",
                          color: theme.text.primary,
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="mb-1 block text-sm font-medium" style={{ color: theme.text.secondary }}>
                      Secondary
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={editState.secondaryColor || "#ffffff"}
                        onChange={(e) => setEditState({ ...editState, secondaryColor: e.target.value })}
                        className="h-9 w-9 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                      />
                      <input
                        type="text"
                        value={editState.secondaryColor}
                        onChange={(e) => setEditState({ ...editState, secondaryColor: e.target.value })}
                        placeholder="#3B82F6"
                        className="w-full rounded-lg border px-3 py-2 text-sm font-mono"
                        style={{
                          backgroundColor: "rgba(0, 0, 0, 0.4)",
                          borderColor: "rgba(255, 255, 255, 0.2)",
                          color: theme.text.primary,
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex gap-4">
                  <div className="flex-1">
                    <label className="mb-1 block text-sm font-medium" style={{ color: theme.text.secondary }}>
                      Tertiary
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={editState.tertiaryColor || "#ffffff"}
                        onChange={(e) => setEditState({ ...editState, tertiaryColor: e.target.value })}
                        className="h-9 w-9 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                      />
                      <input
                        type="text"
                        value={editState.tertiaryColor}
                        onChange={(e) => setEditState({ ...editState, tertiaryColor: e.target.value })}
                        placeholder="#2B4B6F"
                        className="w-full rounded-lg border px-3 py-2 text-sm font-mono"
                        style={{
                          backgroundColor: "rgba(0, 0, 0, 0.4)",
                          borderColor: "rgba(255, 255, 255, 0.2)",
                          color: theme.text.primary,
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="mb-1 block text-sm font-medium" style={{ color: theme.text.secondary }}>
                      Danger
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={editState.dangerColor || "#ffffff"}
                        onChange={(e) => setEditState({ ...editState, dangerColor: e.target.value })}
                        className="h-9 w-9 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                      />
                      <input
                        type="text"
                        value={editState.dangerColor}
                        onChange={(e) => setEditState({ ...editState, dangerColor: e.target.value })}
                        placeholder="#C93C3C"
                        className="w-full rounded-lg border px-3 py-2 text-sm font-mono"
                        style={{
                          backgroundColor: "rgba(0, 0, 0, 0.4)",
                          borderColor: "rgba(255, 255, 255, 0.2)",
                          color: theme.text.primary,
                        }}
                      />
                    </div>
                  </div>
                </div>
                <p className="mt-1 text-xs" style={{ color: theme.text.tertiary }}>
                  Game palette: primary (titles, highlights), secondary (names, accents), tertiary (backgrounds, secondary actions), danger (alerts, enemy labels).
                </p>
              </div>

              {/* Game Assembly */}
              <GameAssemblyEditor
                value={editState.assembly}
                gameName={editState.name || "Game"}
                onChange={(assembly) => update({ assembly })}
              />

              {error && (
                <div
                  className="rounded-lg px-4 py-2 text-sm"
                  style={{
                    backgroundColor: `${theme.semantic.error}20`,
                    color: theme.semantic.error,
                  }}
                >
                  {error}
                </div>
              )}

              {/* Delete */}
              <div className="border-t pt-4" style={{ borderColor: "rgba(255, 255, 255, 0.1)" }}>
                {showDeleteConfirm ? (
                  <div className="flex items-center gap-3">
                    <span className="text-sm" style={{ color: theme.semantic.error }}>
                      Delete this game permanently?
                    </span>
                    <button
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="rounded-lg px-3 py-1.5 text-sm font-medium"
                      style={{
                        backgroundColor: `${theme.semantic.error}20`,
                        color: theme.semantic.error,
                      }}
                    >
                      {isDeleting ? "Deleting..." : "Yes, Delete"}
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="rounded-lg px-3 py-1.5 text-sm"
                      style={{ color: theme.text.tertiary }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center gap-2 text-sm transition-colors hover:opacity-80"
                    style={{ color: theme.semantic.error }}
                  >
                    <Trash2 size={14} />
                    Delete Game
                  </button>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        {editState && (
          <div
            className="relative flex shrink-0 items-center justify-end border-t px-6 py-4"
            style={{ borderColor: "rgba(255, 255, 255, 0.15)" }}
          >
            {showSaveToast && (
              <div
                className="absolute left-6 rounded-full px-3 py-1 text-xs font-medium"
                style={{
                  backgroundColor: `${theme.semantic.success}20`,
                  color: theme.semantic.success,
                }}
              >
                Saved!
              </div>
            )}
            <button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-medium transition-all hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
              style={{
                backgroundColor: theme.accents.goldenGlow,
                color: theme.surfaces.base,
              }}
            >
              {isSaving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Save Changes
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
