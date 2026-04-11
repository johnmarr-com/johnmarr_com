"use client";

import { useState, useCallback, useMemo } from "react";
import { Loader2, ImageIcon, RefreshCw, Check } from "lucide-react";

export interface GeneratedImage {
  tempUrl: string;
  approved: boolean;
}

export interface JMAIBulkImageGenProps {
  subjects: string[];
  onImagesReady?: (images: GeneratedImage[]) => void;
  apiEndpoint?: string;
}

/**
 * Reusable AI bulk image generation component.
 * Given a list of text subjects, generates sketch-style images via the AI API,
 * shows a preview grid, and lets users approve/regenerate individual images.
 *
 * Designed for seeding card games, image games, or any content that needs
 * AI-generated illustrations from text prompts.
 */
export function JMAIBulkImageGen({
  subjects,
  onImagesReady,
  apiEndpoint = "/api/games/ai",
}: JMAIBulkImageGenProps) {
  const [previews, setPreviews] = useState<(GeneratedImage | null)[]>(
    () => subjects.map(() => null),
  );
  const [generating, setGenerating] = useState(false);
  const [regeneratingIdx, setRegeneratingIdx] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allTextsPresent = useMemo(
    () => subjects.every((s) => s.trim()),
    [subjects],
  );

  const allApproved = useMemo(
    () =>
      subjects.length > 0 &&
      previews.length === subjects.length &&
      previews.every((p) => p?.approved),
    [previews, subjects.length],
  );

  const generateImageForSubject = useCallback(
    async (subject: string): Promise<string | null> => {
      try {
        const res = await fetch(apiEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "sketch", subject }),
        });
        const data = await res.json();
        return typeof data.imageUrl === "string" && data.imageUrl ? data.imageUrl : null;
      } catch {
        return null;
      }
    },
    [apiEndpoint],
  );

  const handleGenerateAll = useCallback(async () => {
    if (!allTextsPresent) return;
    setGenerating(true);
    setError(null);

    const results = await Promise.all(
      subjects.map((s) => generateImageForSubject(s)),
    );

    const newPreviews = results.map((url) =>
      url ? { tempUrl: url, approved: false } : null,
    );
    setPreviews(newPreviews);

    const failures = results.filter((r) => !r).length;
    if (failures > 0) {
      setError(`${failures} image(s) failed to generate. You can retry individually.`);
    }
    setGenerating(false);
  }, [allTextsPresent, subjects, generateImageForSubject]);

  const handleRegenerateOne = useCallback(
    async (index: number) => {
      setRegeneratingIdx(index);
      const url = await generateImageForSubject(subjects[index]!);
      setPreviews((prev) => {
        const next = [...prev];
        next[index] = url ? { tempUrl: url, approved: false } : null;
        return next;
      });
      setRegeneratingIdx(null);
    },
    [subjects, generateImageForSubject],
  );

  const handleApproveAll = useCallback(() => {
    const updated = previews.map((p) => (p ? { ...p, approved: true } : null));
    setPreviews(updated);
    const ready = updated.filter((p): p is GeneratedImage => p?.approved === true);
    if (ready.length === subjects.length) {
      onImagesReady?.(ready);
    }
  }, [previews, subjects.length, onImagesReady]);

  const anyPreview = previews.some((p) => p != null);
  const unapprovedCount = previews.filter((p) => p && !p.approved).length;

  // Notify parent when all individually approved
  const notifyIfReady = useCallback(
    (updated: (GeneratedImage | null)[]) => {
      if (updated.every((p) => p?.approved)) {
        onImagesReady?.(updated.filter((p): p is GeneratedImage => !!p));
      }
    },
    [onImagesReady],
  );

  const approveOne = useCallback(
    (index: number) => {
      setPreviews((prev) => {
        const next = [...prev];
        if (next[index]) next[index] = { ...next[index]!, approved: true };
        notifyIfReady(next);
        return next;
      });
    },
    [notifyIfReady],
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Generate button */}
      <button
        onClick={handleGenerateAll}
        disabled={!allTextsPresent || generating}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-purple-400/30 bg-purple-400/10 py-3 text-sm font-bold uppercase tracking-wider text-purple-300 transition-all hover:bg-purple-400/20 disabled:opacity-40 disabled:hover:bg-purple-400/10"
      >
        {generating ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <ImageIcon className="h-5 w-5" />
        )}
        {generating
          ? "Generating..."
          : anyPreview
            ? "Regenerate All Images"
            : "Generate Images"}
      </button>

      {error && (
        <p className="text-center text-xs text-red-400">{error}</p>
      )}

      {/* Preview Grid */}
      {anyPreview && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-white/40">
              Preview ({previews.filter((p) => p?.approved).length}/{subjects.length} approved)
            </p>
            {unapprovedCount > 0 && (
              <button
                onClick={handleApproveAll}
                className="text-xs font-bold text-green-400 transition-colors hover:text-green-300"
              >
                Approve All
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {subjects.map((subject, i) => {
              const preview = previews[i];
              const isRegen = regeneratingIdx === i;
              return (
                <div key={i} className="flex flex-col gap-1.5">
                  <div className="relative aspect-square overflow-hidden rounded-lg border border-white/10 bg-white/5">
                    {isRegen ? (
                      <div className="flex h-full items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-white/30" />
                      </div>
                    ) : preview ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={preview.tempUrl}
                          alt={subject}
                          className="h-full w-full object-contain"
                        />
                        {preview.approved && (
                          <div className="absolute right-1 top-1 rounded-full bg-green-500 p-0.5">
                            <Check className="h-3 w-3 text-black" />
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <span className="text-xs text-white/20">No image</span>
                      </div>
                    )}
                  </div>
                  <p className="truncate text-xs font-bold text-green-300">
                    {subject || "—"}
                  </p>
                  <div className="flex gap-1">
                    {preview && !preview.approved && (
                      <button
                        onClick={() => approveOne(i)}
                        className="flex-1 rounded-md bg-green-500/20 py-1 text-[10px] font-bold text-green-400 transition-colors hover:bg-green-500/30"
                      >
                        Approve
                      </button>
                    )}
                    <button
                      onClick={() => handleRegenerateOne(i)}
                      disabled={isRegen || generating}
                      className="flex flex-1 items-center justify-center gap-1 rounded-md bg-white/5 py-1 text-[10px] font-bold text-white/50 transition-colors hover:bg-white/10 disabled:opacity-40"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Redo
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {allApproved && (
        <p className="text-center text-xs font-bold text-green-400">
          All images approved!
        </p>
      )}
    </div>
  );
}
