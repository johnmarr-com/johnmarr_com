"use client";

import { useState, useCallback, useRef } from "react";
import { useAuth } from "@/lib/AuthProvider";
import { createHeist, updateHeist, type CreateHeistInput } from "@/lib/fyve-heists";
import type {
  FyveAsset,
  FyveCivilian,
  FyveHeist,
  FyveHeistSetting,
  FyveWordPool,
} from "../fyveTypes";
import { HEIST_ELEMENT_LABELS } from "../fyveTypes";
import { GamePrimaryButton, useAutosave, SavedFlash } from "@/app/games/_gamecore";
import { ImageIcon, Volume2, Info } from "lucide-react";
import HeistImageModal from "./HeistImageModal";
import { uploadFyveAudio } from "@/lib/fyve-storage";
import { JMAudioUpload } from "@/JMKit/JMAudioUpload";
import { JMCloseCircleButton } from "@/JMKit/JMCloseCircleButton";
import { createPortal } from "react-dom";

// ─── Default empty state ────────────────────────────────────

const emptyAsset = (): FyveAsset => ({
  id: `asset_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  name: "",
  description: "",
  imageUrl: "",
  bombDescription: "",
  bombImageUrl: "",
  bombSoundEffect: "",
});

const emptyCivilian = (): FyveCivilian => ({
  id: `civ_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  name: "",
  description: "",
  imageUrl: "",
});

interface HeistEditorProps {
  /** Pass an existing heist to edit (e.g. a draft). Omit for new heist. */
  editHeist?: FyveHeist;
}

export default function HeistEditor({ editHeist }: HeistEditorProps = {}) {
  const { user, gamertag, isAdmin } = useAuth();

  // Safely access editHeist fields — Firestore doc may have partial data
  const eh = editHeist;

  // Identity
  const [title, setTitle] = useState(eh?.title ?? "");
  const [briefing, setBriefing] = useState(eh?.briefing ?? "");
  const [setting, setSetting] = useState<FyveHeistSetting>(eh?.setting ?? { location: "", era: "", atmosphere: "" });
  const [bgUrl, setBgUrl] = useState(eh?.backgroundImageUrl ?? "");
  const [targetUrl, setTargetUrl] = useState(eh?.targetObjectImageUrl ?? "");

  // Assets (5) — ensure bomb fields have defaults for heists created before per-element bombs
  const [assets, setAssets] = useState<FyveAsset[]>(() =>
    eh?.assets?.length
      ? eh.assets.slice(0, 5).map((a) => ({
          ...a,
          bombDescription: a.bombDescription ?? "",
          bombImageUrl: a.bombImageUrl ?? "",
          bombSoundEffect: a.bombSoundEffect ?? "",
        }))
      : Array.from({ length: 5 }, emptyAsset),
  );

  // Civilians (5)
  const [civilians, setCivilians] = useState<FyveCivilian[]>(() =>
    eh?.civilians?.length ? eh.civilians : Array.from({ length: 5 }, emptyCivilian),
  );

  // Per-element bomb picker modal: which asset index is selecting a bomb entity
  const [soundUploadForElement, setSoundUploadForElement] = useState<number | null>(null);

  // Win message (shown on victory screen)
  const [winMessage, setWinMessage] = useState(eh?.winMessage ?? "");

  // Heist ID for storage uploads — use existing doc ID when editing
  const [tempHeistId] = useState(() => eh?.id ?? `heist_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

  // Words
  const [words, setWords] = useState<FyveWordPool>(eh?.words ?? { tier1: [], tier2: [], tier3: [] });
  const [wordInput, setWordInput] = useState({ tier1: "", tier2: "", tier3: "" });
  const [dupeWords, setDupeWords] = useState<Set<string>>(new Set());
  const [dupeCheckResult, setDupeCheckResult] = useState<{ count: number } | null>(null);

  // Visibility
  const [visibility, setVisibility] = useState<"official" | "private" | "shared">(
    eh?.visibility ?? (isAdmin ? "official" : "private"),
  );

  // Publishing status
  const [isDraft, setIsDraft] = useState<boolean>(eh?.draft ?? true);

  // Image modal state
  const [imageModal, setImageModal] = useState<
    | { type: "asset" | "civilian" | "bomb"; index: number }
    | { type: "background" | "target-object" }
    | null
  >(null);

  // Persisted doc ID — pre-set when editing an existing heist
  const [savedHeistId, setSavedHeistId] = useState<string | null>(editHeist?.id ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [tierInfoOpen, setTierInfoOpen] = useState<"tier1" | "tier2" | "tier3" | null>(null);

  // ─── Autosave (via shared hook) ───────────────────────────

  const { triggerAutosave, saveFnRef, savedFlash, flashSaved } = useAutosave();

  // ─── Word pool management ─────────────────────────────────

  const addWord = useCallback((tier: "tier1" | "tier2" | "tier3") => {
    const word = wordInput[tier].trim().toUpperCase();
    if (!word) return;
    if (words[tier].includes(word)) return;
    setWords((prev) => ({ ...prev, [tier]: [...prev[tier], word] }));
    setWordInput((prev) => ({ ...prev, [tier]: "" }));
    triggerAutosave();
  }, [wordInput, words, triggerAutosave]);

  const removeWord = useCallback((tier: "tier1" | "tier2" | "tier3", word: string) => {
    setWords((prev) => ({ ...prev, [tier]: prev[tier].filter((w) => w !== word) }));
    triggerAutosave();
  }, [triggerAutosave]);

  // ─── JSON Prefill ─────────────────────────────────────────

  const jsonRef = useRef<HTMLTextAreaElement>(null);

  /** Normalize JS object literal text into parseable JSON */
  const normalizeToJson = (text: string): string => {
    let s = text.trim();
    // Strip leading variable assignment (const x = {...} or let/var)
    s = s.replace(/^(?:const|let|var)\s+\w+\s*=\s*/, "");
    // Strip trailing semicolons
    s = s.replace(/;\s*$/, "");
    // Quote unquoted keys: word at start of line or after { or , followed by :
    s = s.replace(/(?<=[{,]\s*)(\w+)\s*:/g, '"$1":');
    // Handle first key if object starts with {
    s = s.replace(/^\{\s*(\w+)\s*:/, '{"$1":');
    // Remove trailing commas before } or ]
    s = s.replace(/,\s*([}\]])/g, "$1");
    return s;
  };

  const handleJsonPrefill = useCallback((text: string) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        data = JSON.parse(normalizeToJson(text));
      }
      if (data.title) setTitle(data.title);
      if (data.briefing) setBriefing(data.briefing);
      if (data.setting) setSetting({
        location: data.setting?.location ?? "",
        era: data.setting?.era ?? "",
        atmosphere: data.setting?.atmosphere ?? "",
      });
      if (data.winMessage) setWinMessage(data.winMessage);
      if (data.assets) {
        setAssets(data.assets.map((a: Record<string, unknown>, i: number) => ({
          id: `asset-${i}`,
          name: HEIST_ELEMENT_LABELS[i] ?? "",
          description: (a["description"] as string) ?? "",
          imageUrl: "",            // images always blank — uploaded separately
          bombDescription: (a["bombDescription"] as string) ?? "",
          bombImageUrl: "",        // uploaded separately
          bombSoundEffect: "",     // selected separately
        })));
      }
      if (data.civilians) {
        setCivilians(data.civilians.map((c: Record<string, unknown>, i: number) => ({
          id: `civ-${i}`,
          name: `Civilian ${i + 1}`,
          description: (c["description"] as string) ?? "",
          imageUrl: "",            // uploaded separately
        })));
      }
      if (data.words) setWords({
        tier1: Array.isArray(data.words.tier1) ? data.words.tier1 : [],
        tier2: Array.isArray(data.words.tier2) ? data.words.tier2 : [],
        tier3: Array.isArray(data.words.tier3) ? data.words.tier3 : [],
      });
      setError(null);
      triggerAutosave();
    } catch {
      setError("Invalid JSON — check formatting");
    }
  }, [triggerAutosave]);

  const downloadSampleJson = useCallback(() => {
    const sample = {
      title: "Put heist title here",
      briefing: "Put heist briefing/description here",
      setting: {
        location: "Location here (e.g. Monte Carlo Casino)",
        era: "Time period here (e.g. 1960s)",
        atmosphere: "Atmosphere description here (e.g. glamorous, tense)",
      },
      winMessage: "Victory message shown when a team collects all 5 elements and secures the target",
      _assetsNote: "Exactly 5 assets required — one per heist element: 1. Intel, 2. Insider, 3. Distract, 4. Escape, 5. Payday. Each asset has a description and a bombDescription for what goes wrong if that element fails. Images and sounds are uploaded separately in the editor.",
      assets: [
        { _element: "Intel", description: "What this intel source is", bombDescription: "What goes wrong — e.g. intercepted communications" },
        { _element: "Insider", description: "Who the inside contact is", bombDescription: "What goes wrong — e.g. the mole is discovered" },
        { _element: "Distract", description: "What the diversion is", bombDescription: "What goes wrong — e.g. distraction backfires" },
        { _element: "Escape", description: "How the team gets out", bombDescription: "What goes wrong — e.g. exit is blocked" },
        { _element: "Payday", description: "The final prize", bombDescription: "What goes wrong — e.g. the vault is empty" },
      ],
      _civiliansNote: "Exactly 5 civilians required — innocent bystanders on the board. Guessing a civilian wastes a turn. Images are uploaded separately in the editor.",
      civilians: [
        { _label: "Civilian-1", description: "Who this bystander is" },
        { _label: "Civilian-2", description: "Who this bystander is" },
        { _label: "Civilian-3", description: "Who this bystander is" },
        { _label: "Civilian-4", description: "Who this bystander is" },
        { _label: "Civilian-5", description: "Who this bystander is" },
      ],
      _wordNote: "These lists are combined and used randomly in-game. They are separate here only to make it easier to create excellent heists.",
      words: {
        "_tier1_info": "Deep Theme — Words that are mission-specific (e.g. 'Vault' for a bank heist, 'Gravity' for a space heist)",
        tier1: ["THEME_WORD_1", "THEME_WORD_2", "THEME_WORD_3", "THEME_WORD_4", "THEME_WORD_5", "THEME_WORD_6", "THEME_WORD_7", "THEME_WORD_8", "THEME_WORD_9", "THEME_WORD_10"],
        "_tier2_info": "Dangerous Doubles — Words that fit the theme but mean more than one thing (e.g. 'Charge' for an explosive heist, 'Fathom' for a deep sea heist)",
        tier2: ["DOUBLE_WORD_1", "DOUBLE_WORD_2", "DOUBLE_WORD_3", "DOUBLE_WORD_4", "DOUBLE_WORD_5", "DOUBLE_WORD_6", "DOUBLE_WORD_7", "DOUBLE_WORD_8", "DOUBLE_WORD_9", "DOUBLE_WORD_10"],
        "_tier3_info": "Trojans — Words unrelated to the heist that make life hard for Bosses (e.g. 'Tuesday', 'Elbow', 'Nucleus')",
        tier3: ["TROJAN_WORD_1", "TROJAN_WORD_2", "TROJAN_WORD_3", "TROJAN_WORD_4", "TROJAN_WORD_5", "TROJAN_WORD_6", "TROJAN_WORD_7", "TROJAN_WORD_8", "TROJAN_WORD_9", "TROJAN_WORD_10"],
      },
    };
    const blob = new Blob([JSON.stringify(sample, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fyve-heist-sample.json";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // ─── Build input from current state ────────────────────────

  const buildInput = useCallback((): CreateHeistInput => ({
    title: title.trim() || "Untitled Heist",
    briefing: briefing.trim(),
    backgroundImageUrl: bgUrl,
    targetObjectImageUrl: targetUrl,
    setting,
    assets,
    civilians,
    winMessage: winMessage.trim(),
    words,
    visibility,
  }), [title, briefing, bgUrl, targetUrl, setting, assets, civilians, winMessage, words, visibility]);

  // ─── Autosave: keep ref current ────────────────────────────

  const performAutosave = useCallback(async () => {
    if (!user || !gamertag) return;
    try {
      const input = buildInput();
      if (savedHeistId) {
        await updateHeist(savedHeistId, { ...input, draft: isDraft });
      } else {
        const heist = await createHeist({ ...input }, user.uid, gamertag);
        await updateHeist(heist.id, { draft: isDraft });
        setSavedHeistId(heist.id);
      }
      flashSaved();
    } catch {
      // Autosave failures are silent
    }
  }, [user, gamertag, buildInput, savedHeistId, isDraft, flashSaved]);

  saveFnRef.current = performAutosave;

  // ─── Save Heist (single unified save) ─────────────────────

  const handleSave = useCallback(async () => {
    if (!user || !gamertag) return;
    if (!title.trim()) { setError("Title is required"); return; }

    // Only validate completeness when publishing
    if (!isDraft) {
      const totalWords = words.tier1.length + words.tier2.length + words.tier3.length;
      if (totalWords < 16) { setError(`Need at least 16 words (have ${totalWords})`); return; }
      if (assets.some((a) => !a.description.trim())) { setError("All 5 assets need descriptions"); return; }
      if (civilians.some((c) => !c.description.trim())) { setError("All 5 civilians need descriptions"); return; }
    }

    setSaving(true);
    setError(null);

    try {
      const input = buildInput();
      if (savedHeistId) {
        await updateHeist(savedHeistId, { ...input, draft: isDraft });
      } else {
        const heist = await createHeist(input, user.uid, gamertag);
        await updateHeist(heist.id, { draft: isDraft });
        setSavedHeistId(heist.id);
      }
      flashSaved();
    } catch (err) {
      setError(`Failed to save: ${err}`);
    } finally {
      setSaving(false);
    }
  }, [user, gamertag, title, buildInput, assets, civilians, words, isDraft, savedHeistId, flashSaved]);

  if (success) {
    return (
      <div className="text-center">
        <p className="text-lg font-bold text-green-400">Heist Created!</p>
        <button
          className="mt-4 text-sm text-[#E84C1E] hover:underline"
          onClick={() => {
            setSuccess(false);
            setTitle("");
            setBriefing("");
          }}
        >
          Create Another
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-white">
      {/* JSON Prefill — collapsed by default */}
      <details className="group rounded-xl border border-white/10 bg-black/30">
        <summary className="flex cursor-pointer items-center justify-between px-4 py-3">
          <span className="text-xs font-bold uppercase tracking-wider text-white/30">JSON Prefill</span>
          <button
            type="button"
            className="hidden rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/50 transition active:bg-white/20 group-open:inline-block"
            onClick={(e) => { e.preventDefault(); downloadSampleJson(); }}
          >
            Download Sample JSON
          </button>
        </summary>
        <div className="px-4 pb-4">
          <textarea
            ref={jsonRef}
            className="h-20 w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-[#E84C1E]"
            placeholder="Paste heist JSON here..."
          />
          <button
            type="button"
            className="mt-2 w-full rounded-lg bg-[#E84C1E]/20 py-2.5 text-sm font-semibold text-[#E84C1E] transition active:bg-[#E84C1E]/30"
            onClick={() => {
              const text = jsonRef.current?.value?.trim();
              if (text) handleJsonPrefill(text);
            }}
          >
            Populate
          </button>
        </div>
      </details>

      {/* ═══ Identity ═══ */}
      <section className="space-y-3 rounded-xl border border-white/10 bg-black/30 p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#E84C1E]">Heist Identity</h3>
        <input
          className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-[#E84C1E]"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={triggerAutosave}
        />
        <textarea
          className="h-24 w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-[#E84C1E]"
          placeholder="Briefing"
          value={briefing}
          onChange={(e) => setBriefing(e.target.value)}
          onBlur={triggerAutosave}
        />

        {/* Background + Target — tappable image previews */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            className="group relative overflow-hidden rounded-xl border border-white/10 active:opacity-80"
            onClick={() => setImageModal({ type: "background" })}
          >
            {bgUrl ? (
              <div className="aspect-9/16 w-full bg-cover bg-center" style={{ backgroundImage: `url(${bgUrl})` }} />
            ) : (
              <div className="flex aspect-9/16 w-full flex-col items-center justify-center gap-1.5 bg-white/5">
                <ImageIcon size={20} className="text-white/20" />
                <span className="text-xs text-white/20">Background</span>
              </div>
            )}
          </button>
          <button
            type="button"
            className="group relative overflow-hidden rounded-xl border border-white/10 active:opacity-80"
            onClick={() => setImageModal({ type: "target-object" })}
          >
            {targetUrl ? (
              <div className="aspect-square w-full bg-cover bg-center" style={{ backgroundImage: `url(${targetUrl})` }} />
            ) : (
              <div className="flex aspect-square w-full flex-col items-center justify-center gap-1.5 bg-white/5">
                <ImageIcon size={20} className="text-white/20" />
                <span className="text-xs text-white/20">Target Object</span>
              </div>
            )}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <input
            className="rounded-lg border border-white/20 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-[#E84C1E]"
            placeholder="Location"
            value={setting.location}
            onChange={(e) => setSetting((s) => ({ ...s, location: e.target.value }))}
            onBlur={triggerAutosave}
          />
          <input
            className="rounded-lg border border-white/20 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-[#E84C1E]"
            placeholder="Era"
            value={setting.era}
            onChange={(e) => setSetting((s) => ({ ...s, era: e.target.value }))}
            onBlur={triggerAutosave}
          />
        </div>
      </section>

      {/* ═══ Heist Elements (5) ═══ */}
      {assets.map((asset, i) => (
        <section key={asset.id} className="overflow-hidden rounded-xl border border-white/10 bg-black/30">
          {/* Element header bar */}
          <div className="flex items-center gap-2.5 bg-[#E84C1E]/10 px-4 py-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#E84C1E]/30 text-xs font-black text-[#E84C1E]">
              {i + 1}
            </span>
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#E84C1E]">
              {HEIST_ELEMENT_LABELS[i]}
            </h3>
          </div>

          <div className="space-y-3 p-4">
            {/* Asset: image + fields side by side */}
            <div className="flex gap-3">
              <button
                type="button"
                className="shrink-0 overflow-hidden rounded-xl border border-white/10 active:opacity-80"
                onClick={() => setImageModal({ type: "asset", index: i })}
              >
                {asset.imageUrl ? (
                  <div className="h-16 w-16 bg-cover bg-center" style={{ backgroundImage: `url(${asset.imageUrl})` }} />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center bg-white/5">
                    <ImageIcon size={18} className="text-white/20" />
                  </div>
                )}
              </button>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <input
                  className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-white/30"
                  placeholder={`${HEIST_ELEMENT_LABELS[i]} description`}
                  value={asset.description}
                  onChange={(e) => {
                    const next = [...assets];
                    next[i] = { ...next[i]!, description: e.target.value };
                    setAssets(next);
                  }}
                  onBlur={triggerAutosave}
                />
              </div>
            </div>

            {/* Bomb: red-tinted sub-row */}
            <div className="rounded-lg border border-red-600/15 bg-red-950/10 p-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-red-400/60">
                If It Goes Wrong
              </p>
              <div className="flex gap-2.5">
                {/* Bomb image thumbnail */}
                <button
                  type="button"
                  className="shrink-0 overflow-hidden rounded-lg border border-red-600/20 active:opacity-80"
                  onClick={() => setImageModal({ type: "bomb", index: i })}
                >
                  {asset.bombImageUrl ? (
                    <div className="h-12 w-12 bg-cover bg-center" style={{ backgroundImage: `url(${asset.bombImageUrl})` }} />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center bg-red-950/30">
                      <ImageIcon size={14} className="text-red-400/30" />
                    </div>
                  )}
                </button>
                {/* Sound button */}
                <button
                  type="button"
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border transition active:opacity-80 ${
                    asset.bombSoundEffect
                      ? "border-green-600/30 bg-green-950/20"
                      : "border-red-600/20 bg-red-950/30"
                  }`}
                  onClick={() => setSoundUploadForElement(i)}
                >
                  <Volume2
                    size={16}
                    className={asset.bombSoundEffect ? "text-green-400" : "text-white/20"}
                  />
                </button>
                {/* Description */}
                <input
                  className="min-w-0 flex-1 rounded-lg border border-red-600/15 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-red-400/40"
                  placeholder="What went wrong..."
                  value={asset.bombDescription}
                  onChange={(e) => {
                    const next = [...assets];
                    next[i] = { ...next[i]!, bombDescription: e.target.value };
                    setAssets(next);
                  }}
                  onBlur={triggerAutosave}
                />
              </div>
            </div>
          </div>
        </section>
      ))}

      {/* ═══ Civilians (5) ═══ */}
      <section className="overflow-hidden rounded-xl border border-white/10 bg-black/30">
        <div className="bg-gray-500/10 px-4 py-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
            Civilians ({civilians.filter((c) => c.description.trim()).length}/5)
          </h3>
        </div>
        <div className="space-y-3 p-4">
          {civilians.map((civ, i) => (
            <div key={civ.id} className="flex gap-3">
              <button
                type="button"
                className="shrink-0 overflow-hidden rounded-xl border border-white/10 active:opacity-80"
                onClick={() => setImageModal({ type: "civilian", index: i })}
              >
                {civ.imageUrl ? (
                  <div className="h-12 w-12 bg-cover bg-center" style={{ backgroundImage: `url(${civ.imageUrl})` }} />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center bg-white/5">
                    <ImageIcon size={14} className="text-white/20" />
                  </div>
                )}
              </button>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <input
                  className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-white/30"
                  placeholder={`Civilian ${i + 1} description`}
                  value={civ.description}
                  onChange={(e) => {
                    const newCivs = [...civilians];
                    newCivs[i] = { ...newCivs[i]!, description: e.target.value };
                    setCivilians(newCivs);
                  }}
                  onBlur={triggerAutosave}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ The Win ═══ */}
      <section className="overflow-hidden rounded-xl border border-green-600/20 bg-green-950/10">
        <div className="bg-green-600/10 px-4 py-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-green-400">The Win</h3>
        </div>
        <div className="space-y-3 p-4">
          {targetUrl && (
            <div className="mx-auto h-24 w-24 overflow-hidden rounded-xl border-2 border-green-600/30">
              <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${targetUrl})` }} />
            </div>
          )}
          <textarea
            className="h-20 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-green-400"
            placeholder="Win message shown when a team secures the target"
            value={winMessage}
            onChange={(e) => setWinMessage(e.target.value)}
            onBlur={triggerAutosave}
          />
        </div>
      </section>

      {/* ═══ Word Pool ═══ */}
      <section className="overflow-hidden rounded-xl border border-white/10 bg-black/30">
        <div className="bg-white/5 px-4 py-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#E84C1E]">
            Word Pool ({words.tier1.length + words.tier2.length + words.tier3.length}/80)
          </h3>
        </div>
        <div className="space-y-4 p-4">
          <p className="text-sm leading-relaxed text-white/40">
            These lists are combined and used randomly in-game. They are separate here only to make it easier to create excellent heists.
          </p>

          {(["tier1", "tier2", "tier3"] as const).map((tier) => {
            const target = tier === "tier3" ? 20 : 30;
            const label = tier === "tier1" ? "Tier 1 — Deep Theme" : tier === "tier2" ? "Tier 2 — Dangerous Doubles" : "Tier 3 — Trojans";
            const hint = tier === "tier1"
              ? "Words that are mission-specific. Example: \"Vault\" for a bank heist, \"Gravity\" for a space heist."
              : tier === "tier2"
                ? "Words that fit the theme but mean more than one thing. Example: \"Charge\" for an explosive heist, \"Fathom\" for a deep sea heist."
                : "Words unrelated to the heist that make life hard for Bosses. Example: \"Tuesday\", \"Elbow\", \"Nucleus\".";
            const count = words[tier].length;
            const met = count >= target;
            return (
              <div key={tier}>
                <div className="relative mb-2 flex items-center gap-2">
                  <p className="text-sm font-medium text-white/50">
                    {label} (~{target}){" "}
                    <span className={met ? "text-green-400" : "text-red-400"}>({count})</span>
                  </p>
                  <button
                    type="button"
                    className="rounded-full bg-white/10 p-1.5 text-white/60 active:bg-white/20"
                    onClick={() => setTierInfoOpen(tierInfoOpen === tier ? null : tier)}
                  >
                    <Info size={16} />
                  </button>
                  {tierInfoOpen === tier && (
                    <div className="absolute left-0 top-full z-10 mt-1 rounded-xl border border-white/15 bg-zinc-900 px-4 py-3 shadow-xl">
                      <p className="max-w-[280px] text-sm leading-relaxed text-white/70">{hint}</p>
                    </div>
                  )}
                </div>
                <div className="mb-2 flex gap-1.5">
                  <input
                    className="min-w-0 flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none"
                    placeholder="Type word and press Enter"
                    value={wordInput[tier]}
                    onChange={(e) => setWordInput((prev) => ({ ...prev, [tier]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addWord(tier); } }}
                  />
                  <button
                    className="rounded-lg bg-[#E84C1E]/20 px-4 py-2.5 text-sm font-semibold text-[#E84C1E] active:bg-[#E84C1E]/30"
                    onClick={() => addWord(tier)}
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {words[tier].map((w) => {
                    const isDupe = dupeWords.has(w.toUpperCase());
                    return (
                      <span
                        key={w}
                        className={`cursor-pointer rounded-full px-3 py-1.5 text-sm active:line-through ${
                          isDupe
                            ? "bg-red-900/60 text-red-400"
                            : "bg-white/10 text-white active:bg-red-500/20"
                        }`}
                        onClick={() => removeWord(tier, w)}
                      >
                        {w}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <div className="flex items-center gap-3">
            <button
              className="rounded-lg bg-[#E84C1E]/20 px-4 py-2.5 text-sm font-semibold text-[#E84C1E] active:bg-[#E84C1E]/30"
              onClick={() => {
                const allWords = [...words.tier1, ...words.tier2, ...words.tier3];
                const seen = new Map<string, number>();
                const dupes = new Set<string>();
                for (const w of allWords) {
                  const upper = w.toUpperCase();
                  seen.set(upper, (seen.get(upper) ?? 0) + 1);
                }
                for (const [upper, count] of seen) {
                  if (count > 1) dupes.add(upper);
                }
                setDupeWords(dupes);
                setDupeCheckResult({ count: dupes.size });
              }}
            >
              Check Dupes
            </button>
            {dupeCheckResult != null && (
              <span className={`text-sm font-semibold ${dupeCheckResult.count === 0 ? "text-green-400" : "text-red-400"}`}>
                {dupeCheckResult.count === 0 ? "All unique" : `${dupeCheckResult.count} dupes`}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* ═══ Visibility ═══ */}
      <section className="rounded-xl border border-white/10 bg-black/30 p-4">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#E84C1E]">Visibility</h3>
        <div className="flex gap-2">
          {(["private", "shared", ...(isAdmin ? ["official" as const] : [])] as const).map((v) => (
            <button
              key={v}
              className={`rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                visibility === v
                  ? "bg-[#E84C1E] text-white"
                  : "bg-white/10 text-white/60 active:bg-white/20"
              }`}
              onClick={() => { setVisibility(v); triggerAutosave(); }}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </section>

      {/* ═══ Publishing ═══ */}
      <section className="rounded-xl border border-white/10 bg-black/30 p-4">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#E84C1E]">Publishing</h3>
        <div className="flex gap-4">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="publishStatus"
              checked={isDraft}
              onChange={() => setIsDraft(true)}
              className="h-4 w-4 accent-[#E84C1E]"
            />
            <span className={`text-sm font-semibold ${isDraft ? "text-yellow-400" : "text-white/50"}`}>
              Draft
            </span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="publishStatus"
              checked={!isDraft}
              onChange={() => setIsDraft(false)}
              className="h-4 w-4 accent-[#E84C1E]"
            />
            <span className={`text-sm font-semibold ${!isDraft ? "text-green-400" : "text-white/50"}`}>
              Published
            </span>
          </label>
        </div>
      </section>

      {/* Error */}
      {error && (
        <p className="text-center text-sm text-red-400">{error}</p>
      )}

      {/* ═══ Save button — sticky at bottom ═══ */}
      <div className="sticky bottom-0 -mx-4 border-t border-white/10 bg-black/90 px-4 py-3 backdrop-blur-sm">
        <GamePrimaryButton onClick={handleSave} loading={saving} disabled={saving}>
          Save Heist
        </GamePrimaryButton>
        {savedFlash && <SavedFlash time={savedFlash} />}
      </div>

      {/* Image modal for background / target / assets / civilians / bombs */}
      {imageModal && (() => {
        if (imageModal.type === "background") {
          return (
            <HeistImageModal
              label="Background Image"
              currentUrl={bgUrl}
              storageType="background"
              heistId={tempHeistId}
              aiAspectRatio="9x16"
              onSave={(url) => { setBgUrl(url); triggerAutosave(); }}
              onClose={() => setImageModal(null)}
            />
          );
        }
        if (imageModal.type === "target-object") {
          return (
            <HeistImageModal
              label="Target Object"
              currentUrl={targetUrl}
              storageType="target-object"
              heistId={tempHeistId}
              onSave={(url) => { setTargetUrl(url); triggerAutosave(); }}
              onClose={() => setImageModal(null)}
            />
          );
        }
        // Narrowed: must be asset, civilian, or bomb with index
        const indexed = imageModal as { type: "asset" | "civilian" | "bomb"; index: number };
        if (indexed.type === "bomb") {
          const asset = assets[indexed.index];
          if (!asset) return null;
          return (
            <HeistImageModal
              label={`${HEIST_ELEMENT_LABELS[indexed.index]} — Bomb Image`}
              currentUrl={asset.bombImageUrl}
              storageType="bomb"
              index={indexed.index}
              heistId={tempHeistId}
              onSave={(url) => {
                const next = [...assets];
                next[indexed.index] = { ...next[indexed.index]!, bombImageUrl: url };
                setAssets(next);
                triggerAutosave();
              }}
              onClose={() => setImageModal(null)}
            />
          );
        }
        const isAsset = indexed.type === "asset";
        const item = isAsset ? assets[indexed.index] : civilians[indexed.index];
        if (!item) return null;
        const modalLabel = isAsset
          ? HEIST_ELEMENT_LABELS[indexed.index] ?? `Asset ${indexed.index + 1}`
          : `Civilian ${indexed.index + 1}`;
        return (
          <HeistImageModal
            label={modalLabel}
            currentUrl={item.imageUrl}
            storageType={indexed.type}
            index={indexed.index}
            heistId={tempHeistId}
            onSave={(url) => {
              if (isAsset) {
                const next = [...assets];
                next[indexed.index] = { ...next[indexed.index]!, imageUrl: url };
                setAssets(next);
              } else {
                const next = [...civilians];
                next[indexed.index] = { ...next[indexed.index]!, imageUrl: url };
                setCivilians(next);
              }
              triggerAutosave();
            }}
            onClose={() => setImageModal(null)}
          />
        );
      })()}

      {/* Per-element sound upload modal */}
      {soundUploadForElement != null && createPortal(
        <div className="fixed inset-0 z-60 flex items-center justify-center">
          <button
            type="button"
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setSoundUploadForElement(null)}
            aria-label="Close"
          />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-red-600/20 bg-neutral-950 p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                {HEIST_ELEMENT_LABELS[soundUploadForElement]} — Sound Effect
              </h3>
              <JMCloseCircleButton onClick={() => setSoundUploadForElement(null)} />
            </div>
            <p className="mb-4 text-sm text-white/50">
              Upload a sound effect for when this element fails.
            </p>
            <JMAudioUpload
              value={assets[soundUploadForElement]?.bombSoundEffect || ""}
              onChange={(url) => {
                const idx = soundUploadForElement;
                const next = [...assets];
                next[idx] = { ...next[idx]!, bombSoundEffect: url ?? "" };
                setAssets(next);
                triggerAutosave();
              }}
              onUpload={async (file) => {
                const heistId = savedHeistId ?? "draft";
                return uploadFyveAudio(heistId, soundUploadForElement, file);
              }}
              maxSizeMB={5}
            />
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
