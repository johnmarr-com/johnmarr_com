"use client";

import { useState, useCallback, useRef } from "react";
import { Loader2, RefreshCw, ImagePlus, Trash2, Upload, Plus, Sparkles, ClipboardPaste, Download } from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import {
  createPack,
  updatePack,
  addDefinitionToPack,
  addDefinitionsToPack,
  removeDefinitionFromPack,
  type WordonkulousPack,
} from "@/lib/wordonkulous-packs";
import {
  uploadWordonkulousCover,
  fetchWordonkulousImageAsBlob,
  validateWordonkulousImageFile,
  WORDONKULOUS_IMAGE_ACCEPT,
} from "@/lib/wordonkulous-storage";
import { JMCard } from "@/JMKit";
import { getAIAuthHeaders } from "@/app/games/_gamecore/getAIAuthHeaders";
import { buildBluffPackCoverPrompt } from "@/app/games/bluffbox/packs/contentPrompts";
import { postGenerateBluffImage } from "@/app/games/bluffbox/packs/postGenerateBluffImage";
import { BluffAiImageSettingsModal } from "@/app/games/bluffbox/packs/BluffAiImageSettingsModal";
import { BluffAiSettingsButton } from "@/app/games/bluffbox/packs/BluffAiSettingsButton";

interface WordonkulousPackEditorProps {
  existingPack?: WordonkulousPack | undefined;
  onSaved: (pack: WordonkulousPack) => void;
}

/** Append a cache-busting query so the browser reloads after overwriting the same Storage path. */
function withImageCacheBust(url: string, bust: number): string {
  if (!url || bust <= 0) return url;
  return `${url}${url.includes("?") ? "&" : "?"}_dv=${bust}`;
}

export default function WordonkulousPackEditor({ existingPack, onSaved }: WordonkulousPackEditorProps) {
  const { user, gamertag, isAdmin, aiImageGenSettings } = useAuth();

  const [name, setName] = useState(existingPack?.name ?? "");
  const [subtitle, setSubtitle] = useState(existingPack?.subtitle ?? "");
  const [description, setDescription] = useState(existingPack?.description ?? "");
  const [coverPrompt, setCoverPrompt] = useState("");
  const [coverAiSettingsOpen, setCoverAiSettingsOpen] = useState(false);
  const [coverURL, setCoverURL] = useState(existingPack?.coverImageURL ?? "");
  const [coverPreviewBust, setCoverPreviewBust] = useState(0);
  const [coverTempURL, setCoverTempURL] = useState<string | null>(null);
  const [generatingCover, setGeneratingCover] = useState(false);
  const [isOfficial, setIsOfficial] = useState(existingPack?.visibility === "official");
  const [isShared, setIsShared] = useState(
    existingPack?.visibility === "shared" || existingPack?.visibility === "official",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [definitions, setDefinitions] = useState<string[]>(existingPack?.definitions ?? []);
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverFileInputRef = useRef<HTMLInputElement>(null);
  const coverUploadPackIdRef = useRef<string | null>(existingPack?.id ?? null);

  // Single definition input
  const [newDef, setNewDef] = useState("");
  const [addingDef, setAddingDef] = useState(false);

  // Bulk paste
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [addingBulk, setAddingBulk] = useState(false);

  // AI generate
  const [generatingDefs, setGeneratingDefs] = useState(false);

  // ─── Cover image ───────────────────────────────────────────

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
      const invalid = validateWordonkulousImageFile(file);
      if (invalid) {
        setError(invalid);
        return;
      }
      setUploadingCover(true);
      setError(null);
      try {
        const url = await uploadWordonkulousCover(coverUploadPackId(), file);
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

  // ─── Definitions ───────────────────────────────────────────

  const handleAddDefinition = useCallback(async () => {
    const trimmed = newDef.trim();
    if (!trimmed) return;
    if (definitions.includes(trimmed)) {
      setError("That definition already exists in this pack.");
      return;
    }
    setAddingDef(true);
    setError(null);
    try {
      if (existingPack) {
        await addDefinitionToPack(existingPack.id, trimmed);
      }
      setDefinitions((prev) => [...prev, trimmed]);
      setNewDef("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add definition.");
    } finally {
      setAddingDef(false);
    }
  }, [newDef, definitions, existingPack]);

  const handleRemoveDefinition = useCallback(
    async (def: string) => {
      setError(null);
      try {
        if (existingPack) {
          await removeDefinitionFromPack(existingPack.id, def);
        }
        setDefinitions((prev) => prev.filter((d) => d !== def));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to remove definition.");
      }
    },
    [existingPack],
  );

  const handleBulkAdd = useCallback(async () => {
    const lines = bulkText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length === 0) return;

    const existingSet = new Set(definitions);
    const unique = lines.filter((l) => !existingSet.has(l));
    if (unique.length === 0) {
      setError("All those definitions already exist in this pack.");
      return;
    }

    setAddingBulk(true);
    setError(null);
    try {
      if (existingPack) {
        await addDefinitionsToPack(existingPack.id, unique);
      }
      setDefinitions((prev) => [...prev, ...unique]);
      setBulkText("");
      setShowBulk(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add definitions.");
    } finally {
      setAddingBulk(false);
    }
  }, [bulkText, definitions, existingPack]);

  const handleAIGenerate = useCallback(async () => {
    setGeneratingDefs(true);
    setError(null);
    try {
      const headers = await getAIAuthHeaders();
      const res = await fetch("/api/games/ai", {
        method: "POST",
        headers,
        body: JSON.stringify({
          type: "move",
          model: "sonnet",
          prompt:
            `You are a comedy writer for Wordonkulous, a party game where players invent words for absurd definitions. Your job is to generate definitions for things that don't have words yet — but should.

## What Makes a Great Definition

A great definition is:
- **Specific and sensory** — paint a picture, not a concept
- **Universally relatable** — everyone has experienced this
- **Begging for a word** — the reader thinks "why ISN'T there a word for this?"
- **A noun, verb, or adjective** — something nameable

A great definition is NOT:
- Abstract or vague ("the essence of...", "a feeling of...")
- Requiring explanation to understand
- Niche or insider knowledge
- Already has a word for it

## Categories That Work Well

Draw from these areas of human experience:
- Kitchen and food frustrations
- Technology failures and micro-rage
- Social awkwardness and micro-moments
- Bathroom, hygiene, and body weirdness
- Driving and commuting annoyances
- Sleep, morning, and bedtime rituals
- Office and work absurdities
- Grocery stores and waiting in lines
- Clothing and getting dressed
- Pets and their strange behaviors
- Weather and seasonal annoyances
- Sounds that shouldn't exist but do

## Examples of Perfect Definitions

These are the gold standard. Study them:

"The act of running over a string with the vacuum at least a dozen times, reaching over and picking it up, examining it, then putting it back down to give the vacuum one more chance."

"The orange residue left on your fingers after eating cheese puffs."

"The actions of two people maneuvering for one armrest in a movie theater."

"The small line of debris that refuses to be swept onto the dustpan and keeps backing you across the room until you finally give up and sweep it under the rug."

"Manhandling the 'open here' spout on a milk carton so badly that you have to resort to the other side."

"The mistaken notion that pressing the elevator button repeatedly will make it arrive faster."

"The spark of frustrated confusion when neither side of the USB cable fits, despite countless flipping attempts."

"Dialing a phone number and forgetting who you were calling just as they answer."

"Turning the pillow over and over, looking for the cool spot."

"Sterilizing the piece of candy you dropped on the floor by blowing on it, assuming this will somehow remove all the germs."

"The fatty wrinkles under the belly of a morbidly obese cow."

"The panic when you wave back at someone who wasn't waving at you."

"The way people stand when examining other people's bookshelves."

"The vague uncomfortable feeling when sitting on a seat still warm from somebody else's bottom."

## Examples of Bad Definitions (Avoid These)

"The fuzzy essence of energy that forms the building blocks of nano particles."
→ Too abstract, not relatable, no clear image

"A feeling of sadness."
→ Too vague, already has words for it

"When you feel weird about something."
→ No specificity, no image, nothing to grab

"The quantum state of being both tired and awake."
→ Tries too hard, not grounded in real experience

## Output Format

Generate definitions only. No words. No numbering. One definition per line. Each should be a complete, standalone description that could appear on a game card.

Vary the tone across your output:
- Some gross/visceral
- Some wholesome/relatable
- Some frustrating/rage-inducing
- Some awkward/social
- Some absurd/weird

Aim for 10-30 words per definition. Long enough to be specific, short enough to read on a card.

Generate 5 definitions now.`,
          maxTokens: 1024,
          temperature: 1.0,
        }),
      });
      if (!res.ok) throw new Error("AI generation failed");
      const data = (await res.json()) as { text?: string };
      if (!data.text) throw new Error("No text returned");

      const lines = data.text
        .split("\n")
        .map((l: string) => {
          const cleaned = l.replace(/^[-•*\d.)\s]+/, "").trim();
          return cleaned && !cleaned.endsWith(".") ? `${cleaned}.` : cleaned;
        })
        .filter((l: string) => l.length > 5 && l.length <= 150);

      if (lines.length === 0) {
        setError("AI returned no usable definitions. Try again.");
        return;
      }

      const existingSet = new Set(definitions);
      const unique = lines.filter((l: string) => !existingSet.has(l));

      if (existingPack && unique.length > 0) {
        await addDefinitionsToPack(existingPack.id, unique);
      }
      setDefinitions((prev) => [...prev, ...unique]);
    } catch {
      setError("AI definition generation failed. Try again.");
    } finally {
      setGeneratingDefs(false);
    }
  }, [definitions, existingPack]);

  // ─── Save pack ─────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!user || !gamertag) return;
    if (!name.trim()) { setError("Pack name is required."); return; }
    if (!coverURL) { setError("A cover image is required."); return; }

    setSaving(true);
    setError(null);

    try {
      const visibility = isAdmin && isOfficial ? "official" : isShared ? "shared" : "private";

      let finalCoverURL = coverURL;

      const remoteTemp =
        coverURL.includes("replicate.delivery") ||
        coverURL.includes("pbxt.replicate") ||
        coverURL.includes("ideogram.ai");
      if (remoteTemp) {
        const blob = await fetchWordonkulousImageAsBlob(coverURL);
        const packId = existingPack?.id ?? coverUploadPackId();
        finalCoverURL = await uploadWordonkulousCover(packId, blob);
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
          definitions,
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

        // Persist definitions that were added before save
        if (definitions.length > 0) {
          await addDefinitionsToPack(pack.id, definitions);
          pack.definitions = definitions;
        }

        // Re-upload cover with real pack ID if we used a temp ID
        if (finalCoverURL.includes("temp-")) {
          const blob = await fetchWordonkulousImageAsBlob(finalCoverURL);
          const permanentURL = await uploadWordonkulousCover(pack.id, blob);
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
    definitions,
    coverUploadPackId,
  ]);

  return (
    <div className="space-y-4">
      {/* ── Pack Name ── */}
      <div className="rounded-xl border border-white/10 bg-black/30 overflow-hidden">
        <div className="bg-amber-500/10 px-4 py-2.5">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-400">Pack Name</p>
        </div>
        <div className="p-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter pack name..."
            className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2.5 text-base font-bold text-white placeholder-white/30 outline-none focus:border-amber-400/50"
          />
        </div>
      </div>

      {/* ── Cover Image ── */}
      <div className="rounded-xl border border-white/10 bg-black/30 overflow-hidden">
        <div className="bg-amber-500/10 px-4 py-2.5">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-400">Cover Image</p>
        </div>
        <div className="space-y-3 p-4">
          {/* Cover preview */}
          <div className="flex flex-col items-center gap-3">
            {coverTempURL ? (
              <>
                <JMCard className="aspect-square w-full max-w-[280px] bg-neutral-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={coverTempURL} alt="" className="h-full w-full object-cover" />
                </JMCard>
                <div className="flex w-full gap-2">
                  <button
                    onClick={handleUseCover}
                    className="flex-1 rounded-xl bg-green-500 py-3 text-sm font-bold text-black transition active:opacity-80"
                  >
                    Use This
                  </button>
                  <button
                    onClick={handleGenerateCover}
                    disabled={generatingCover}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/20 py-3 text-sm font-semibold text-white/60 transition active:bg-white/10"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Redo
                  </button>
                </div>
              </>
            ) : coverURL ? (
              <JMCard className="aspect-square w-full max-w-[280px] bg-neutral-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={withImageCacheBust(coverURL, coverPreviewBust)}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </JMCard>
            ) : (
              <JMCard className="flex aspect-square w-full max-w-[280px] items-center justify-center border-2 border-dashed border-white/10 text-sm text-white/20">
                No cover yet
              </JMCard>
            )}
          </div>

          {/* Generate / Upload row */}
          <div className="space-y-2">
            <input
              type="text"
              value={coverPrompt}
              onChange={(e) => setCoverPrompt(e.target.value)}
              placeholder="Describe your cover image..."
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-amber-400/40"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleGenerateCover}
                disabled={generatingCover || uploadingCover || !coverPrompt.trim()}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 text-sm font-bold text-black transition active:opacity-80 disabled:opacity-50"
              >
                {generatingCover ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                Generate
              </button>
              <input
                ref={coverFileInputRef}
                type="file"
                accept={WORDONKULOUS_IMAGE_ACCEPT}
                className="sr-only"
                onChange={handleCoverFileChange}
              />
              <button
                type="button"
                onClick={() => coverFileInputRef.current?.click()}
                disabled={generatingCover || uploadingCover}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/20 py-3 text-sm font-bold text-white/70 transition active:bg-white/10 disabled:opacity-50"
              >
                {uploadingCover ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Upload
              </button>
              <BluffAiSettingsButton onClick={() => setCoverAiSettingsOpen(true)} disabled={generatingCover} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Details (optional) ── */}
      <div className="rounded-xl border border-white/10 bg-black/30 overflow-hidden">
        <div className="bg-white/5 px-4 py-2.5">
          <p className="text-xs font-bold uppercase tracking-wider text-white/40">Details (optional)</p>
        </div>
        <div className="space-y-3 p-4">
          <input
            type="text"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="Subtitle"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-white/30"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            rows={3}
            className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-white/30"
          />
        </div>
      </div>

      {/* ── Definitions ── */}
      <div className="rounded-xl border border-white/10 bg-black/30 overflow-hidden">
        <div className="bg-amber-500/10 px-4 py-2.5 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-400">
            Definitions
          </p>
          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-bold tabular-nums text-amber-400">
            {definitions.length}
          </span>
        </div>
        <div className="space-y-3 p-4">
          {/* Definition list */}
          {definitions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-amber-400/20 bg-amber-400/5 px-4 py-8 text-center text-sm text-amber-300/60">
              No definitions yet. Add some below!
            </div>
          ) : (
            <div className="flex max-h-72 flex-col gap-2 overflow-y-auto overscroll-contain">
              {definitions.map((def, i) => (
                <div
                  key={`${i}-${def.slice(0, 20)}`}
                  className="flex items-start gap-2 rounded-lg border border-white/5 bg-white/3 px-3 py-2.5"
                >
                  <span className="min-w-0 flex-1 text-sm leading-relaxed text-white/70">{def}</span>
                  <button
                    onClick={() => handleRemoveDefinition(def)}
                    className="shrink-0 rounded-lg p-2 text-red-400/50 transition active:bg-red-400/10 active:text-red-400"
                    aria-label="Remove definition"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add single definition */}
          <div className="space-y-2">
            <textarea
              value={newDef}
              onChange={(e) => setNewDef(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleAddDefinition();
                }
              }}
              rows={3}
              placeholder="Type a definition..."
              className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm leading-relaxed text-white placeholder-white/25 outline-none focus:border-amber-400/40"
            />
            <button
              onClick={handleAddDefinition}
              disabled={addingDef || !newDef.trim()}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-amber-500 py-3 text-sm font-bold text-black transition active:opacity-80 disabled:opacity-50"
            >
              {addingDef ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add Definition
            </button>
          </div>

          {/* Action buttons row */}
          <div className="flex gap-2">
            <button
              onClick={handleAIGenerate}
              disabled={generatingDefs}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500/15 py-3.5 text-sm font-bold text-amber-400 transition active:bg-amber-500/25 disabled:opacity-50"
            >
              {generatingDefs ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              AI Generate
            </button>
            <button
              onClick={() => setShowBulk(!showBulk)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-purple-500/15 py-3.5 text-sm font-bold text-purple-300 transition active:bg-purple-500/25"
            >
              <ClipboardPaste className="h-4 w-4" />
              Bulk Paste
            </button>
          </div>

          {/* Bulk paste area */}
          {showBulk && (
            <div className="space-y-3 rounded-xl border border-purple-400/20 bg-purple-950/20 p-4">
              <p className="text-sm text-purple-300/60">One definition per line:</p>
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                rows={6}
                placeholder={"The act of pretending to type when your boss walks by\nThe sound your stomach makes during a quiet meeting\nThe urge to correct someone's grammar but holding it in"}
                className="w-full resize-none rounded-lg border border-purple-400/20 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-purple-400/40"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowBulk(false); setBulkText(""); }}
                  className="flex-1 rounded-xl border border-white/10 py-3 text-sm font-semibold text-white/50 transition active:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkAdd}
                  disabled={addingBulk || !bulkText.trim()}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-purple-500 py-3 text-sm font-bold text-white transition active:opacity-80 disabled:opacity-50"
                >
                  {addingBulk ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Add All
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Visibility ── */}
      <div className="rounded-xl border border-white/10 bg-black/30 overflow-hidden">
        <div className="bg-white/5 px-4 py-2.5">
          <p className="text-xs font-bold uppercase tracking-wider text-white/40">Visibility</p>
        </div>
        <div className="space-y-3 p-4">
          {isAdmin && (
            <label className="flex cursor-pointer items-center gap-3 rounded-lg p-2 transition active:bg-white/5">
              <input
                type="checkbox"
                checked={isOfficial}
                onChange={(e) => setIsOfficial(e.target.checked)}
                className="h-5 w-5 rounded border-white/30 bg-white/5 accent-amber-400"
              />
              <span className="text-sm text-white/60">
                Make this an <span className="font-bold text-amber-400">Official Pack</span>
              </span>
            </label>
          )}
          {!isOfficial && (
            <label className="flex cursor-pointer items-center gap-3 rounded-lg p-2 transition active:bg-white/5">
              <input
                type="checkbox"
                checked={isShared}
                onChange={(e) => setIsShared(e.target.checked)}
                className="h-5 w-5 rounded border-white/30 bg-white/5 accent-blue-400"
              />
              <span className="text-sm text-white/60">
                Share this pack with everyone
              </span>
            </label>
          )}
        </div>
      </div>

      {/* ── Export ── */}
      {definitions.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-black/30 overflow-hidden">
          <div className="bg-white/5 px-4 py-2.5">
            <p className="text-xs font-bold uppercase tracking-wider text-white/40">Export</p>
          </div>
          <div className="p-4">
            <button
              onClick={() => {
                const text = definitions.join("\n");
                const blob = new Blob([text], { type: "text/plain" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${(name.trim() || "pack").replace(/\s+/g, "-").toLowerCase()}-definitions.txt`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 py-3 text-sm font-semibold text-white/50 transition active:bg-white/5 active:text-white/70"
            >
              <Download className="h-4 w-4" />
              Download definitions as .txt
            </button>
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <p className="rounded-lg bg-red-500/10 px-4 py-3 text-center text-sm font-semibold text-red-400">{error}</p>
      )}

      {/* ── Sticky Save Button ── */}
      <div className="sticky bottom-0 -mx-4 border-t border-white/10 bg-black/90 px-4 py-3 backdrop-blur-sm">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-xl bg-amber-500 py-4 text-base font-bold uppercase tracking-wider text-black shadow-lg shadow-amber-500/20 transition active:opacity-80 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="mx-auto h-6 w-6 animate-spin" />
          ) : existingPack ? (
            "Save Changes"
          ) : (
            "Create Pack"
          )}
        </button>
      </div>

      <BluffAiImageSettingsModal
        open={coverAiSettingsOpen}
        onClose={() => setCoverAiSettingsOpen(false)}
        context="cover"
      />
    </div>
  );
}
