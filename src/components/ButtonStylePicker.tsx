"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { useJMStyle } from "@/JMStyle";
import { useAuth } from "@/lib/AuthProvider";
import {
  createButtonStyle,
  listButtonStyles,
  resolveStyleFromList,
  BUILTIN_BUTTON_OPTIONS,
  DEFAULT_BUTTON_STYLE,
  type ResolvedButtonStyle,
} from "@/lib/button-styles";
import type { JMButtonStyle } from "@/lib/content-types";

interface ButtonStylePickerProps {
  /** Selected style id. "" / "pink-purple" ⇒ default, "gold" ⇒ gold, else doc id. */
  value: string;
  onChange: (id: string) => void;
  /** Fires with the resolved pill colors whenever the effective style changes. */
  onResolved?: (resolved: ResolvedButtonStyle) => void;
}

/**
 * Reusable CTA "button style" picker: a dropdown of built-ins (Pink-Purple
 * default + Gold) plus saved styles, with inline create. Shared by the
 * ScrollyFox segment editor and the Featured-banner editor so both surfaces
 * customize CTAs identically.
 */
export function ButtonStylePicker({
  value,
  onChange,
  onResolved,
}: ButtonStylePickerProps) {
  const { theme } = useJMStyle();
  const { user } = useAuth();

  const [styles, setStyles] = useState<JMButtonStyle[]>([]);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    from: DEFAULT_BUTTON_STYLE.from,
    to: DEFAULT_BUTTON_STYLE.to,
    textColor: DEFAULT_BUTTON_STYLE.textColor,
    angle: DEFAULT_BUTTON_STYLE.angle,
  });

  useEffect(() => {
    let cancelled = false;
    listButtonStyles()
      .then((s) => {
        if (!cancelled) setStyles(s);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Report the resolved pill colors to the parent (for live previews).
  const onResolvedRef = useRef(onResolved);
  useEffect(() => {
    onResolvedRef.current = onResolved;
  });
  const resolved = useMemo(
    () => resolveStyleFromList(value, styles),
    [value, styles],
  );
  useEffect(() => {
    onResolvedRef.current?.(resolved);
  }, [resolved]);

  const handleCreate = async () => {
    if (!user?.uid || !draft.name.trim()) return;
    setSaving(true);
    try {
      const created = await createButtonStyle(
        {
          name: draft.name.trim(),
          from: draft.from,
          to: draft.to,
          textColor: draft.textColor,
          angle: draft.angle,
        },
        user.uid,
      );
      setStyles((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name)),
      );
      onChange(created.id);
      setCreating(false);
      setDraft({
        name: "",
        from: DEFAULT_BUTTON_STYLE.from,
        to: DEFAULT_BUTTON_STYLE.to,
        textColor: DEFAULT_BUTTON_STYLE.textColor,
        angle: DEFAULT_BUTTON_STYLE.angle,
      });
    } catch (e) {
      console.error("Failed to save button style", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <label
        className="mb-2 block text-sm font-semibold"
        style={{ color: theme.text.primary }}
      >
        Button style
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-lg border-2 px-3 py-2 text-sm"
          style={{
            borderColor: theme.surfaces.elevated2,
            backgroundColor: theme.surfaces.elevated1,
            color: theme.text.primary,
          }}
          aria-label="CTA button style"
        >
          {BUILTIN_BUTTON_OPTIONS.map((opt) => (
            <option key={opt.id || "default"} value={opt.id}>
              {opt.name}
            </option>
          ))}
          {styles.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {/* Swatch of the selected style */}
        <span
          className="inline-flex items-center rounded-full px-4 py-2 text-xs font-semibold"
          style={{
            background: `linear-gradient(${resolved.angle}deg, ${resolved.from}, ${resolved.to})`,
            color: resolved.textColor,
          }}
        >
          Button
        </span>
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs"
          style={{ color: theme.accents.neonPink }}
        >
          <Plus size={14} /> New style
        </button>
      </div>

      {creating && (
        <div
          className="mt-3 flex flex-col gap-3 rounded-lg border-2 p-3"
          style={{ borderColor: theme.surfaces.elevated2 }}
        >
          <input
            type="text"
            placeholder="Style name (e.g. Sunset)"
            value={draft.name}
            onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
            className="w-full rounded-lg border-2 px-3 py-2 text-sm"
            style={{
              borderColor: theme.surfaces.elevated2,
              backgroundColor: theme.surfaces.elevated1,
              color: theme.text.primary,
            }}
          />
          <div className="flex flex-wrap gap-4">
            {(
              [
                { key: "from", label: "From" },
                { key: "to", label: "To" },
                { key: "textColor", label: "Text" },
              ] as const
            ).map(({ key, label }) => (
              <label
                key={key}
                className="flex items-center gap-2 text-xs"
                style={{ color: theme.text.secondary }}
              >
                {label}
                <input
                  type="color"
                  value={draft[key]}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, [key]: e.target.value }))
                  }
                  className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
                  aria-label={`${label} color`}
                />
              </label>
            ))}
            <label
              className="flex items-center gap-2 text-xs"
              style={{ color: theme.text.secondary }}
            >
              Angle
              <input
                type="number"
                value={draft.angle}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, angle: Number(e.target.value) || 0 }))
                }
                className="w-16 rounded-lg border-2 px-2 py-1 text-sm"
                style={{
                  borderColor: theme.surfaces.elevated2,
                  backgroundColor: theme.surfaces.elevated1,
                  color: theme.text.primary,
                }}
              />
            </label>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span
              className="inline-flex items-center rounded-full px-5 py-2 text-sm font-semibold"
              style={{
                background: `linear-gradient(${draft.angle}deg, ${draft.from}, ${draft.to})`,
                color: draft.textColor,
              }}
            >
              {draft.name.trim() || "Preview"}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="rounded-lg px-3 py-1.5 text-xs"
                style={{ color: theme.text.secondary }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={saving || !draft.name.trim()}
                className="rounded-lg border-2 px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                style={{
                  borderColor: theme.accents.neonPink,
                  color: theme.accents.neonPink,
                  backgroundColor: "transparent",
                }}
              >
                {saving ? "Saving…" : "Save style"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
