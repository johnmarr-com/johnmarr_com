"use client";

import { useState, useCallback, useRef } from "react";
import { Loader2, RefreshCw, Check, Save, X } from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import { addCardToPack, removeCardFromPack } from "@/lib/bluffbox-packs";
import { uploadBluffImage, fetchImageAsBlob } from "@/lib/bluffbox-storage";
import { JMCard } from "@/JMKit";
import { cn } from "@/lib";
import { buildBluffCardImagePrompt } from "./contentPrompts";
import { BluffAiImageSettingsModal } from "./BluffAiImageSettingsModal";
import { BluffAiSettingsButton } from "./BluffAiSettingsButton";
import { postGenerateBluffImage } from "./postGenerateBluffImage";

interface BulkCard {
  subject: string;
  tempUrl: string | null;
  savedUrl: string | null;
  generating: boolean;
  saving: boolean;
  error: boolean;
}

interface BluffBulkCardCreatorProps {
  packId: string;
  onSaved: (imageURLs: string[]) => void;
  onCancel: () => void;
}

export default function BluffBulkCardCreator({
  packId,
  onSaved,
  onCancel,
}: BluffBulkCardCreatorProps) {
  const { aiImageGenSettings } = useAuth();
  const [rawInput, setRawInput] = useState("");
  const [bulkAiSettingsOpen, setBulkAiSettingsOpen] = useState(false);
  const [cards, setCards] = useState<BulkCard[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const abortRef = useRef(false);
  /** Index → permanent URL for cards saved this session (replaced on re-save, removed on regen). */
  const savedByIndexRef = useRef<Map<number, string>>(new Map());
  const cardsRef = useRef(cards);
  cardsRef.current = cards;

  const parsed = rawInput
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const handleGenerate = useCallback(async () => {
    if (parsed.length === 0) return;
    abortRef.current = false;
    setIsGenerating(true);
    savedByIndexRef.current = new Map();

    const initial: BulkCard[] = parsed.map((subject) => ({
      subject,
      tempUrl: null,
      savedUrl: null,
      generating: false,
      saving: false,
      error: false,
    }));
    setCards(initial);

    for (let i = 0; i < parsed.length; i++) {
      if (abortRef.current) break;

      setCards((prev) => {
        const next = [...prev];
        next[i] = { ...next[i]!, generating: true };
        return next;
      });

      const fullPrompt = buildBluffCardImagePrompt(
        parsed[i]!,
        aiImageGenSettings.addedFormatPrompt,
      );
      const url = await postGenerateBluffImage(fullPrompt, aiImageGenSettings.ideogram);

      setCards((prev) => {
        const next = [...prev];
        next[i] = { ...next[i]!, generating: false, tempUrl: url, error: !url };
        return next;
      });
    }

    setIsGenerating(false);
  }, [parsed, aiImageGenSettings]);

  const handleRegenOne = useCallback(
    async (index: number) => {
      const snap = cardsRef.current[index];
      if (!snap) return;
      const subject = snap.subject;
      const previousSaved = snap.savedUrl;

      setCards((prev) => {
        const card = prev[index];
        if (!card) return prev;
        const next = [...prev];
        next[index] = { ...card, generating: true, error: false, savedUrl: null, tempUrl: null };
        return next;
      });
      if (!subject) return;

      if (previousSaved) {
        try {
          await removeCardFromPack(packId, previousSaved);
        } catch (e) {
          console.error("[BulkCard] removeCard on regen:", e);
        }
        savedByIndexRef.current.delete(index);
      }

      const fullPrompt = buildBluffCardImagePrompt(subject, aiImageGenSettings.addedFormatPrompt);
      const url = await postGenerateBluffImage(fullPrompt, aiImageGenSettings.ideogram);

      setCards((prev) => {
        const next = [...prev];
        next[index] = { ...next[index]!, generating: false, tempUrl: url, error: !url };
        return next;
      });
    },
    [packId, aiImageGenSettings],
  );

  const saveOneByIndex = useCallback(
    async (index: number) => {
      // Read from ref — do not read `tempUrl` from inside `setCards`; the updater may run
      // after this tick (e.g. batched / async), so a sync `let` there stays null and save skips.
      const card = cardsRef.current[index];
      if (!card?.tempUrl || card.savedUrl || card.saving) return;
      const tempUrl = card.tempUrl;

      setCards((prev) => {
        const c = prev[index];
        if (!c?.tempUrl || c.savedUrl || c.saving) return prev;
        const next = [...prev];
        next[index] = { ...c, saving: true };
        return next;
      });

      try {
        const blob = await fetchImageAsBlob(tempUrl);
        const permanentURL = await uploadBluffImage(packId, "card", blob);
        await addCardToPack(packId, permanentURL);

        savedByIndexRef.current.set(index, permanentURL);

        setCards((prev) => {
          const next = [...prev];
          next[index] = { ...next[index]!, saving: false, savedUrl: permanentURL };
          return next;
        });
      } catch (err) {
        console.error("[BulkCard] save failed:", err);
        setCards((prev) => {
          const next = [...prev];
          next[index] = { ...next[index]!, saving: false, error: true };
          return next;
        });
      }
    },
    [packId],
  );

  const handleSaveOne = saveOneByIndex;

  const saveOneByIndexRef = useRef(saveOneByIndex);
  saveOneByIndexRef.current = saveOneByIndex;

  const handleSaveAll = useCallback(async () => {
    setSavingAll(true);
    const unsavedIndices = cardsRef.current
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.tempUrl && !c.savedUrl && !c.error)
      .map(({ i }) => i);

    for (const i of unsavedIndices) {
      await saveOneByIndexRef.current(i);
    }
    setSavingAll(false);
  }, []);

  const handleClose = useCallback(() => {
    const urls = Array.from(savedByIndexRef.current.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, u]) => u);
    if (urls.length > 0) {
      onSaved(urls);
    } else {
      onCancel();
    }
  }, [onSaved, onCancel]);

  const unsavedCount = cards.filter((c) => c.tempUrl && !c.savedUrl && !c.error).length;
  const savedCount = cards.filter((c) => c.savedUrl).length;
  const anyCards = cards.length > 0;

  /** X button only — backdrop no longer closes; still confirm if there is something to lose. */
  const requestCloseFromButton = useCallback(() => {
    const hasTyped = rawInput.trim().length > 0;
    const unsaved = cards.filter((c) => c.tempUrl && !c.savedUrl && !c.error).length;
    const hasGrid = cards.length > 0;
    if (isGenerating || unsaved > 0 || hasGrid || hasTyped) {
      if (
        !window.confirm(
          "Close bulk creator? Anything not saved to the pack will be lost.",
        )
      ) {
        return;
      }
    }
    handleClose();
  }, [handleClose, isGenerating, cards, rawInput]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop is visual only — do not close on outside tap (loses bulk work). Use X or Done. */}
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" aria-hidden />
      <div
        className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-white/20 bg-neutral-900 xl:max-w-4xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-create-title"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h3 id="bulk-create-title" className="text-lg font-bold text-white">
              Bulk Create Cards
            </h3>
            {anyCards && (
              <p className="text-xs text-white/40">
                {savedCount} saved · {unsavedCount} unsaved · {cards.length} total
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={requestCloseFromButton}
            className="rounded-lg p-1.5 text-white/40 hover:bg-white/10"
            aria-label="Close bulk creator"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Input area */}
        <div className="shrink-0 space-y-3 border-b border-white/10 p-5">
          <textarea
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            placeholder="rubber duck, flaming sword, alien toaster, haunted piano, disco cactus..."
            rows={3}
            className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-amber-400/40"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleGenerate}
              disabled={parsed.length === 0 || isGenerating}
              className="flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-bold text-black transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              {isGenerating
                ? "Generating..."
                : anyCards
                  ? `Regenerate All (${parsed.length})`
                  : `Generate ${parsed.length} Card${parsed.length !== 1 ? "s" : ""}`}
            </button>
            <BluffAiSettingsButton onClick={() => setBulkAiSettingsOpen(true)} disabled={isGenerating} />
            <span className="text-xs text-white/30">
              {parsed.length} item{parsed.length !== 1 ? "s" : ""} detected
            </span>
          </div>
        </div>

        {/* Card grid */}
        {anyCards && (
          <div className="flex-1 overflow-y-auto p-4" style={{ scrollbarWidth: "none" }}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
              {cards.map((card, i) => {
                const isSaved = !!card.savedUrl;
                return (
                  <div
                    key={`${card.subject}-${i}`}
                    className="flex flex-col gap-1.5"
                  >
                    <JMCard
                      className={cn(
                        "aspect-square border border-white/10 bg-white/5",
                        isSaved && "grayscale",
                      )}
                    >
                      {card.generating ? (
                        <div className="flex h-full flex-col items-center justify-center gap-2">
                          <Loader2 className="h-5 w-5 animate-spin text-amber-400/60" />
                          <span className="text-[10px] text-white/20">Generating...</span>
                        </div>
                      ) : card.tempUrl ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={card.savedUrl ?? card.tempUrl}
                            alt={card.subject}
                            className="h-full w-full object-cover"
                          />
                          {isSaved && (
                            <div className="absolute right-1 top-1 rounded-full bg-green-500 p-0.5">
                              <Check className="h-3 w-3 text-black" />
                            </div>
                          )}
                          <span className="absolute bottom-0.5 right-1 text-[6px] font-bold text-white/20 drop-shadow">
                            BluffBox @ JohnMarr.com
                          </span>
                        </>
                      ) : card.error ? (
                        <div className="flex h-full items-center justify-center">
                          <span className="text-xs text-red-400/60">Failed</span>
                        </div>
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <span className="text-[10px] text-white/15">Pending</span>
                        </div>
                      )}
                    </JMCard>
                    <p className="truncate text-[10px] font-bold text-white/50">
                      {card.subject}
                    </p>
                    {(card.tempUrl || card.error) && (
                      <div className="flex gap-1">
                        {isSaved ? (
                          <span className="flex flex-1 items-center justify-center gap-1 rounded-md bg-white/5 py-1 text-[10px] font-bold text-white/25">
                            <Check className="h-2.5 w-2.5" />
                            Saved
                          </span>
                        ) : card.tempUrl ? (
                          <button
                            onClick={() => handleSaveOne(i)}
                            disabled={card.saving || savingAll}
                            className="flex flex-1 items-center justify-center gap-1 rounded-md bg-green-500/20 py-1 text-[10px] font-bold text-green-400 transition-colors hover:bg-green-500/30 disabled:opacity-40"
                          >
                            {card.saving ? (
                              <Loader2 className="h-2.5 w-2.5 animate-spin" />
                            ) : (
                              <Save className="h-2.5 w-2.5" />
                            )}
                            Save
                          </button>
                        ) : null}
                        <div className="flex flex-1 items-stretch gap-0.5">
                          <button
                            onClick={() => handleRegenOne(i)}
                            disabled={card.generating || isGenerating}
                            className="flex min-w-0 flex-1 items-center justify-center gap-1 rounded-md bg-white/5 py-1 text-[10px] font-bold text-white/40 transition-colors hover:bg-white/10 disabled:opacity-40"
                          >
                            <RefreshCw className="h-2.5 w-2.5 shrink-0" />
                            Regen
                          </button>
                          <BluffAiSettingsButton
                            size="sm"
                            onClick={() => setBulkAiSettingsOpen(true)}
                            disabled={card.generating || isGenerating}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer actions */}
        {anyCards && (
          <div className="flex shrink-0 gap-2 border-t border-white/10 p-4">
            {unsavedCount > 0 && (
              <button
                onClick={handleSaveAll}
                disabled={savingAll || isGenerating}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-500 py-3 text-sm font-bold text-black transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
              >
                {savingAll ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save All ({unsavedCount})
              </button>
            )}
            {savedCount > 0 && (
              <button
                onClick={handleClose}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/20 py-3 text-sm font-bold text-white transition-colors hover:bg-white/10"
              >
                <Check className="h-4 w-4" />
                Done ({savedCount} saved)
              </button>
            )}
          </div>
        )}
      </div>

      <BluffAiImageSettingsModal
        open={bulkAiSettingsOpen}
        onClose={() => setBulkAiSettingsOpen(false)}
        context="bulk"
      />
    </div>
  );
}
