"use client";

import { useState, useCallback, useRef } from "react";
import {
  Loader2,
  RefreshCw,
  ImagePlus,
  Trash2,
  Upload,
  Plus,
  Sparkles,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import {
  createBlarfPack,
  updateBlarfPack,
  type BlarfPack,
} from "@/lib/blarf-packs";
import {
  uploadBlarfCover,
  fetchBlarfImageAsBlob,
  validateBlarfImageFile,
  BLARF_IMAGE_ACCEPT,
} from "@/lib/blarf-storage";
import type { BlarfRoundData, VoiceStyle } from "../blarfTypes";
import { VOICE_STYLE_LABELS } from "../blarfTypes";
import { JMCard } from "@/JMKit";
import { getAIAuthHeaders } from "@/app/games/_gamecore/getAIAuthHeaders";
import { buildBluffPackCoverPrompt } from "@/app/games/bluffbox/packs/contentPrompts";
import { postGenerateBluffImage } from "@/app/games/bluffbox/packs/postGenerateBluffImage";
import { BluffAiImageSettingsModal } from "@/app/games/bluffbox/packs/BluffAiImageSettingsModal";
import { BluffAiSettingsButton } from "@/app/games/bluffbox/packs/BluffAiSettingsButton";

const VOICE_STYLE_OPTIONS: VoiceStyle[] = [
  "normal", "shout", "whisper", "sing", "robot", "opera",
  "cowboy", "baby", "dramatic", "bored", "pirate", "british", "valley_girl",
];

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

interface BlarfPackEditorProps {
  existingPack?: BlarfPack | undefined;
  onSaved: (pack: BlarfPack) => void;
}

function withImageCacheBust(url: string, bust: number): string {
  if (!url || bust <= 0) return url;
  return `${url}${url.includes("?") ? "&" : "?"}_dv=${bust}`;
}

export default function BlarfPackEditor({ existingPack, onSaved }: BlarfPackEditorProps) {
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
  const [rounds, setRounds] = useState<BlarfRoundData[]>(existingPack?.rounds ?? []);
  const [expandedRound, setExpandedRound] = useState<number | null>(rounds.length > 0 ? 0 : null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverFileInputRef = useRef<HTMLInputElement>(null);
  const coverUploadPackIdRef = useRef<string | null>(existingPack?.id ?? null);

  // Per-round AI generation state
  const [generatingWordsFor, setGeneratingWordsFor] = useState<number | null>(null);

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
      const invalid = validateBlarfImageFile(file);
      if (invalid) { setError(invalid); return; }
      setUploadingCover(true);
      setError(null);
      try {
        const url = await uploadBlarfCover(coverUploadPackId(), file);
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

  // ─── Round management ──────────────────────────────────────

  const addRound = useCallback(() => {
    const usedLetters = new Set(rounds.map((r) => r.letter));
    const nextLetter = LETTERS.find((l) => !usedLetters.has(l)) ?? "A";
    const newRound: BlarfRoundData = { letter: nextLetter, words: [] };
    setRounds((prev) => [...prev, newRound]);
    setExpandedRound(rounds.length);
  }, [rounds]);

  const removeRound = useCallback((index: number) => {
    setRounds((prev) => prev.filter((_, i) => i !== index));
    setExpandedRound(null);
  }, []);

  const updateRoundLetter = useCallback((index: number, letter: string) => {
    setRounds((prev) => prev.map((r, i) => i === index ? { ...r, letter } : r));
  }, []);

  const updateRoundVoiceStyle = useCallback((index: number, voiceStyle: VoiceStyle | undefined) => {
    setRounds((prev) => prev.map((r, i) => i === index ? { ...r, voiceStyle } : r));
  }, []);

  const addWordToRound = useCallback((index: number, word: string) => {
    setRounds((prev) => prev.map((r, i) =>
      i === index ? { ...r, words: [...r.words, word] } : r,
    ));
  }, []);

  const removeWordFromRound = useCallback((roundIndex: number, wordIndex: number) => {
    setRounds((prev) => prev.map((r, i) =>
      i === roundIndex ? { ...r, words: r.words.filter((_, wi) => wi !== wordIndex) } : r,
    ));
  }, []);

  // ─── AI word generation ────────────────────────────────────

  const handleAIGenerateWords = useCallback(async (roundIndex: number) => {
    const round = rounds[roundIndex];
    if (!round) return;
    setGeneratingWordsFor(roundIndex);
    setError(null);
    try {
      // Collect all existing words across all rounds to avoid duplicates
      const existingWords = rounds.flatMap((r) => r.words);
      const avoidClause = existingWords.length > 0
        ? `\n\nDo NOT generate any of these existing words (or close variations):\n${existingWords.join(", ")}`
        : "";

      const headers = await getAIAuthHeaders();
      const res = await fetch("/api/games/ai", {
        method: "POST",
        headers,
        body: JSON.stringify({
          type: "move",
          model: "sonnet",
          prompt:
            `You are a word inventor for BLARF!, a party game where players say made-up Dr. Seuss-style nonsense words aloud.

Generate 15 fun, pronounceable nonsense words that all start with the letter "${round.letter}".

Rules:
- Each word must start with "${round.letter}" (uppercase)
- Words should be 2-4 syllables, fun to say aloud
- Think Dr. Seuss / Roald Dahl style: whimsical, playful, slightly absurd
- Each word should be unique and distinct-sounding
- Words should be easy to pronounce but clearly made-up
- Mix hard and soft sounds for variety

Examples of the style (for other letters):
Snozzwang, Glorpfizzle, Bumblequark, Fizzlewhonk, Wumblefrizz${avoidClause}

Output exactly 15 words, one per line. No numbering, no explanations.`,
          maxTokens: 512,
          temperature: 1.0,
        }),
      });
      if (!res.ok) throw new Error("AI generation failed");
      const data = (await res.json()) as { text?: string };
      if (!data.text) throw new Error("No text returned");

      const words = data.text
        .split("\n")
        .map((l: string) => l.replace(/^[-•*\d.)\s]+/, "").trim())
        .filter((l: string) => l.length > 2 && l.length <= 30);

      if (words.length === 0) {
        setError("AI returned no usable words. Try again.");
        return;
      }

      setRounds((prev) => prev.map((r, i) =>
        i === roundIndex ? { ...r, words: [...r.words, ...words] } : r,
      ));
    } catch {
      setError("AI word generation failed. Try again.");
    } finally {
      setGeneratingWordsFor(null);
    }
  }, [rounds]);

  // ─── Save pack ─────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!user || !gamertag) return;
    if (!name.trim()) { setError("Pack name is required."); return; }
    if (!coverURL) { setError("A cover image is required."); return; }
    if (rounds.length === 0) { setError("Add at least one round."); return; }

    const emptyRound = rounds.findIndex((r) => r.words.length === 0);
    if (emptyRound >= 0) {
      setError(`Round ${emptyRound + 1} (Letter ${rounds[emptyRound]!.letter}) has no words.`);
      return;
    }

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
        const blob = await fetchBlarfImageAsBlob(coverURL);
        const packId = existingPack?.id ?? coverUploadPackId();
        finalCoverURL = await uploadBlarfCover(packId, blob);
      }

      if (existingPack) {
        await updateBlarfPack(existingPack.id, {
          name: name.trim(),
          coverImageURL: finalCoverURL,
          visibility,
          rounds,
          ...(subtitle.trim() ? { subtitle: subtitle.trim() } : {}),
          ...(description.trim() ? { description: description.trim() } : {}),
        });
        onSaved({
          ...existingPack,
          name: name.trim(),
          coverImageURL: finalCoverURL,
          visibility,
          rounds,
        });
      } else {
        const pack = await createBlarfPack(
          {
            name: name.trim(),
            coverImageURL: finalCoverURL,
            visibility,
            rounds,
            ...(subtitle.trim() ? { subtitle: subtitle.trim() } : {}),
            ...(description.trim() ? { description: description.trim() } : {}),
          },
          user.uid,
          gamertag,
        );

        // Re-upload cover with real pack ID if we used a temp ID
        if (finalCoverURL.includes("temp-")) {
          const blob = await fetchBlarfImageAsBlob(finalCoverURL);
          const permanentURL = await uploadBlarfCover(pack.id, blob);
          await updateBlarfPack(pack.id, { coverImageURL: permanentURL });
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
    user, gamertag, name, subtitle, description, coverURL,
    isOfficial, isShared, isAdmin, existingPack, onSaved, rounds, coverUploadPackId,
  ]);

  return (
    <div className="space-y-4">
      {/* ── Pack Name ── */}
      <div className="overflow-hidden rounded-xl border border-white/10 bg-black/30">
        <div className="bg-[#F7D047]/10 px-4 py-2.5">
          <p className="text-xs font-bold uppercase tracking-wider text-[#F7D047]">Pack Name</p>
        </div>
        <div className="p-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter pack name..."
            className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2.5 text-base font-bold text-white placeholder-white/30 outline-none focus:border-[#F7D047]/50"
          />
        </div>
      </div>

      {/* ── Cover Image ── */}
      <div className="overflow-hidden rounded-xl border border-white/10 bg-black/30">
        <div className="bg-[#F7D047]/10 px-4 py-2.5">
          <p className="text-xs font-bold uppercase tracking-wider text-[#F7D047]">Cover Image</p>
        </div>
        <div className="space-y-3 p-4">
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

          <div className="space-y-2">
            <input
              type="text"
              value={coverPrompt}
              onChange={(e) => setCoverPrompt(e.target.value)}
              placeholder="Describe your cover image..."
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-[#F7D047]/40"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleGenerateCover}
                disabled={generatingCover || uploadingCover || !coverPrompt.trim()}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#F7D047] py-3 text-sm font-bold text-black transition active:opacity-80 disabled:opacity-50"
              >
                {generatingCover ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                Generate
              </button>
              <input
                ref={coverFileInputRef}
                type="file"
                accept={BLARF_IMAGE_ACCEPT}
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
      <div className="overflow-hidden rounded-xl border border-white/10 bg-black/30">
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

      {/* ── Rounds ── */}
      <div className="overflow-hidden rounded-xl border border-white/10 bg-black/30">
        <div className="flex items-center justify-between bg-[#C93C3C]/15 px-4 py-2.5">
          <p className="text-xs font-bold uppercase tracking-wider text-[#C93C3C]">Rounds</p>
          <span className="rounded-full bg-[#C93C3C]/20 px-2 py-0.5 text-[11px] font-bold tabular-nums text-[#C93C3C]">
            {rounds.length}
          </span>
        </div>
        <div className="space-y-2 p-4">
          {rounds.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#C93C3C]/20 bg-[#C93C3C]/5 px-4 py-8 text-center text-sm text-red-300/60">
              No rounds yet. Add some below!
            </div>
          ) : (
            rounds.map((round, ri) => {
              const isOpen = expandedRound === ri;
              return (
                <RoundEditor
                  key={ri}
                  round={round}
                  index={ri}
                  isOpen={isOpen}
                  onToggle={() => setExpandedRound(isOpen ? null : ri)}
                  onLetterChange={(l) => updateRoundLetter(ri, l)}
                  onVoiceStyleChange={(vs) => updateRoundVoiceStyle(ri, vs)}
                  onAddWord={(w) => addWordToRound(ri, w)}
                  onRemoveWord={(wi) => removeWordFromRound(ri, wi)}
                  onRemoveRound={() => removeRound(ri)}
                  onAIGenerate={() => handleAIGenerateWords(ri)}
                  generatingWords={generatingWordsFor === ri}
                />
              );
            })
          )}

          <button
            onClick={addRound}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#C93C3C]/30 py-3 text-sm font-bold text-[#C93C3C] transition active:bg-[#C93C3C]/10"
          >
            <Plus className="h-4 w-4" />
            Add Round
          </button>
        </div>
      </div>

      {/* ── Visibility ── */}
      <div className="overflow-hidden rounded-xl border border-white/10 bg-black/30">
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
                className="h-5 w-5 rounded border-white/30 bg-white/5 accent-[#F7D047]"
              />
              <span className="text-sm text-white/60">
                Make this an <span className="font-bold text-[#F7D047]">Official Pack</span>
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

      {/* ── Error ── */}
      {error && (
        <p className="rounded-lg bg-red-500/10 px-4 py-3 text-center text-sm font-semibold text-red-400">{error}</p>
      )}

      {/* ── Sticky Save Button ── */}
      <div className="sticky bottom-0 -mx-4 border-t border-white/10 bg-[#2B4B6F]/90 px-4 py-3 backdrop-blur-sm">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-xl py-4 text-base font-bold uppercase tracking-wider text-black shadow-lg transition active:opacity-80 disabled:opacity-50"
          style={{ backgroundColor: "#F7D047" }}
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

// ─── Round Editor Sub-Component ─────────────────────────────

interface RoundEditorProps {
  round: BlarfRoundData;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
  onLetterChange: (letter: string) => void;
  onVoiceStyleChange: (vs: VoiceStyle | undefined) => void;
  onAddWord: (word: string) => void;
  onRemoveWord: (wordIndex: number) => void;
  onRemoveRound: () => void;
  onAIGenerate: () => void;
  generatingWords: boolean;
}

function RoundEditor({
  round,
  index,
  isOpen,
  onToggle,
  onLetterChange,
  onVoiceStyleChange,
  onAddWord,
  onRemoveWord,
  onRemoveRound,
  onAIGenerate,
  generatingWords,
}: RoundEditorProps) {
  const [newWord, setNewWord] = useState("");

  const handleAddWord = () => {
    const trimmed = newWord.trim();
    if (!trimmed) return;
    onAddWord(trimmed);
    setNewWord("");
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/3">
      {/* Header */}
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        {isOpen ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-white/40" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-white/40" />
        )}
        <span className="text-xl font-black" style={{ color: "#F7D047" }}>
          {round.letter}
        </span>
        <span className="min-w-0 flex-1 text-sm text-white/50">
          {round.words.length} word{round.words.length !== 1 ? "s" : ""}
          {round.voiceStyle && round.voiceStyle !== "normal" && (
            <span className="ml-2 text-amber-300/60">
              {VOICE_STYLE_LABELS[round.voiceStyle]}
            </span>
          )}
        </span>
        <span className="text-xs font-bold text-white/30">
          Round {index + 1}
        </span>
      </button>

      {/* Expanded content */}
      {isOpen && (
        <div className="space-y-3 border-t border-white/5 px-4 py-3">
          {/* Letter + Voice Style row */}
          <div className="flex gap-3">
            <div className="w-20">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-white/30">Letter</p>
              <select
                value={round.letter}
                onChange={(e) => onLetterChange(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-center text-lg font-black text-[#F7D047] outline-none"
              >
                {LETTERS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-white/30">Voice Style</p>
              <select
                value={round.voiceStyle ?? "normal"}
                onChange={(e) => {
                  const val = e.target.value as VoiceStyle;
                  onVoiceStyleChange(val === "normal" ? undefined : val);
                }}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-sm text-white outline-none"
              >
                {VOICE_STYLE_OPTIONS.map((vs) => (
                  <option key={vs} value={vs}>{VOICE_STYLE_LABELS[vs]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Words list */}
          {round.words.length > 0 && (
            <div className="flex max-h-48 flex-col gap-1 overflow-y-auto overscroll-contain">
              {round.words.map((word, wi) => (
                <div
                  key={`${wi}-${word}`}
                  className="flex items-center gap-2 rounded-lg bg-white/3 px-3 py-1.5"
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-white/70">{word}</span>
                  <button
                    onClick={() => onRemoveWord(wi)}
                    className="shrink-0 rounded p-1 text-red-400/40 transition active:bg-red-400/10 active:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add word */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddWord();
                }
              }}
              placeholder={`Add a word starting with ${round.letter}...`}
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-[#F7D047]/40"
            />
            <button
              onClick={handleAddWord}
              disabled={!newWord.trim()}
              className="rounded-lg bg-[#F7D047] px-4 py-2 text-sm font-bold text-black transition active:opacity-80 disabled:opacity-50"
            >
              Add
            </button>
          </div>

          {/* AI Generate + Remove Round */}
          <div className="flex gap-2">
            <button
              onClick={onAIGenerate}
              disabled={generatingWords}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#F7D047]/15 py-3 text-sm font-bold text-[#F7D047] transition active:bg-[#F7D047]/25 disabled:opacity-50"
            >
              {generatingWords ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              AI Generate Words
            </button>
            <button
              onClick={onRemoveRound}
              className="flex items-center justify-center gap-2 rounded-xl bg-red-500/10 px-4 py-3 text-sm font-bold text-red-400/60 transition active:bg-red-500/20 active:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
