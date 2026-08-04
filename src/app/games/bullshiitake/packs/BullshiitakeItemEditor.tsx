"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Loader2, RefreshCw, X, Upload, Plus, Trash2, ImagePlus } from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import {
  createBullshiitakeItem,
  updateBullshiitakeItem,
  BS_TYPE_LABELS,
  type BullshiitakeItem,
  type BullshiitakeItemFields,
  type BSType,
} from "@/lib/bullshiitake-packs";
import {
  uploadBullshiitakeItemImage,
  validateBullshiitakeImageFile,
  BS_IMAGE_ACCEPT,
} from "@/lib/bullshiitake-storage";
import { BluffAiImageSettingsModal } from "@/app/games/bluffbox/packs/BluffAiImageSettingsModal";
import { BluffAiSettingsButton } from "@/app/games/bluffbox/packs/BluffAiSettingsButton";
import {
  postGenerateBullshiitakeImage,
  persistBullshiitakeBanner,
  generateBannerPromptFromStory,
} from "./postGenerateBullshiitakeImage";

interface BullshiitakeItemEditorProps {
  /** Set automatically from the open pack. */
  packId: string;
  existingItem?: BullshiitakeItem | undefined;
  onSaved: (item: BullshiitakeItem) => void;
  onCancel: () => void;
}

const BS_TYPES: BSType[] = ["true", "partlytrue", "bullshiitake"];

const SHORT_TEXT_MAX_WORDS = 75;
const STORY_TEXT_MAX_WORDS = 150;

const countWords = (t: string): number =>
  t.trim() ? t.trim().split(/\s+/).length : 0;

/** Remaining-words badge (top-right of a field label). Never blocks input —
 * just goes red when the budget is overspent. */
function WordsRemaining({ text, max }: { text: string; max: number }) {
  const left = max - countWords(text);
  return (
    <span
      className={`font-mono text-[10px] ${left < 0 ? "font-bold text-red-400" : "text-white/30"}`}
      title={`${max} word max`}
    >
      {left} words
    </span>
  );
}

/** Banner prompt = house-style lead-in + subject + the user's saved format
 * prompt. Bull Shiitake banners are isometric cartoon (matches the backfill
 * script's style — photo-realism read wrong for the game). */
function buildBannerPrompt(subject: string, addedFormatPrompt: string): string {
  const s = subject.trim();
  const ins = addedFormatPrompt.trim();
  const head =
    `Isometric cartoon illustration, wide 2:1 banner: ${s}. ` +
    "Playful flat-shaded cartoon style, isometric perspective, clean bold " +
    "outlines, vibrant colors, minimal background, no text or lettering.";
  if (!ins) return head;
  return `${head} ${ins}`;
}

/**
 * Create / edit one Bull Shiitake story. Canonical popup anatomy (JMModal):
 * portaled to <body>, blurred backdrop, panel capped at max-h with an inner
 * scroll body. Stacks above the pack detail view (z-60 > z-50).
 */
export default function BullshiitakeItemEditor({
  packId,
  existingItem,
  onSaved,
  onCancel,
}: BullshiitakeItemEditorProps) {
  const { user, aiImageGenSettings } = useAuth();

  const [title, setTitle] = useState(existingItem?.title ?? "");
  const [bsType, setBsType] = useState<BSType>(existingItem?.bsType ?? "true");
  const [shortText, setShortText] = useState(existingItem?.shortText ?? "");
  const [storyText, setStoryText] = useState(existingItem?.storyText ?? "");
  const [citations, setCitations] = useState<string[]>(existingItem?.citations ?? []);
  const [citationInput, setCitationInput] = useState("");
  const [correction, setCorrection] = useState(existingItem?.correction ?? "");
  const [videoURL, setVideoURL] = useState(existingItem?.videoURL ?? "");

  // Image state — mirrors BluffCardCreator: a permanent URL, plus an optional
  // pending replacement (local file blob or ephemeral AI URL) resolved on Save.
  const imageURL = existingItem?.imageURL ?? "";
  const [tempURL, setTempURL] = useState<string | null>(null);
  const localFileBlobRef = useRef<Blob | null>(null);
  const [imagePrompt, setImagePrompt] = useState(existingItem?.imagePrompt ?? "");
  const [generating, setGenerating] = useState(false);
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const imageFileInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  /** Non-null while Save is auto-generating the banner ("no image" path). */
  const [savingStage, setSavingStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Doc id fixed up-front so the banner can land at `bullshiitake/items/{itemId}/…`. */
  const itemIdRef = useRef(
    existingItem?.id ??
      (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`),
  );

  useEffect(() => {
    return () => {
      if (tempURL?.startsWith("blob:")) URL.revokeObjectURL(tempURL);
    };
  }, [tempURL]);

  const handleGenerate = useCallback(async () => {
    if (!imagePrompt.trim()) return;
    setGenerating(true);
    setError(null);
    localFileBlobRef.current = null;
    setTempURL((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
    try {
      const fullPrompt = buildBannerPrompt(imagePrompt, aiImageGenSettings.addedFormatPrompt);
      const url = await postGenerateBullshiitakeImage(fullPrompt, aiImageGenSettings.ideogram);
      if (url) {
        setTempURL(url);
      } else {
        setError("Image generation failed. Try again.");
      }
    } catch {
      setError("Image generation failed. Try again.");
    } finally {
      setGenerating(false);
    }
  }, [imagePrompt, aiImageGenSettings]);

  const handleImageFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      const invalid = validateBullshiitakeImageFile(file);
      if (invalid) {
        setError(invalid);
        return;
      }
      setError(null);
      setTempURL((prev) => {
        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });
      localFileBlobRef.current = file;
    },
    [],
  );

  const handleAddCitation = useCallback(() => {
    const url = citationInput.trim();
    if (!url) return;
    setCitations((prev) => (prev.includes(url) ? prev : [...prev, url]));
    setCitationInput("");
  }, [citationInput]);

  const handleSave = useCallback(async () => {
    if (!user) return;
    if (!title.trim()) { setError("A title is required."); return; }
    if (!storyText.trim()) { setError("Story text is required."); return; }

    setSaving(true);
    setError(null);

    try {
      const itemId = itemIdRef.current;

      // Resolve the banner: local file → client upload; ephemeral AI URL →
      // server-side persist-image; otherwise keep the existing permanent URL.
      let finalImageURL = imageURL;
      if (localFileBlobRef.current) {
        finalImageURL = await uploadBullshiitakeItemImage(itemId, localFileBlobRef.current);
      } else if (tempURL && !tempURL.startsWith("blob:")) {
        const persisted = await persistBullshiitakeBanner(tempURL, itemId);
        if (!persisted) throw new Error("Failed to save the generated image.");
        finalImageURL = persisted;
      }

      // No image at all → auto-generate one: author's prompt if present,
      // otherwise derive a prompt from the story first. Failures don't block
      // the save — the story just lands without a banner.
      let effectivePrompt = imagePrompt.trim();
      if (!finalImageURL) {
        if (!effectivePrompt) {
          setSavingStage("Writing image prompt…");
          effectivePrompt =
            (await generateBannerPromptFromStory(title.trim(), storyText)) ?? "";
          if (effectivePrompt) setImagePrompt(effectivePrompt);
        }
        if (effectivePrompt) {
          setSavingStage("Generating banner…");
          const fullPrompt = buildBannerPrompt(
            effectivePrompt,
            aiImageGenSettings.addedFormatPrompt,
          );
          const ephemeral = await postGenerateBullshiitakeImage(
            fullPrompt,
            aiImageGenSettings.ideogram,
          );
          if (ephemeral) {
            const persisted = await persistBullshiitakeBanner(ephemeral, itemId);
            if (persisted) finalImageURL = persisted;
          }
        }
        setSavingStage(null);
      }

      const fields: BullshiitakeItemFields = {
        title: title.trim(),
        bsType,
        storyText: storyText, // preserve line-break paragraphs verbatim
        ...(shortText.trim() ? { shortText } : {}),
        ...(citations.length ? { citations } : {}),
        ...(correction.trim() ? { correction: correction.trim() } : {}),
        ...(finalImageURL ? { imageURL: finalImageURL } : {}),
        ...(effectivePrompt ? { imagePrompt: effectivePrompt } : {}),
        ...(videoURL.trim() ? { videoURL: videoURL.trim() } : {}),
      };

      if (existingItem) {
        await updateBullshiitakeItem(existingItem.id, fields);
        onSaved({
          id: existingItem.id,
          packId: existingItem.packId,
          creatorId: existingItem.creatorId,
          createdAt: existingItem.createdAt,
          updatedAt: existingItem.updatedAt,
          ...fields,
        });
      } else {
        const item = await createBullshiitakeItem({ ...fields, packId, id: itemId }, user.uid);
        onSaved(item);
      }
      if (tempURL?.startsWith("blob:")) URL.revokeObjectURL(tempURL);
      localFileBlobRef.current = null;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save story.");
      setSaving(false);
    }
  }, [
    user,
    title,
    bsType,
    storyText,
    shortText,
    citations,
    correction,
    videoURL,
    imageURL,
    imagePrompt,
    aiImageGenSettings,
    tempURL,
    existingItem,
    packId,
    onSaved,
  ]);

  if (typeof document === "undefined") return null;

  const previewURL = tempURL ?? imageURL;
  const labelClass = "text-xs font-bold uppercase tracking-wider text-white/40";

  return createPortal(
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={existingItem ? "Edit Story" : "Add Story"}
        className="relative z-10 flex max-h-[min(92vh,900px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/20 bg-neutral-900"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-white">
              {existingItem ? "Edit Story" : "Add Story"}
            </h3>
            {existingItem?.searchID != null && (
              <span
                className="rounded-full border border-white/15 px-2 py-0.5 font-mono text-xs text-white/50"
                title="Search ID — auto-assigned, not editable"
              >
                #{existingItem.searchID}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-1.5 text-white/40 hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div
          className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain p-5"
          style={{ WebkitOverflowScrolling: "touch" }}
          onWheel={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col gap-4">
            {/* Title */}
            <div className="space-y-1.5">
              <label className={labelClass}>Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Story title..."
                className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-base font-bold text-white placeholder-white/30 outline-none focus:border-lime-400/50"
              />
            </div>

            {/* BS-Type */}
            <div className="space-y-1.5">
              <label className={labelClass}>BS-Type</label>
              <select
                value={bsType}
                onChange={(e) => setBsType(e.target.value as BSType)}
                className="w-full rounded-lg border border-white/20 bg-neutral-800 px-4 py-2.5 text-sm text-white outline-none focus:border-lime-400/50"
              >
                {BS_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {BS_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>

            {/* Short Text — preferred in game when set */}
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <label className={labelClass}>
                  Short Text <span className="font-normal normal-case text-white/25">(optional)</span>
                </label>
                <WordsRemaining text={shortText} max={SHORT_TEXT_MAX_WORDS} />
              </div>
              <textarea
                value={shortText}
                onChange={(e) => setShortText(e.target.value)}
                placeholder="Shortened version of the story…"
                rows={4}
                spellCheck
                className="w-full resize-y whitespace-pre-wrap rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm leading-relaxed text-white placeholder-white/25 outline-none focus:border-lime-400/40"
              />
              <p className="text-[10px] text-white/30">
                When set, the game shows this instead of the full story below —
                the long version is kept either way.
              </p>
            </div>

            {/* Story Text */}
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <label className={labelClass}>Story Text</label>
                <WordsRemaining text={storyText} max={STORY_TEXT_MAX_WORDS} />
              </div>
              <textarea
                value={storyText}
                onChange={(e) => setStoryText(e.target.value)}
                placeholder="The story, as read to the group…"
                rows={8}
                spellCheck
                className="w-full resize-y whitespace-pre-wrap rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm leading-relaxed text-white placeholder-white/25 outline-none focus:border-lime-400/40"
              />
              <p className="text-[10px] text-white/30">
                Line breaks are preserved — blank lines separate paragraphs.
              </p>
            </div>

            {/* Citations */}
            <div className="space-y-1.5">
              <label className={labelClass}>
                Citations <span className="font-normal normal-case text-white/25">(optional)</span>
              </label>
              {citations.length > 0 && (
                <div className="flex flex-col gap-1">
                  {citations.map((url) => (
                    <div
                      key={url}
                      className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5"
                    >
                      <span className="min-w-0 flex-1 truncate text-xs text-white/60">{url}</span>
                      <button
                        type="button"
                        onClick={() => setCitations((prev) => prev.filter((c) => c !== url))}
                        className="shrink-0 rounded p-1 text-red-400/50 transition-colors hover:text-red-400"
                        title="Remove citation"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="url"
                  value={citationInput}
                  onChange={(e) => setCitationInput(e.target.value)}
                  placeholder="https://…"
                  className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-white/25 outline-none focus:border-lime-400/40"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCitation();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddCitation}
                  disabled={!citationInput.trim()}
                  className="flex shrink-0 items-center gap-1 rounded-lg border border-white/20 px-3 py-2 text-xs font-bold text-white/70 transition-colors hover:bg-white/10 disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </button>
              </div>
            </div>

            {/* Correction */}
            <div className="space-y-1.5">
              <label className={labelClass}>Correction</label>
              <textarea
                value={correction}
                onChange={(e) => setCorrection(e.target.value)}
                placeholder="What's actually true…"
                rows={3}
                className="w-full resize-y rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm leading-relaxed text-white placeholder-white/25 outline-none focus:border-lime-400/40"
              />
              <p className="text-[10px] text-white/30">
                Clarifying text — required reading when the story is Partly True
              </p>
            </div>

            {/* Image: upload OR AI-generate, 2:1 banner */}
            <div className="space-y-2">
              <label className={labelClass}>
                Banner Image <span className="font-normal normal-case text-white/25">(2:1)</span>
              </label>
              <div className="relative aspect-2/1 w-full overflow-hidden rounded-xl border-2 border-dashed border-white/10 bg-neutral-800">
                {previewURL ? (
                  /* eslint-disable-next-line @next/next/no-img-element -- local blob / ephemeral AI / Storage URL */
                  <img src={previewURL} alt="" className="h-full w-full object-cover" />
                ) : (
                  !generating && (
                    <div className="flex h-full items-center justify-center">
                      <span className="text-sm text-white/20">Banner preview</span>
                    </div>
                  )
                )}
                {generating && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-neutral-900/85 backdrop-blur-sm">
                    <Loader2 className="h-10 w-10 animate-spin text-lime-400" />
                    <span className="text-sm font-medium text-white/50">Generating…</span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-stretch gap-2">
                <input
                  type="text"
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  placeholder="Describe the banner…"
                  className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-lime-400/40"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !generating) {
                      e.preventDefault();
                      void handleGenerate();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => void handleGenerate()}
                  disabled={generating || !imagePrompt.trim()}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg bg-lime-500 px-4 py-2.5 text-sm font-bold text-black transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                >
                  {generating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : tempURL ? (
                    <RefreshCw className="h-4 w-4" />
                  ) : (
                    <ImagePlus className="h-4 w-4" />
                  )}
                  Generate
                </button>
                <BluffAiSettingsButton
                  onClick={() => setAiSettingsOpen(true)}
                  disabled={generating}
                />
              </div>
              <input
                ref={imageFileInputRef}
                type="file"
                accept={BS_IMAGE_ACCEPT}
                className="sr-only"
                onChange={handleImageFileChange}
              />
              <button
                type="button"
                onClick={() => imageFileInputRef.current?.click()}
                disabled={generating}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 py-2.5 text-sm font-bold text-white/60 transition-colors hover:bg-white/10 disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                Upload custom image
              </button>
              <p className="text-[10px] text-white/30">
                The prompt is saved with the story. If you save without an
                image, a banner is generated automatically — from your prompt,
                or from an AI-written one when the field is empty.
              </p>
            </div>

            {/* Video URL */}
            <div className="space-y-1.5">
              <label className={labelClass}>
                Video URL <span className="font-normal normal-case text-white/25">(optional)</span>
              </label>
              <input
                type="url"
                value={videoURL}
                onChange={(e) => setVideoURL(e.target.value)}
                placeholder="https://vimeo.com/…"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-lime-400/40"
              />
              <p className="text-[10px] text-white/30">
                Vimeo link — portrait orientation.
              </p>
            </div>

            {error && <p className="text-center text-sm text-red-400">{error}</p>}
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 gap-2 border-t border-white/10 p-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-white/10 px-4 py-3 text-sm text-white/40 transition-colors hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || generating}
            className="min-w-0 flex-1 rounded-xl bg-lime-500 py-3 text-sm font-bold uppercase tracking-wider text-black transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2 normal-case tracking-normal">
                <Loader2 className="h-5 w-5 animate-spin" />
                {savingStage ?? "Saving…"}
              </span>
            ) : existingItem ? (
              "Save Changes"
            ) : (
              "Add Story"
            )}
          </button>
        </div>
      </div>

      <BluffAiImageSettingsModal
        open={aiSettingsOpen}
        onClose={() => setAiSettingsOpen(false)}
        context="card"
      />
    </div>,
    document.body,
  );
}
