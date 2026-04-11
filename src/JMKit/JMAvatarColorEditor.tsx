"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Lottie from "lottie-react";
import { Loader2, RotateCcw, Save } from "lucide-react";
import { getAvatarBaseName } from "@/lib/avatar-scale-map";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

interface ColorEntry {
  hex: string;
  count: number;
}

interface JMAvatarColorEditorProps {
  avatarFilename: string;
  onSave: (newFilename: string) => void;
  onCancel: () => void;
}

// ─────────────────────────────────────────────────────────────
// COLOR HELPERS
// ─────────────────────────────────────────────────────────────

function rgbToHex(r: number, g: number, b: number): string {
  const ri = Math.round(r * 255);
  const gi = Math.round(g * 255);
  const bi = Math.round(b * 255);
  return `#${ri.toString(16).padStart(2, "0")}${gi.toString(16).padStart(2, "0")}${bi.toString(16).padStart(2, "0")}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

function extractGradientColors(
  g: Record<string, unknown>,
  colors: Map<string, number>,
) {
  const p = (g["p"] as number) ?? 0;
  const kObj = g["k"];
  if (!kObj || typeof kObj !== "object") return;
  const kRec = kObj as Record<string, unknown>;
  if (kRec["a"] !== 0) return;
  const arr = kRec["k"];
  if (!Array.isArray(arr)) return;
  for (let i = 0; i < p; i++) {
    const idx = i * 4;
    if (idx + 3 < arr.length) {
      const hex = rgbToHex(arr[idx + 1] as number, arr[idx + 2] as number, arr[idx + 3] as number);
      colors.set(hex, (colors.get(hex) ?? 0) + 1);
    }
  }
}

function extractColors(obj: unknown): Map<string, number> {
  const colors = new Map<string, number>();

  function walk(node: unknown) {
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (node && typeof node === "object") {
      const rec = node as Record<string, unknown>;
      const ty = rec["ty"];

      // Solid fill / stroke
      if (
        (ty === "fl" || ty === "st") &&
        rec["c"] &&
        typeof rec["c"] === "object"
      ) {
        const c = rec["c"] as Record<string, unknown>;
        if (c["a"] === 0 && Array.isArray(c["k"])) {
          const k = c["k"] as number[];
          if (k.length >= 3) {
            const hex = rgbToHex(k[0]!, k[1]!, k[2]!);
            colors.set(hex, (colors.get(hex) ?? 0) + 1);
          }
        }
      }

      // Gradient fill / stroke
      if ((ty === "gf" || ty === "gs") && rec["g"] && typeof rec["g"] === "object") {
        extractGradientColors(rec["g"] as Record<string, unknown>, colors);
      }

      for (const val of Object.values(rec)) walk(val);
    }
  }

  walk(obj);
  return colors;
}

function remapGradient(
  g: Record<string, unknown>,
  remap: Map<string, string>,
): Record<string, unknown> {
  const p = (g["p"] as number) ?? 0;
  const kObj = g["k"];
  if (!kObj || typeof kObj !== "object") return g;
  const kRec = kObj as Record<string, unknown>;
  if (kRec["a"] !== 0) return g;
  const arr = kRec["k"];
  if (!Array.isArray(arr)) return g;

  let changed = false;
  const newArr = [...arr];
  for (let i = 0; i < p; i++) {
    const idx = i * 4;
    if (idx + 3 < newArr.length) {
      const oldHex = rgbToHex(newArr[idx + 1] as number, newArr[idx + 2] as number, newArr[idx + 3] as number);
      const newHex = remap.get(oldHex);
      if (newHex && newHex !== oldHex) {
        const [r, gb, b] = hexToRgb(newHex);
        newArr[idx + 1] = r;
        newArr[idx + 2] = gb;
        newArr[idx + 3] = b;
        changed = true;
      }
    }
  }
  if (!changed) return g;
  return { ...g, k: { ...kRec, k: newArr } };
}

function applyColorRemap(
  obj: unknown,
  remap: Map<string, string>,
): unknown {
  if (Array.isArray(obj)) {
    return obj.map((item: unknown) => applyColorRemap(item, remap));
  }
  if (obj && typeof obj === "object") {
    const rec = obj as Record<string, unknown>;
    const clone: Record<string, unknown> = {};
    const ty = rec["ty"];

    for (const [key, val] of Object.entries(rec)) {
      // Solid fill/stroke color
      if (
        key === "c" &&
        val &&
        typeof val === "object" &&
        !Array.isArray(val)
      ) {
        const c = val as Record<string, unknown>;
        if (
          (ty === "fl" || ty === "st") &&
          c["a"] === 0 &&
          Array.isArray(c["k"])
        ) {
          const k = c["k"] as number[];
          if (k.length >= 3) {
            const oldHex = rgbToHex(k[0]!, k[1]!, k[2]!);
            const newHex = remap.get(oldHex);
            if (newHex && newHex !== oldHex) {
              const [r, g, b] = hexToRgb(newHex);
              clone[key] = { ...c, k: [r, g, b, ...(k.length > 3 ? [k[3]] : [1])] };
              continue;
            }
          }
        }
      }

      // Gradient fill/stroke
      if (
        key === "g" &&
        (ty === "gf" || ty === "gs") &&
        val &&
        typeof val === "object" &&
        !Array.isArray(val)
      ) {
        clone[key] = remapGradient(val as Record<string, unknown>, remap);
        continue;
      }

      clone[key] = applyColorRemap(val, remap);
    }
    return clone;
  }
  return obj;
}

function generateId(len = 6): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "";
  for (let i = 0; i < len; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────

export function JMAvatarColorEditor({
  avatarFilename,
  onSave,
  onCancel,
}: JMAvatarColorEditorProps) {
  const [originalJson, setOriginalJson] = useState<Record<string, unknown> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [colorRemap, setColorRemap] = useState<Map<string, string>>(new Map());
  const debounceRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const url = avatarFilename.endsWith(".json")
          ? `/avatars/${avatarFilename}`
          : `/avatars/${avatarFilename}.json`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to load avatar");
        const data = await res.json();
        setOriginalJson(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Load failed");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [avatarFilename]);

  const originalColors = useMemo<ColorEntry[]>(() => {
    if (!originalJson) return [];
    const map = extractColors(originalJson);
    return Array.from(map.entries())
      .map(([hex, count]) => ({ hex, count }))
      .sort((a, b) => b.count - a.count);
  }, [originalJson]);

  const previewJson = useMemo(() => {
    if (!originalJson || colorRemap.size === 0) return originalJson;
    return applyColorRemap(originalJson, colorRemap) as Record<string, unknown>;
  }, [originalJson, colorRemap]);

  const handleColorChange = useCallback(
    (oldHex: string, newHex: string) => {
      const timers = debounceRef.current;
      const existing = timers.get(oldHex);
      if (existing) clearTimeout(existing);

      timers.set(
        oldHex,
        setTimeout(() => {
          setColorRemap((prev) => {
            const next = new Map(prev);
            if (newHex === oldHex) {
              next.delete(oldHex);
            } else {
              next.set(oldHex, newHex);
            }
            return next;
          });
          timers.delete(oldHex);
        }, 60),
      );
    },
    [],
  );

  const handleReset = useCallback(() => {
    setColorRemap(new Map());
  }, []);

  const handleSave = useCallback(async () => {
    if (!previewJson || colorRemap.size === 0) return;
    setIsSaving(true);
    setError(null);

    try {
      const baseName = getAvatarBaseName(avatarFilename).replace(".json", "");
      const newId = generateId();
      const newFilename = `${baseName}-custom~~|~~${newId}.json`;

      const res = await fetch("/api/avatars", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: newFilename, json: previewJson }),
      });

      if (!res.ok) throw new Error("Save failed");

      onSave(newFilename);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  }, [previewJson, colorRemap.size, avatarFilename, onSave]);

  const hasChanges = colorRemap.size > 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
      </div>
    );
  }

  if (error && !originalJson) {
    return <p className="py-4 text-center text-sm text-red-400">{error}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Live preview */}
      <div className="flex justify-center">
        <div className="h-40 w-40 overflow-hidden rounded-full bg-black/30 ring-[3px] ring-white/20">
          {previewJson && (
            <Lottie
              animationData={previewJson as Record<string, unknown>}
              loop
              autoplay
              style={{ width: "100%", height: "100%" }}
            />
          )}
        </div>
      </div>

      {/* Color palette */}
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-white/50">
          Colors ({originalColors.length})
        </p>
        <div className="grid grid-cols-6 gap-2">
          {originalColors.map(({ hex, count }) => {
            const currentHex = colorRemap.get(hex) ?? hex;
            const changed = colorRemap.has(hex);
            return (
              <label
                key={hex}
                className={`group relative flex cursor-pointer flex-col items-center gap-1 rounded-lg p-1.5 transition-colors ${
                  changed ? "bg-white/10 ring-1 ring-amber-400/40" : "hover:bg-white/5"
                }`}
              >
                <div
                  className="h-8 w-8 rounded-full border border-white/20 transition-transform group-hover:scale-110"
                  style={{ backgroundColor: currentHex }}
                />
                <span className="text-[9px] tabular-nums text-white/40">
                  ×{count}
                </span>
                <input
                  type="color"
                  value={currentHex}
                  onChange={(e) => handleColorChange(hex, e.target.value)}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
              </label>
            );
          })}
        </div>
      </div>

      {error && (
        <p className="text-center text-sm text-red-400">{error}</p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={handleReset}
          disabled={!hasChanges}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-white/50 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30"
        >
          <RotateCcw size={14} />
          Reset
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="flex items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2 text-sm font-medium text-black transition-all hover:bg-amber-300 disabled:opacity-40"
          >
            <Save size={14} />
            {isSaving ? "Saving..." : "Save as Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}
