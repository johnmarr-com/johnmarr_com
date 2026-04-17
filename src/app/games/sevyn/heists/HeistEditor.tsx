"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { useAuth } from "@/lib/AuthProvider";
import { createHeist, updateHeist, type CreateHeistInput } from "@/lib/sevyn-heists";
import type {
  SevynAsset,
  SevynCivilian,
  SevynBomb,
  SevynBombEntity,
  SevynHeist,
  SevynHeistSetting,
  SevynWordPool,
} from "../sevynTypes";
import { GamePrimaryButton, useAutosave, SavedFlash } from "@/app/games/_gamecore";
import BombPicker from "./BombPicker";
import HeistImageModal from "./HeistImageModal";

// ─── Default empty state ────────────────────────────────────

const emptyAsset = (): SevynAsset => ({
  id: `asset_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  name: "",
  description: "",
  imageUrl: "",
});

const emptyCivilian = (): SevynCivilian => ({
  id: `civ_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  name: "",
  description: "",
  imageUrl: "",
});

interface HeistEditorProps {
  /** Pass an existing heist to edit (e.g. a draft). Omit for new heist. */
  editHeist?: SevynHeist;
}

export default function HeistEditor({ editHeist }: HeistEditorProps = {}) {
  const { user, gamertag, isAdmin } = useAuth();

  // Safely access editHeist fields — Firestore doc may have partial data
  const eh = editHeist;

  // Identity
  const [title, setTitle] = useState(eh?.title ?? "");
  const [briefing, setBriefing] = useState(eh?.briefing ?? "");
  const [setting, setSetting] = useState<SevynHeistSetting>(eh?.setting ?? { location: "", era: "", atmosphere: "" });
  const [bgUrl, setBgUrl] = useState(eh?.backgroundImageUrl ?? "");
  const [targetUrl, setTargetUrl] = useState(eh?.targetObjectImageUrl ?? "");

  // Assets (7)
  const [assets, setAssets] = useState<SevynAsset[]>(() =>
    eh?.assets?.length ? eh.assets : Array.from({ length: 7 }, emptyAsset),
  );

  // Civilians (5)
  const [civilians, setCivilians] = useState<SevynCivilian[]>(() =>
    eh?.civilians?.length ? eh.civilians : Array.from({ length: 5 }, emptyCivilian),
  );

  // Bomb (via BombPicker entity)
  const [selectedBomb, setSelectedBomb] = useState<SevynBombEntity | null>(null);

  // Derived SevynBomb for saving to heist
  const bomb: SevynBomb = useMemo(() => selectedBomb
    ? { name: selectedBomb.name, imageUrl: selectedBomb.imageUrl, soundEffect: selectedBomb.audioUrl }
    : eh?.bomb ?? { name: "THE BOMB", imageUrl: "", soundEffect: "" },
  [selectedBomb, eh?.bomb]);

  // Bomb description lives on the heist, not the bomb entity
  const [bombDescription, setBombDescription] = useState(eh?.bombDescription ?? "");

  // Heist ID for storage uploads — use existing doc ID when editing
  const [tempHeistId] = useState(() => eh?.id ?? `heist_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

  // Words
  const [words, setWords] = useState<SevynWordPool>(eh?.words ?? { tier1: [], tier2: [], tier3: [] });
  const [wordInput, setWordInput] = useState({ tier1: "", tier2: "", tier3: "" });
  const [dupeWords, setDupeWords] = useState<Set<string>>(new Set());
  const [dupeCheckResult, setDupeCheckResult] = useState<{ count: number } | null>(null);

  // Visibility
  const [visibility, setVisibility] = useState<"official" | "private" | "shared">(
    eh?.visibility ?? (isAdmin ? "official" : "private"),
  );

  // Image modal state
  const [imageModal, setImageModal] = useState<
    | { type: "asset" | "civilian"; index: number }
    | { type: "background" | "target-object" }
    | null
  >(null);

  // Persisted doc ID — pre-set when editing an existing heist
  const [savedHeistId, setSavedHeistId] = useState<string | null>(editHeist?.id ?? null);
  const [saving, setSaving] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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
      if (data.setting) setSetting(data.setting);
      if (data.assets) {
        setAssets(data.assets.map((a: SevynAsset) => ({
          ...a,
          imageUrl: a.imageUrl || "",
        })));
      }
      if (data.civilians) {
        setCivilians(data.civilians.map((c: SevynCivilian) => ({
          ...c,
          imageUrl: c.imageUrl || "",
        })));
      }
      // bomb is now selected via BombPicker, skip inline bomb from JSON
      if (data.words) setWords(data.words);
      setError(null);
      triggerAutosave();
    } catch {
      setError("Invalid JSON — check formatting");
    }
  }, [triggerAutosave]);

  // ─── Build input from current state ────────────────────────

  const buildInput = useCallback((): CreateHeistInput => ({
    title: title.trim() || "Untitled Heist",
    briefing: briefing.trim(),
    backgroundImageUrl: bgUrl,
    targetObjectImageUrl: targetUrl,
    setting,
    assets,
    civilians,
    bomb,
    bombDescription: bombDescription.trim(),
    words,
    visibility,
  }), [title, briefing, bgUrl, targetUrl, setting, assets, civilians, bomb, bombDescription, words, visibility]);

  // ─── Autosave: keep ref current ────────────────────────────

  const performAutosave = useCallback(async () => {
    if (!user || !gamertag) return;
    try {
      const input = buildInput();
      if (savedHeistId) {
        await updateHeist(savedHeistId, { ...input, draft: true });
      } else {
        const heist = await createHeist({ ...input }, user.uid, gamertag);
        await updateHeist(heist.id, { draft: true });
        setSavedHeistId(heist.id);
      }
      flashSaved();
    } catch {
      // Autosave failures are silent
    }
  }, [user, gamertag, buildInput, savedHeistId, flashSaved]);

  saveFnRef.current = performAutosave;

  // ─── Save Draft (no validation) ──────────────────────────

  const handleSaveDraft = useCallback(async () => {
    if (!user || !gamertag) return;
    setSavingDraft(true);
    setError(null);

    try {
      const input = buildInput();
      if (savedHeistId) {
        await updateHeist(savedHeistId, { ...input, draft: true });
      } else {
        const heist = await createHeist({ ...input }, user.uid, gamertag);
        // Mark as draft via update (createHeist doesn't accept draft field)
        await updateHeist(heist.id, { draft: true });
        setSavedHeistId(heist.id);
      }
      flashSaved();
    } catch (err) {
      setError(`Draft save failed: ${err}`);
    } finally {
      setSavingDraft(false);
    }
  }, [user, gamertag, buildInput, savedHeistId, flashSaved]);

  // ─── Publish (full validation) ────────────────────────────

  const handleSave = useCallback(async () => {
    if (!user || !gamertag) return;
    if (!title.trim()) { setError("Title is required"); return; }

    const totalWords = words.tier1.length + words.tier2.length + words.tier3.length;
    if (totalWords < 30) { setError(`Need at least 30 words (have ${totalWords})`); return; }

    if (assets.some((a) => !a.name.trim())) { setError("All 7 assets need names"); return; }
    if (civilians.some((c) => !c.name.trim())) { setError("All 5 civilians need names"); return; }

    setSaving(true);
    setError(null);

    try {
      const input = buildInput();
      if (savedHeistId) {
        // Remove draft flag on publish
        await updateHeist(savedHeistId, { ...input, draft: false });
      } else {
        await createHeist(input, user.uid, gamertag);
      }
      setSuccess(true);
    } catch (err) {
      setError(`Failed to save: ${err}`);
    } finally {
      setSaving(false);
    }
  }, [user, gamertag, title, buildInput, assets, civilians, words, savedHeistId]);

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
    <div className="space-y-6 text-white">
      {/* JSON Prefill */}
      <section className="rounded-xl border border-white/10 bg-black/30 p-4">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-[#E84C1E]">JSON Prefill (Optional)</h3>
        <textarea
          ref={jsonRef}
          className="h-20 w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs text-white placeholder-white/30 outline-none focus:border-[#E84C1E]"
          placeholder="Paste mission JSON or JS object here..."
        />
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            className="rounded-lg bg-[#E84C1E]/20 px-3 py-1 text-xs font-semibold text-[#E84C1E] transition hover:bg-[#E84C1E]/30"
            onClick={() => {
              const text = jsonRef.current?.value?.trim();
              if (text) handleJsonPrefill(text);
            }}
          >
            Populate
          </button>
        </div>
      </section>

      {/* Identity */}
      <section className="rounded-xl border border-white/10 bg-black/30 p-4">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#E84C1E]">Heist Identity</h3>
        <input
          className="mb-2 w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-[#E84C1E]"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={triggerAutosave}
        />
        <textarea
          className="mb-2 h-24 w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-[#E84C1E]"
          placeholder="Briefing"
          value={briefing}
          onChange={(e) => setBriefing(e.target.value)}
          onBlur={triggerAutosave}
        />
        <div className="mb-3 grid grid-cols-2 gap-3">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-xs font-medium text-white/50">Background Image</p>
              <button
                type="button"
                className={`rounded-md px-2 py-0.5 text-xs font-semibold transition ${
                  bgUrl
                    ? "bg-green-500/20 text-green-400"
                    : "bg-[#E84C1E]/20 text-[#E84C1E] hover:bg-[#E84C1E]/30"
                }`}
                onClick={() => setImageModal({ type: "background" })}
              >
                {bgUrl ? "✓ Change" : "AI / Upload"}
              </button>
            </div>
            {bgUrl ? (
              <div
                className="h-28 w-full rounded-lg bg-cover bg-center"
                style={{ backgroundImage: `url(${bgUrl})` }}
              />
            ) : (
              <div className="flex h-28 w-full items-center justify-center rounded-lg border border-dashed border-white/15 text-xs text-white/20">
                1080 × 1920
              </div>
            )}
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-xs font-medium text-white/50">Target Object</p>
              <button
                type="button"
                className={`rounded-md px-2 py-0.5 text-xs font-semibold transition ${
                  targetUrl
                    ? "bg-green-500/20 text-green-400"
                    : "bg-[#E84C1E]/20 text-[#E84C1E] hover:bg-[#E84C1E]/30"
                }`}
                onClick={() => setImageModal({ type: "target-object" })}
              >
                {targetUrl ? "✓ Change" : "AI / Upload"}
              </button>
            </div>
            {targetUrl ? (
              <div
                className="mx-auto h-28 w-28 rounded-lg bg-cover bg-center"
                style={{ backgroundImage: `url(${targetUrl})` }}
              />
            ) : (
              <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-lg border border-dashed border-white/15 text-xs text-white/20">
                Square
              </div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input
            className="rounded-lg border border-white/20 bg-white/5 px-2 py-1.5 text-xs text-white placeholder-white/30 outline-none focus:border-[#E84C1E]"
            placeholder="Location"
            value={setting.location}
            onChange={(e) => setSetting((s) => ({ ...s, location: e.target.value }))}
            onBlur={triggerAutosave}
          />
          <input
            className="rounded-lg border border-white/20 bg-white/5 px-2 py-1.5 text-xs text-white placeholder-white/30 outline-none focus:border-[#E84C1E]"
            placeholder="Era"
            value={setting.era}
            onChange={(e) => setSetting((s) => ({ ...s, era: e.target.value }))}
            onBlur={triggerAutosave}
          />
        </div>
      </section>

      {/* Assets (7) */}
      <section className="rounded-xl border border-white/10 bg-black/30 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#E84C1E]">
            Assets ({assets.filter((a) => a.name.trim()).length}/7)
          </h3>
          <span className="text-xs font-bold text-[#E84C1E]/60">Img</span>
        </div>
        <div className="space-y-2">
          {assets.map((asset, i) => (
            <div key={asset.id} className="flex gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E84C1E]/20 text-xs font-bold text-[#E84C1E]">
                {i + 1}
              </span>
              <input
                className="flex-1 rounded-lg border border-white/20 bg-white/5 px-2 py-1.5 text-xs text-white placeholder-white/30 outline-none"
                placeholder={`Asset ${i + 1} name`}
                value={asset.name}
                onChange={(e) => {
                  const newAssets = [...assets];
                  newAssets[i] = { ...newAssets[i]!, name: e.target.value };
                  setAssets(newAssets);
                }}
                onBlur={triggerAutosave}
              />
              <input
                className="flex-2 rounded-lg border border-white/20 bg-white/5 px-2 py-1.5 text-xs text-white placeholder-white/30 outline-none"
                placeholder="Description"
                value={asset.description}
                onChange={(e) => {
                  const newAssets = [...assets];
                  newAssets[i] = { ...newAssets[i]!, description: e.target.value };
                  setAssets(newAssets);
                }}
                onBlur={triggerAutosave}
              />
              <button
                type="button"
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition ${
                  asset.imageUrl
                    ? "bg-green-500/20 text-green-400"
                    : "bg-white/5 text-white/30 hover:bg-white/10 hover:text-white/50"
                }`}
                title={asset.imageUrl ? "Image set — tap to change" : "Add image"}
                onClick={() => setImageModal({ type: "asset", index: i })}
              >
                {asset.imageUrl ? "✓" : "🖼"}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Civilians (5) */}
      <section className="rounded-xl border border-white/10 bg-black/30 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#E84C1E]">
            Civilians ({civilians.filter((c) => c.name.trim()).length}/5)
          </h3>
          <span className="text-xs font-bold text-[#E84C1E]/60">Img</span>
        </div>
        <div className="space-y-2">
          {civilians.map((civ, i) => (
            <div key={civ.id} className="flex gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-500/20 text-xs font-bold text-gray-400">
                {i + 1}
              </span>
              <input
                className="flex-1 rounded-lg border border-white/20 bg-white/5 px-2 py-1.5 text-xs text-white placeholder-white/30 outline-none"
                placeholder={`Civilian ${i + 1} name (e.g. THE CHAPLAIN)`}
                value={civ.name}
                onChange={(e) => {
                  const newCivs = [...civilians];
                  newCivs[i] = { ...newCivs[i]!, name: e.target.value };
                  setCivilians(newCivs);
                }}
                onBlur={triggerAutosave}
              />
              <input
                className="flex-2 rounded-lg border border-white/20 bg-white/5 px-2 py-1.5 text-xs text-white placeholder-white/30 outline-none"
                placeholder="Description"
                value={civ.description}
                onChange={(e) => {
                  const newCivs = [...civilians];
                  newCivs[i] = { ...newCivs[i]!, description: e.target.value };
                  setCivilians(newCivs);
                }}
                onBlur={triggerAutosave}
              />
              <button
                type="button"
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition ${
                  civ.imageUrl
                    ? "bg-green-500/20 text-green-400"
                    : "bg-white/5 text-white/30 hover:bg-white/10 hover:text-white/50"
                }`}
                title={civ.imageUrl ? "Image set — tap to change" : "Add image"}
                onClick={() => setImageModal({ type: "civilian", index: i })}
              >
                {civ.imageUrl ? "✓" : "🖼"}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Bomb (pick existing or create new) */}
      <section className="rounded-xl border border-red-600/20 bg-red-950/20 p-4">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-red-400">The Bomb</h3>
        <BombPicker
          selectedBombId={selectedBomb?.id ?? null}
          onSelect={(b) => { setSelectedBomb(b); triggerAutosave(); }}
        />
        <textarea
          className="mt-3 h-16 w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-red-400"
          placeholder="Bomb description for this heist (shown on reveal)"
          value={bombDescription}
          onChange={(e) => setBombDescription(e.target.value)}
          onBlur={triggerAutosave}
        />
      </section>

      {/* Word Pool */}
      <section className="rounded-xl border border-white/10 bg-black/30 p-4">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#E84C1E]">
          Word Pool ({words.tier1.length + words.tier2.length + words.tier3.length}/80)
        </h3>
        {(["tier1", "tier2", "tier3"] as const).map((tier) => {
          const target = tier === "tier3" ? 20 : 30;
          const label = tier === "tier1" ? "Tier 1 — Deep Theme" : tier === "tier2" ? "Tier 2 — Double Meanings" : "Tier 3 — Trojan Words";
          const count = words[tier].length;
          const met = count >= target;
          return (
          <div key={tier} className="mb-3">
            <p className="mb-1 text-xs text-white/50">
              {label} (~{target}){" "}
              <span className={met ? "text-green-400" : "text-red-400"}>({count})</span>
            </p>
            <div className="mb-1 flex gap-1">
              <input
                className="flex-1 rounded-lg border border-white/20 bg-white/5 px-2 py-1.5 text-xs text-white placeholder-white/30 outline-none"
                placeholder="Type word and press Enter"
                value={wordInput[tier]}
                onChange={(e) => setWordInput((prev) => ({ ...prev, [tier]: e.target.value }))}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addWord(tier); } }}
              />
              <button
                className="rounded-lg bg-[#E84C1E]/20 px-3 text-xs text-[#E84C1E] hover:bg-[#E84C1E]/30"
                onClick={() => addWord(tier)}
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {words[tier].map((w) => {
                const isDupe = dupeWords.has(w.toUpperCase());
                return (
                  <span
                    key={w}
                    className={`cursor-pointer rounded-full px-2 py-0.5 text-xs hover:line-through ${
                      isDupe
                        ? "bg-red-900/60 text-red-400 hover:bg-red-800/60"
                        : "bg-white/10 text-white hover:bg-red-500/20"
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
        <div className="mt-2 flex items-center gap-3">
          <button
            className="rounded-lg bg-[#E84C1E]/20 px-4 py-1.5 text-xs font-semibold text-[#E84C1E] hover:bg-[#E84C1E]/30"
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
            Confirm Unique Words
          </button>
          {dupeCheckResult != null && (
            <span className={`text-xs font-semibold ${dupeCheckResult.count === 0 ? "text-green-400" : "text-red-400"}`}>
              {dupeCheckResult.count === 0 ? "No dupes" : `${dupeCheckResult.count} dupes`}
            </span>
          )}
        </div>
      </section>

      {/* Visibility */}
      <section className="rounded-xl border border-white/10 bg-black/30 p-4">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#E84C1E]">Visibility</h3>
        <div className="flex gap-2">
          {(["private", "shared", ...(isAdmin ? ["official" as const] : [])] as const).map((v) => (
            <button
              key={v}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                visibility === v
                  ? "bg-[#E84C1E] text-white"
                  : "bg-white/10 text-white/60 hover:bg-white/20"
              }`}
              onClick={() => { setVisibility(v); triggerAutosave(); }}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </section>

      {/* Error */}
      {error && (
        <p className="text-center text-sm text-red-400">{error}</p>
      )}

      {/* Save buttons */}
      <div className="flex gap-3">
        <button
          type="button"
          className="flex-1 rounded-xl border border-white/15 bg-white/5 py-3 text-sm font-bold text-white/70 transition hover:bg-white/10 disabled:opacity-40"
          disabled={savingDraft}
          onClick={handleSaveDraft}
        >
          {savingDraft ? "Saving..." : "Save Draft"}
        </button>
        <div className="flex-1">
          <GamePrimaryButton onClick={handleSave} loading={saving} disabled={saving}>
            Publish Heist
          </GamePrimaryButton>
        </div>
      </div>
      {savedFlash && <SavedFlash time={savedFlash} />}

      {/* Image modal for background / target / assets / civilians */}
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
        // Narrowed: must be asset or civilian with index
        const indexed = imageModal as { type: "asset" | "civilian"; index: number };
        const isAsset = indexed.type === "asset";
        const item = isAsset ? assets[indexed.index] : civilians[indexed.index];
        if (!item) return null;
        const modalLabel = isAsset
          ? `Asset ${indexed.index + 1}${item.name ? ` — ${item.name}` : ""}`
          : `Civilian ${indexed.index + 1}${item.name ? ` — ${item.name}` : ""}`;
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
    </div>
  );
}
