"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Loader2, RefreshCw, X, Upload } from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import { addCardToPack } from "@/lib/bluffbox-packs";
import {
  uploadBluffImage,
  fetchImageAsBlob,
  validateBluffImageFile,
  BLUFF_IMAGE_ACCEPT,
} from "@/lib/bluffbox-storage";
import { JMCard } from "@/JMKit";
import { buildBluffCardImagePrompt } from "./contentPrompts";
import { postGenerateBluffImage } from "./postGenerateBluffImage";
import { BluffAiImageSettingsModal } from "./BluffAiImageSettingsModal";
import { BluffAiSettingsButton } from "./BluffAiSettingsButton";

interface BluffCardCreatorProps {
  packId: string;
  cardIndex: number;
  onSaved: (imageURL: string) => void;
  onCancel: () => void;
}

export default function BluffCardCreator({
  packId,
  cardIndex,
  onSaved,
  onCancel,
}: BluffCardCreatorProps) {
  const { aiImageGenSettings } = useAuth();
  const [cardPrompt, setCardPrompt] = useState("");
  const [tempURL, setTempURL] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const localFileBlobRef = useRef<Blob | null>(null);
  const cardFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (tempURL?.startsWith("blob:")) URL.revokeObjectURL(tempURL);
    };
  }, [tempURL]);

  const handleGenerate = useCallback(async () => {
    if (!cardPrompt.trim()) return;
    setGenerating(true);
    setError(null);
    localFileBlobRef.current = null;
    setTempURL(null);
    try {
      const fullPrompt = buildBluffCardImagePrompt(
        cardPrompt,
        aiImageGenSettings.addedFormatPrompt,
      );
      const url = await postGenerateBluffImage(fullPrompt, aiImageGenSettings.ideogram);
      if (url) {
        setTempURL(url);
      } else {
        setError("Generation failed. Try again.");
      }
    } catch {
      setError("Generation failed. Try again.");
    } finally {
      setGenerating(false);
    }
  }, [cardPrompt, aiImageGenSettings]);

  const handleCardFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      const invalid = validateBluffImageFile(file);
      if (invalid) {
        setError(invalid);
        return;
      }
      setError(null);
      if (localFileBlobRef.current && tempURL?.startsWith("blob:")) {
        URL.revokeObjectURL(tempURL);
      }
      localFileBlobRef.current = file;
      setTempURL(URL.createObjectURL(file));
    },
    [tempURL],
  );

  const handleSave = useCallback(async () => {
    if (!tempURL) return;
    setSaving(true);
    setError(null);
    try {
      const blob = localFileBlobRef.current ?? (await fetchImageAsBlob(tempURL));
      const permanentURL = await uploadBluffImage(packId, "card", blob, cardIndex);
      await addCardToPack(packId, permanentURL);
      if (tempURL.startsWith("blob:")) URL.revokeObjectURL(tempURL);
      localFileBlobRef.current = null;
      onSaved(permanentURL);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save card.");
      setSaving(false);
    }
  }, [tempURL, packId, cardIndex, onSaved]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" aria-hidden />
      <div className="relative z-10 flex max-h-[min(92vh,860px)] w-full max-w-lg flex-col overflow-y-auto rounded-2xl border border-white/20 bg-neutral-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Create Card</h3>
          <button type="button" onClick={onCancel} className="rounded-lg p-1.5 text-white/40 hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 flex justify-center">
          <JMCard className="h-[260px] w-[260px] border-2 border-dashed border-white/10 bg-neutral-800">
            {tempURL ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={tempURL} alt="" className="h-full w-full object-cover" />
              </>
            ) : (
              !generating && (
                <div className="flex h-full items-center justify-center">
                  <span className="text-sm text-white/20">Card preview</span>
                </div>
              )
            )}
            {generating && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-neutral-900/85 backdrop-blur-sm">
                <Loader2 className="h-10 w-10 animate-spin text-amber-400" />
                <span className="text-sm font-medium text-white/50">Generating…</span>
              </div>
            )}
          </JMCard>
        </div>

        {!generating && (
          <div className="mb-4 flex flex-col gap-3">
            <textarea
              value={cardPrompt}
              onChange={(e) => setCardPrompt(e.target.value)}
              placeholder="Describe a crazy object…"
              rows={5}
              spellCheck={false}
              className="min-h-30 w-full resize-y rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm leading-relaxed text-white placeholder-white/25 outline-none focus:border-amber-400/40"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !generating) {
                  e.preventDefault();
                  void handleGenerate();
                }
              }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={!cardPrompt.trim()}
                className="shrink-0 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-bold text-black transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
              >
                Generate
              </button>
              <BluffAiSettingsButton onClick={() => setAiSettingsOpen(true)} />
              <span className="text-[10px] text-white/30">⌘↵ / Ctrl+↵ to generate</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={cardFileInputRef}
                type="file"
                accept={BLUFF_IMAGE_ACCEPT}
                className="sr-only"
                onChange={handleCardFileChange}
              />
              <button
                type="button"
                onClick={() => cardFileInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 py-2.5 text-sm font-bold text-white/60 transition-colors hover:bg-white/10"
              >
                <Upload className="h-4 w-4" />
                Upload custom image
              </button>
            </div>
          </div>
        )}

        {error && <p className="mb-3 text-center text-sm text-red-400">{error}</p>}

        {tempURL && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || generating}
              className="min-w-0 flex-1 rounded-lg bg-green-500 py-3 text-sm font-bold text-black transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
            >
              {saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Save Card"}
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-1.5 rounded-lg border border-white/20 px-4 py-3 text-sm text-white/60 transition-colors hover:bg-white/10"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Recreate
            </button>
            <BluffAiSettingsButton onClick={() => setAiSettingsOpen(true)} />
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-white/10 px-4 py-3 text-sm text-white/40 transition-colors hover:bg-white/5"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <BluffAiImageSettingsModal
        open={aiSettingsOpen}
        onClose={() => setAiSettingsOpen(false)}
        context="card"
      />
    </div>
  );
}
