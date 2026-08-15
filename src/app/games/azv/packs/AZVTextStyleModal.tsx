"use client";

import { useState, useEffect, useCallback } from "react";
import { AlignLeft, AlignCenter, AlignRight, Loader2, Save } from "lucide-react";
import { JMModal, JMFontSelect } from "@/JMKit";
import { useAuth } from "@/lib/AuthProvider";
import {
  listAZVStyleSets,
  saveAZVStyleSet,
  type AZVStyleSet,
  type AZVTextStyles,
  type AZVTextStyle,
  type AZVTextColor,
  type AZVTextAlign,
  type AZVTextWeight,
} from "@/lib/azv-packs";
import { resolveAZVTextStyle } from "./azvCardSpec";

interface AZVTextStyleModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The card's current styles (sparse — unset fields fall back to defaults). */
  styles: AZVTextStyles;
  /** Fires on every change; caller updates preview live and saves with the card. */
  onChange: (styles: AZVTextStyles) => void;
}

const ROLES: { key: keyof AZVTextStyles; label: string; sample: string }[] = [
  { key: "title", label: "Title", sample: "Card Title" },
  { key: "description", label: "Description", sample: "Description & conditions" },
  { key: "numbers", label: "Numbers", sample: "0 1 2 3 4 5" },
];

const ALIGNS: { value: AZVTextAlign; Icon: typeof AlignLeft }[] = [
  { value: "left", Icon: AlignLeft },
  { value: "center", Icon: AlignCenter },
  { value: "right", Icon: AlignRight },
];

/**
 * Number input that never fights the keyboard: it keeps a local draft string
 * (so "", "-", and mid-edit values are fine — no snap-back while typing) and
 * commits every valid integer, including 0 and negatives.
 */
function NumberField({
  label,
  value,
  onCommit,
  widthClass = "w-20",
}: {
  label: string;
  value: number;
  onCommit: (n: number) => void;
  widthClass?: string;
}) {
  const [draft, setDraft] = useState(String(value));

  // Re-sync when the committed value changes from outside (preset load) —
  // the sanctioned adjust-state-during-render pattern, no effect needed.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    if (parseInt(draft, 10) !== value) setDraft(String(value));
  }

  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-bold uppercase tracking-wider text-white/40">
        {label}
      </label>
      <input
        type="text"
        inputMode="numeric"
        value={draft}
        onChange={(e) => {
          const raw = e.target.value;
          if (!/^-?\d*$/.test(raw)) return;
          setDraft(raw);
          const n = parseInt(raw, 10);
          if (!Number.isNaN(n)) onCommit(n);
        }}
        onBlur={() => setDraft(String(value))}
        className={`${widthClass} rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-lime-400/40`}
      />
    </div>
  );
}

/**
 * AZVTextStyleModal — per-card text styling for the three roles: font, size,
 * weight, black/white color, alignment, and vertical offset. Header manages
 * reusable style sets (presets): name + save, and a dropdown that loads a
 * saved set into the card. Cards only store concrete values — presets are a
 * separate collection.
 */
export default function AZVTextStyleModal({
  isOpen,
  onClose,
  styles,
  onChange,
}: AZVTextStyleModalProps) {
  const { user } = useAuth();

  const [sets, setSets] = useState<AZVStyleSet[]>([]);
  const [setName, setSetName] = useState("");
  const [savingSet, setSavingSet] = useState(false);
  const [selectedSetId, setSelectedSetId] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    void listAZVStyleSets()
      .then((list) => {
        if (!cancelled) setSets(list);
      })
      .catch((err) => console.error("[azv] loading style sets failed:", err));
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const handleSaveSet = useCallback(async () => {
    if (!user || !setName.trim() || savingSet) return;
    setSavingSet(true);
    try {
      const saved = await saveAZVStyleSet(setName, styles, user.uid);
      setSets((prev) => {
        const idx = prev.findIndex((s) => s.id === saved.id);
        const next = idx === -1 ? [...prev, saved] : prev.map((s) => (s.id === saved.id ? saved : s));
        return next.sort((a, b) => a.name.localeCompare(b.name));
      });
      setSelectedSetId(saved.id);
    } catch (err) {
      console.error("[azv] saving style set failed:", err);
    } finally {
      setSavingSet(false);
    }
  }, [user, setName, styles, savingSet]);

  const handleLoadSet = useCallback(
    (setId: string) => {
      setSelectedSetId(setId);
      const set = sets.find((s) => s.id === setId);
      if (!set) return;
      onChange(JSON.parse(JSON.stringify(set.styles)) as AZVTextStyles);
      setSetName(set.name);
    },
    [sets, onChange],
  );

  const patch = (role: keyof AZVTextStyles, part: Partial<AZVTextStyle>) => {
    onChange({ ...styles, [role]: { ...styles[role], ...part } });
  };

  return (
    <JMModal isOpen={isOpen} onClose={onClose} title="Card Text Styles" maxWidthClass="max-w-2xl">
      <div className="space-y-6">
        {/* Style sets — save the current values under a name / load a saved set */}
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-lime-400/20 bg-lime-400/5 p-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-white/40">
              Style Set Name
            </label>
            <input
              type="text"
              value={setName}
              onChange={(e) => setSetName(e.target.value)}
              placeholder="e.g. Pulp Horror"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-lime-400/40"
            />
          </div>
          <button
            type="button"
            onClick={() => void handleSaveSet()}
            disabled={!setName.trim() || savingSet}
            className="flex items-center gap-1.5 rounded-lg bg-lime-500 px-3 py-2 text-sm font-bold text-black transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-40"
          >
            {savingSet ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </button>
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-white/40">
              Load Set
            </label>
            <select
              value={selectedSetId}
              onChange={(e) => handleLoadSet(e.target.value)}
              className="rounded-lg border border-white/20 bg-neutral-800 px-3 py-2 text-sm text-white outline-none focus:border-lime-400/50"
            >
              <option value="">Saved style sets…</option>
              {sets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {ROLES.map(({ key, label, sample }) => {
          const resolved = resolveAZVTextStyle(key, styles);
          return (
            <div key={key} className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
              <JMFontSelect
                label={`${label} Font`}
                value={resolved.font}
                onChange={(id) => patch(key, { font: id })}
                sampleText={sample}
              />
              <div className="flex flex-wrap items-end gap-3">
                <NumberField
                  label="Size"
                  value={resolved.size}
                  onCommit={(n) => patch(key, { size: Math.max(0, n) })}
                />

                {/* Weight */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-white/40">
                    Weight
                  </label>
                  <select
                    value={resolved.weight}
                    onChange={(e) => patch(key, { weight: e.target.value as AZVTextWeight })}
                    className="rounded-lg border border-white/20 bg-neutral-800 px-3 py-2 text-sm text-white outline-none focus:border-lime-400/50"
                  >
                    <option value="normal">Normal</option>
                    <option value="bold">Bold</option>
                  </select>
                </div>

                {/* Color */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-white/40">
                    Color
                  </label>
                  <div className="flex gap-1.5">
                    {(["black", "white"] as AZVTextColor[]).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => patch(key, { color: c })}
                        title={c === "black" ? "Black text" : "White text"}
                        aria-pressed={resolved.color === c}
                        className={`h-8 w-8 rounded-full border-2 transition-all ${
                          c === "black" ? "bg-black" : "bg-white"
                        } ${resolved.color === c ? "scale-110 border-lime-400" : "border-white/25"}`}
                      />
                    ))}
                  </div>
                </div>

                {/* Alignment */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-white/40">
                    Align
                  </label>
                  <div className="flex overflow-hidden rounded-lg border border-white/15">
                    {ALIGNS.map(({ value, Icon }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => patch(key, { align: value })}
                        aria-pressed={resolved.align === value}
                        title={`Align ${value}`}
                        className={`px-3 py-2 transition-colors ${
                          resolved.align === value
                            ? "bg-lime-400/20 text-lime-300"
                            : "text-white/40 hover:bg-white/10"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Vertical offset — baseline nudge, + down / − up */}
                <NumberField
                  label="Y Offset"
                  value={resolved.offsetY}
                  onCommit={(n) => patch(key, { offsetY: n })}
                />
              </div>
            </div>
          );
        })}
      </div>
    </JMModal>
  );
}
