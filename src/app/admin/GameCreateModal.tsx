"use client";

import { useState, useCallback, useRef } from "react";
import { X, Check, Loader2, Eye, EyeOff } from "lucide-react";
import { useJMStyle } from "@/JMStyle";
import { JMImageUpload, JMAudioUpload } from "@/JMKit";
import { useAuth } from "@/lib/AuthProvider";
import { createContent, uploadContentImage, uploadGameBackgroundMusic } from "@/lib/content";

interface GameCreateModalProps {
  onClose: () => void;
  onCreated: () => void;
}

export function GameCreateModal({ onClose, onCreated }: GameCreateModalProps) {
  const { theme } = useJMStyle();
  const { user } = useAuth();

  const [name, setName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [coverURL, setCoverURL] = useState("");
  const [backdropURL, setBackdropURL] = useState("");
  const [splashBgURL, setSplashBgURL] = useState("");
  const [splashIconURL, setSplashIconURL] = useState("");
  const [splashLogoURL, setSplashLogoURL] = useState("");
  const [backgroundMusicURL, setBackgroundMusicURL] = useState("");
  const [backgroundMusicVolume, setBackgroundMusicVolume] = useState(0.3);
  const [bgMusicLandingOnly, setBgMusicLandingOnly] = useState(false);
  const [minPlayers, setMinPlayers] = useState(1);
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [retentionDays, setRetentionDays] = useState(1);
  const [isPublished, setIsPublished] = useState(false);

  const tempIdRef = useRef(`new-${Date.now()}`);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCoverUpload = useCallback(async (file: File) => {
    return uploadContentImage(file, tempIdRef.current, "cover");
  }, []);

  const handleBannerUpload = useCallback(async (file: File) => {
    return uploadContentImage(file, tempIdRef.current, "backdrop");
  }, []);

  const handleSplashBgUpload = useCallback(async (file: File) => {
    return uploadContentImage(file, tempIdRef.current, "splashBg");
  }, []);

  const handleSplashIconUpload = useCallback(async (file: File) => {
    return uploadContentImage(file, tempIdRef.current, "splashIcon");
  }, []);

  const handleSplashLogoUpload = useCallback(async (file: File) => {
    return uploadContentImage(file, tempIdRef.current, "splashLogo");
  }, []);

  const handleBgMusicUpload = useCallback(async (file: File) => {
    return uploadGameBackgroundMusic(file, tempIdRef.current);
  }, []);

  const handleCreate = async () => {
    if (!user || !name.trim() || !slug.trim()) return;

    setIsCreating(true);
    setError(null);

    try {
      const input: Parameters<typeof createContent>[0] = {
        contentType: "game",
        contentLevel: "standalone",
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim(),
        coverURL: coverURL.trim() || "",
        isPublished,
      };
      if (subtitle.trim()) input.subtitle = subtitle.trim();
      if (backdropURL.trim()) input.backdropURL = backdropURL.trim();
      if (splashBgURL.trim()) input.splashBgURL = splashBgURL.trim();
      if (splashIconURL.trim()) input.splashIconURL = splashIconURL.trim();
      if (splashLogoURL.trim()) input.splashLogoURL = splashLogoURL.trim();
      if (backgroundMusicURL.trim()) {
        input.backgroundMusicURL = backgroundMusicURL.trim();
        input.backgroundMusicVolume = backgroundMusicVolume;
      }
      input.bgMusicLandingOnly = bgMusicLandingOnly;
      if (minPlayers > 0) input.minPlayers = minPlayers;
      if (maxPlayers > 0) input.maxPlayers = maxPlayers;
      input.retentionDays = retentionDays;

      await createContent(input, user.uid);
      onCreated();
    } catch (err) {
      console.error("Failed to create game:", err);
      setError(err instanceof Error ? err.message : "Failed to create game");
    } finally {
      setIsCreating(false);
    }
  };

  const canCreate = name.trim().length > 0 && slug.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border-2"
        style={{
          backgroundColor: "rgba(20, 20, 20, 1)",
          borderColor: "rgba(255, 255, 255, 0.2)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b px-6 py-4"
          style={{ borderColor: "rgba(255, 255, 255, 0.15)" }}
        >
          <h2 className="text-lg font-semibold" style={{ color: theme.text.primary }}>
            New Game
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 transition-colors hover:bg-white/10"
            style={{ color: theme.text.secondary }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <div className="max-h-[70vh] overflow-y-auto p-6">
          <div className="space-y-5">
            {/* Published toggle */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsPublished(!isPublished)}
                className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
                style={{
                  backgroundColor: isPublished
                    ? `${theme.semantic.success}20`
                    : theme.surfaces.elevated2,
                  color: isPublished ? theme.semantic.success : theme.text.tertiary,
                }}
              >
                {isPublished ? <Eye size={14} /> : <EyeOff size={14} />}
                {isPublished ? "Published" : "Draft"}
              </button>
              <span className="text-xs" style={{ color: theme.text.tertiary }}>
                {isPublished ? "Will be visible to users" : "Only visible to admins"}
              </span>
            </div>

            {/* Title */}
            <div>
              <label
                className="mb-2 block text-sm font-medium"
                style={{ color: theme.text.secondary }}
              >
                Title <span style={{ color: theme.semantic.error }}>*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter game title..."
                autoFocus
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
              <label
                className="mb-2 block text-sm font-medium"
                style={{ color: theme.text.secondary }}
              >
                Subtitle
              </label>
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
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
              <label
                className="mb-2 block text-sm font-medium"
                style={{ color: theme.text.secondary }}
              >
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the game..."
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

            {/* Game Path (slug) */}
            <div>
              <label
                className="mb-2 block text-sm font-medium"
                style={{ color: theme.text.secondary }}
              >
                Game Path <span style={{ color: theme.semantic.error }}>*</span>
              </label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
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
                URL: /games/{slug || "..."}
              </p>
            </div>

            {/* Cover & Banner Images */}
            <div className="flex flex-col gap-4">
              <JMImageUpload
                label="Cover (1:1)"
                value={coverURL}
                onChange={(url) => setCoverURL(url || "")}
                onUpload={handleCoverUpload}
                aspectRatio="square"
                previewSize={200}
                maxWidth={640}
                required
              />
              <JMImageUpload
                label="Banner (16:9)"
                value={backdropURL}
                onChange={(url) => setBackdropURL(url || "")}
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
                  value={splashBgURL}
                  onChange={(url) => setSplashBgURL(url || "")}
                  onUpload={handleSplashBgUpload}
                  aspectRatio="landscape"
                  previewSize={200}
                />
                <JMImageUpload
                  label="Splash Logo (2:1)"
                  value={splashLogoURL}
                  onChange={(url) => setSplashLogoURL(url || "")}
                  onUpload={handleSplashLogoUpload}
                  aspectRatio="wide"
                  previewSize={200}
                />
                <JMImageUpload
                  label="Splash Icon (4:3)"
                  value={splashIconURL}
                  onChange={(url) => setSplashIconURL(url || "")}
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
                Loops during gameplay. Falls back to <code>/music/{slug || "..."}.mp3</code> if not set.
              </p>
              <JMAudioUpload
                label="Music Track"
                {...(backgroundMusicURL ? { value: backgroundMusicURL } : {})}
                onChange={(url) => setBackgroundMusicURL(url || "")}
                onUpload={handleBgMusicUpload}
                maxSizeMB={30}
              />
              {backgroundMusicURL && (
                <div className="mt-3">
                  <label
                    className="mb-1 block text-sm font-medium"
                    style={{ color: theme.text.secondary }}
                  >
                    Volume — {Math.round(backgroundMusicVolume * 100)}%
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={backgroundMusicVolume}
                    onChange={(e) => setBackgroundMusicVolume(parseFloat(e.target.value))}
                    className="w-full accent-yellow-400"
                  />
                </div>
              )}
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setBgMusicLandingOnly(!bgMusicLandingOnly)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors"
                  style={{
                    backgroundColor: bgMusicLandingOnly
                      ? `${theme.accents.goldenGlow}20`
                      : theme.surfaces.elevated2,
                    color: bgMusicLandingOnly
                      ? theme.accents.goldenGlow
                      : theme.text.tertiary,
                  }}
                >
                  <span
                    className="inline-block h-4 w-4 rounded-sm border"
                    style={{
                      borderColor: bgMusicLandingOnly
                        ? theme.accents.goldenGlow
                        : theme.text.tertiary,
                      backgroundColor: bgMusicLandingOnly
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
                  value={minPlayers}
                  onChange={(e) => setMinPlayers(e.target.valueAsNumber || 0)}
                  onBlur={(e) => { if (!e.target.value || minPlayers < 1) setMinPlayers(1); }}
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
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(e.target.valueAsNumber || 0)}
                  onBlur={(e) => { if (!e.target.value || maxPlayers < 2) setMaxPlayers(2); }}
                  className="w-24 rounded-lg border px-3 py-2 text-sm"
                  style={{
                    backgroundColor: theme.surfaces.elevated1,
                    borderColor: theme.surfaces.elevated2,
                    color: theme.text.primary,
                  }}
                />
              </div>
            </div>

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
                    onClick={() => setRetentionDays(days)}
                    className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                    style={{
                      backgroundColor:
                        retentionDays === days
                          ? `${theme.accents.goldenGlow}20`
                          : theme.surfaces.elevated2,
                      color:
                        retentionDays === days
                          ? theme.accents.goldenGlow
                          : theme.text.tertiary,
                    }}
                  >
                    {days === 1 ? "Daily" : "Monthly"}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs" style={{ color: theme.text.tertiary }}>
                Sessions and sketches older than {retentionDays === 1 ? "24 hours" : "30 days"} are cleaned up automatically.
              </p>
            </div>

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
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end border-t px-6 py-4"
          style={{ borderColor: "rgba(255, 255, 255, 0.15)" }}
        >
          <button
            onClick={handleCreate}
            disabled={!canCreate || isCreating}
            className="flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-medium transition-all hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
            style={{
              backgroundColor: theme.accents.goldenGlow,
              color: theme.surfaces.base,
            }}
          >
            {isCreating ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Check size={16} />
                Create Game
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
