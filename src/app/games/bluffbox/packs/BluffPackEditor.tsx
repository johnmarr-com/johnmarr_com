"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Loader2, RefreshCw, ImagePlus, Trash2, Upload } from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import {
  createPack,
  updatePack,
  removeCardFromPack,
  type BluffBoxPack,
} from "@/lib/bluffbox-packs";
import {
  uploadBluffImage,
  fetchImageAsBlob,
  validateBluffImageFile,
  BLUFF_IMAGE_ACCEPT,
} from "@/lib/bluffbox-storage";
import { JMCard } from "@/JMKit";
import { buildBluffPackCoverPrompt } from "./contentPrompts";
import { postGenerateBluffImage } from "./postGenerateBluffImage";
import { BluffAiImageSettingsModal } from "./BluffAiImageSettingsModal";
import { BluffAiSettingsButton } from "./BluffAiSettingsButton";
import BluffCardCreator from "./BluffCardCreator";
import BluffBulkCardCreator from "./BluffBulkCardCreator";

interface BluffPackEditorProps {
  existingPack?: BluffBoxPack | undefined;
  onSaved: (pack: BluffBoxPack) => void;
}

/** Append a cache-busting query so the browser reloads after overwriting the same Storage path. */
function withImageCacheBust(url: string, bust: number): string {
  if (!url || bust <= 0) return url;
  return `${url}${url.includes("?") ? "&" : "?"}_dv=${bust}`;
}

export default function BluffPackEditor({ existingPack, onSaved }: BluffPackEditorProps) {
  const { user, gamertag, isAdmin, aiImageGenSettings } = useAuth();

  const [name, setName] = useState(existingPack?.name ?? "");
  const [subtitle, setSubtitle] = useState(existingPack?.subtitle ?? "");
  const [description, setDescription] = useState(existingPack?.description ?? "");
  const [coverPrompt, setCoverPrompt] = useState("");
  const [coverAiSettingsOpen, setCoverAiSettingsOpen] = useState(false);
  const [coverURL, setCoverURL] = useState(existingPack?.coverImageURL ?? "");
  /** Increment after each new cover bytes (upload / apply) so preview reloads when Storage URL string is unchanged. */
  const [coverPreviewBust, setCoverPreviewBust] = useState(0);
  const [coverTempURL, setCoverTempURL] = useState<string | null>(null);
  const [generatingCover, setGeneratingCover] = useState(false);
  const [isOfficial, setIsOfficial] = useState(existingPack?.visibility === "official");
  const [isShared, setIsShared] = useState(
    existingPack?.visibility === "shared" || existingPack?.visibility === "official",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCardCreator, setShowCardCreator] = useState<"single" | "bulk" | null>(null);
  const [cards, setCards] = useState<string[]>(existingPack?.cards ?? []);
  const [deletingCardUrl, setDeletingCardUrl] = useState<string | null>(null);
  /** Card image tapped: show delete control; auto-hide after timeout. */
  const [deleteOverlayUrl, setDeleteOverlayUrl] = useState<string | null>(null);
  const [deleteOverlayFading, setDeleteOverlayFading] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverFileInputRef = useRef<HTMLInputElement>(null);
  const coverUploadPackIdRef = useRef<string | null>(existingPack?.id ?? null);

  const handleGenerateCover = useCallback(async () => {
    if (!coverPrompt.trim()) return;
    setGeneratingCover(true);
    setError(null);
    try {
      const wrappedPrompt = buildBluffPackCoverPrompt(
        coverPrompt,
        aiImageGenSettings.addedFormatPrompt,
      );
      const url = await postGenerateBluffImage(wrappedPrompt, aiImageGenSettings.ideogram);
      if (url) {
        setCoverTempURL(url);
      } else {
        setError("Cover generation failed. Try again.");
      }
    } catch {
      setError("Cover generation failed. Try again.");
    } finally {
      setGeneratingCover(false);
    }
  }, [coverPrompt, aiImageGenSettings]);

  const handleUseCover = useCallback(() => {
    if (coverTempURL) {
      setCoverURL(coverTempURL);
      setCoverTempURL(null);
      setCoverPreviewBust((n) => n + 1);
    }
  }, [coverTempURL]);

  const coverUploadPackId = useCallback(() => {
    if (existingPack?.id) return existingPack.id;
    if (!coverUploadPackIdRef.current) {
      coverUploadPackIdRef.current = `temp-${Date.now()}`;
    }
    return coverUploadPackIdRef.current;
  }, [existingPack?.id]);

  const handleCoverFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      const invalid = validateBluffImageFile(file);
      if (invalid) {
        setError(invalid);
        return;
      }
      setUploadingCover(true);
      setError(null);
      try {
        const url = await uploadBluffImage(coverUploadPackId(), "cover", file);
        setCoverURL(url);
        setCoverTempURL(null);
        setCoverPreviewBust((n) => n + 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Cover upload failed.");
      } finally {
        setUploadingCover(false);
      }
    },
    [coverUploadPackId],
  );

  const handleSave = useCallback(async () => {
    if (!user || !gamertag) return;
    if (!name.trim()) { setError("Pack name is required."); return; }
    if (!coverURL) { setError("A cover image is required."); return; }

    setSaving(true);
    setError(null);

    try {
      const visibility = isAdmin && isOfficial ? "official" : isShared ? "shared" : "private";

      let finalCoverURL = coverURL;

      // Upload cover to permanent storage if it's a temporary remote URL
      const remoteTemp =
        coverURL.includes("replicate.delivery") ||
        coverURL.includes("pbxt.replicate") ||
        coverURL.includes("ideogram.ai");
      if (remoteTemp) {
        const blob = await fetchImageAsBlob(coverURL);
        const packId = existingPack?.id ?? coverUploadPackId();
        finalCoverURL = await uploadBluffImage(packId, "cover", blob);
      }

      if (existingPack) {
        await updatePack(existingPack.id, {
          name: name.trim(),
          coverImageURL: finalCoverURL,
          visibility,
          ...(subtitle.trim() ? { subtitle: subtitle.trim() } : {}),
          ...(description.trim() ? { description: description.trim() } : {}),
        });
        onSaved({
          ...existingPack,
          name: name.trim(),
          coverImageURL: finalCoverURL,
          visibility,
          cards,
        });
      } else {
        const pack = await createPack(
          {
            name: name.trim(),
            coverImageURL: finalCoverURL,
            visibility,
            ...(subtitle.trim() ? { subtitle: subtitle.trim() } : {}),
            ...(description.trim() ? { description: description.trim() } : {}),
          },
          user.uid,
          gamertag,
        );

        // Re-upload cover with real pack ID if we used a temp ID
        if (finalCoverURL.includes("temp-")) {
          const blob = await fetchImageAsBlob(finalCoverURL);
          const permanentURL = await uploadBluffImage(pack.id, "cover", blob);
          await updatePack(pack.id, { coverImageURL: permanentURL });
          pack.coverImageURL = permanentURL;
        }

        onSaved(pack);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save pack.");
    } finally {
      setSaving(false);
    }
  }, [
    user,
    gamertag,
    name,
    subtitle,
    description,
    coverURL,
    isOfficial,
    isShared,
    isAdmin,
    existingPack,
    onSaved,
    cards,
    coverUploadPackId,
  ]);

  const handleCardCreated = useCallback((imageURL: string) => {
    setCards((prev) => (prev.includes(imageURL) ? prev : [...prev, imageURL]));
    setShowCardCreator(null);
  }, []);

  const handleBulkSaved = useCallback((imageURLs: string[]) => {
    setCards((prev) => {
      const next = [...prev];
      for (const url of imageURLs) {
        if (!next.includes(url)) next.push(url);
      }
      return next;
    });
    setShowCardCreator(null);
  }, []);

  const handleDeleteCard = useCallback(
    async (imageURL: string) => {
      if (!existingPack) return;
      setDeleteOverlayUrl(null);
      setDeleteOverlayFading(false);
      setDeletingCardUrl(imageURL);
      setError(null);
      try {
        await removeCardFromPack(existingPack.id, imageURL);
        setCards((prev) => prev.filter((u) => u !== imageURL));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to remove card.");
      } finally {
        setDeletingCardUrl(null);
      }
    },
    [existingPack],
  );

  useEffect(() => {
    if (!deleteOverlayUrl || deleteOverlayFading) return;
    const t = window.setTimeout(() => setDeleteOverlayFading(true), 2000);
    return () => window.clearTimeout(t);
  }, [deleteOverlayUrl, deleteOverlayFading]);

  useEffect(() => {
    if (!deleteOverlayFading) return;
    const t = window.setTimeout(() => {
      setDeleteOverlayUrl(null);
      setDeleteOverlayFading(false);
    }, 300);
    return () => window.clearTimeout(t);
  }, [deleteOverlayFading]);

  const handleCardTileActivate = useCallback(
    (url: string) => {
      if (deleteOverlayUrl === url && !deleteOverlayFading) {
        setDeleteOverlayUrl(null);
        return;
      }
      setDeleteOverlayFading(false);
      setDeleteOverlayUrl(url);
    },
    [deleteOverlayUrl, deleteOverlayFading],
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Pack Name */}
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Pack name..."
        className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-lg font-bold text-white placeholder-white/30 outline-none focus:border-amber-400/50"
      />

      {/* Cover generation */}
      <div className="space-y-3">
        <label className="text-xs font-bold uppercase tracking-wider text-white/40">Cover Image</label>
        <div className="flex flex-wrap items-stretch gap-2">
          <input
            type="text"
            value={coverPrompt}
            onChange={(e) => setCoverPrompt(e.target.value)}
            placeholder="Describe your pack cover..."
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-amber-400/40"
          />
          <button
            type="button"
            onClick={handleGenerateCover}
            disabled={generatingCover || uploadingCover || !coverPrompt.trim()}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-bold text-black transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
          >
            {generatingCover ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            Generate
          </button>
          <BluffAiSettingsButton onClick={() => setCoverAiSettingsOpen(true)} disabled={generatingCover} />
          <input
            ref={coverFileInputRef}
            type="file"
            accept={BLUFF_IMAGE_ACCEPT}
            className="sr-only"
            onChange={handleCoverFileChange}
          />
          <button
            type="button"
            onClick={() => coverFileInputRef.current?.click()}
            disabled={generatingCover || uploadingCover}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/20 px-4 py-2.5 text-sm font-bold text-white/70 transition-colors hover:bg-white/10 disabled:opacity-50"
          >
            {uploadingCover ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Upload
          </button>
        </div>

        {/* Cover preview */}
        <div className="flex flex-col items-center gap-3">
          {coverTempURL ? (
            <>
              {/* Plain <img> for temp Replicate URL (not on next/image allowlist) */}
              <JMCard className="h-[330px] w-[330px] bg-neutral-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={coverTempURL} alt="" className="h-full w-full object-cover" />
              </JMCard>
              <div className="flex gap-2">
                <button
                  onClick={handleUseCover}
                  className="rounded-lg bg-green-500 px-5 py-2 text-sm font-bold text-black transition-all hover:scale-[1.02] active:scale-95"
                >
                  Use This
                </button>
                <button
                  onClick={handleGenerateCover}
                  disabled={generatingCover}
                  className="flex items-center gap-1.5 rounded-lg border border-white/20 px-4 py-2 text-sm text-white/60 transition-colors hover:bg-white/10"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Regenerate
                </button>
                <BluffAiSettingsButton onClick={() => setCoverAiSettingsOpen(true)} disabled={generatingCover} />
              </div>
            </>
          ) : coverURL ? (
              <JMCard className="h-[330px] w-[330px] bg-neutral-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={withImageCacheBust(coverURL, coverPreviewBust)}
                alt=""
                className="h-full w-full object-cover"
              />
            </JMCard>
          ) : (
            <JMCard className="flex h-[330px] w-[330px] items-center justify-center border-2 border-dashed border-white/10 text-sm text-white/20">
              No cover yet
            </JMCard>
          )}
        </div>
      </div>

      {/* Subtitle & Description */}
      <input
        type="text"
        value={subtitle}
        onChange={(e) => setSubtitle(e.target.value)}
        placeholder="Subtitle (optional)"
        className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/70 placeholder-white/20 outline-none focus:border-white/30"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        rows={2}
        className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/70 placeholder-white/20 outline-none focus:border-white/30"
      />

      {/* Cards grid */}
      {existingPack && (
        <div className="space-y-3 border-t border-white/10 pt-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-white/40">
              Cards ({cards.length})
            </label>
          </div>
          {cards.length === 0 ? (
            <div className="rounded-lg border border-dashed border-amber-400/20 bg-amber-400/5 px-4 py-6 text-center text-sm text-amber-300/60">
              No cards yet. Create some cards for this pack!
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
              {cards.map((url, cardIdx) => {
                const overlayOpen = deleteOverlayUrl === url;
                return (
                  <JMCard
                    key={`${cardIdx}-${url}`}
                    className="aspect-square bg-neutral-800"
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      className="relative size-full cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
                      onClick={() => handleCardTileActivate(url)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleCardTileActivate(url);
                        }
                      }}
                      aria-label={overlayOpen ? "Tap to dismiss delete, or use the delete button" : "Tap to delete card"}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt=""
                        className={`h-full w-full object-cover transition-opacity duration-200 ${
                          overlayOpen ? "opacity-50" : "opacity-100"
                        }`}
                      />
                      {overlayOpen && (
                        <div
                          className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
                            deleteOverlayFading ? "opacity-0" : "opacity-100"
                          }`}
                        >
                          <button
                            type="button"
                            aria-label="Remove card from pack"
                            disabled={deletingCardUrl === url}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              void handleDeleteCard(url);
                            }}
                            className="pointer-events-auto flex h-[min(5rem,42%)] w-[min(5rem,42%)] min-h-13 min-w-13 shrink-0 items-center justify-center rounded-full bg-red-600 text-white shadow-lg shadow-black/40 transition-transform active:scale-95 disabled:opacity-60"
                          >
                            {deletingCardUrl === url ? (
                              <Loader2 className="h-8 w-8 animate-spin" />
                            ) : (
                              <Trash2 className="h-8 w-8 stroke-[2.5]" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </JMCard>
                );
              })}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => setShowCardCreator("single")}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 py-3 text-sm font-bold text-amber-300 transition-colors hover:bg-amber-400/20"
            >
              <ImagePlus className="h-4 w-4" />
              + Card
            </button>
            <button
              onClick={() => setShowCardCreator("bulk")}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-purple-400/30 bg-purple-400/10 py-3 text-sm font-bold text-purple-300 transition-colors hover:bg-purple-400/20"
            >
              <ImagePlus className="h-4 w-4" />
              + Bulk
            </button>
          </div>
        </div>
      )}

      {/* Visibility toggles */}
      <div className="space-y-2 border-t border-white/10 pt-4">
        {isAdmin && (
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={isOfficial}
              onChange={(e) => setIsOfficial(e.target.checked)}
              className="h-4 w-4 rounded border-white/30 bg-white/5 accent-amber-400"
            />
            <span className="text-sm text-white/60">
              Make this an <span className="font-bold text-amber-400">Official Pack</span>
            </span>
          </label>
        )}
        {!isOfficial && (
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={isShared}
              onChange={(e) => setIsShared(e.target.checked)}
              className="h-4 w-4 rounded border-white/30 bg-white/5 accent-blue-400"
            />
            <span className="text-sm text-white/60">
              Share this pack with everyone
            </span>
          </label>
        )}
      </div>

      {error && <p className="text-center text-sm text-red-400">{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-xl bg-amber-500 py-4 text-lg font-bold uppercase tracking-wider text-black shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
      >
        {saving ? (
          <Loader2 className="mx-auto h-6 w-6 animate-spin" />
        ) : existingPack ? (
          "Save Changes"
        ) : (
          "Create Pack"
        )}
      </button>

      {/* Card creator modals */}
      {showCardCreator === "single" && existingPack && (
        <BluffCardCreator
          packId={existingPack.id}
          cardIndex={cards.length}
          onSaved={handleCardCreated}
          onCancel={() => setShowCardCreator(null)}
        />
      )}
      {showCardCreator === "bulk" && existingPack && (
        <BluffBulkCardCreator
          packId={existingPack.id}
          onSaved={handleBulkSaved}
          onCancel={() => setShowCardCreator(null)}
        />
      )}

      <BluffAiImageSettingsModal
        open={coverAiSettingsOpen}
        onClose={() => setCoverAiSettingsOpen(false)}
        context="cover"
      />
    </div>
  );
}
