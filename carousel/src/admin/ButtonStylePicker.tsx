"use client";

import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";

import {
  BUILTIN_BUTTON_OPTIONS,
  DEFAULT_BUTTON_STYLE,
  buttonGradient,
  resolveStyleFromList,
} from "../button-styles";
import { mergeTheme, type CarouselTheme } from "../theme";
import type {
  BannerStore,
  ButtonStyleRecord,
  ResolvedButtonStyle,
} from "../types";

export interface ButtonStylePickerProps {
  /** Selected id. "" / "pink-purple" ⇒ default, "gold" ⇒ gold, else a doc id. */
  value: string;
  onChange: (id: string) => void;
  /** Needed only to list and create saved styles. */
  store: BannerStore;
  /** Fires with the resolved colors whenever the selection changes. */
  onResolved?: (resolved: ResolvedButtonStyle) => void;
  theme?: Partial<CarouselTheme>;
}

/**
 * Picks the CTA pill style for a banner: the two built-ins, every saved style,
 * and an inline "new style" form that writes one and selects it.
 */
export function ButtonStylePicker({
  value,
  onChange,
  store,
  onResolved,
  theme: themeOverride,
}: ButtonStylePickerProps): ReactElement {
  const theme = mergeTheme(themeOverride);
  const [styles, setStyles] = useState<ButtonStyleRecord[]>([]);
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
    store
      .listButtonStyles()
      .then((s) => {
        if (!cancelled) setStyles(s);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [store]);

  const resolved = useMemo(
    () => resolveStyleFromList(value, styles),
    [value, styles],
  );

  // Kept in a ref so a caller's inline arrow function cannot re-fire the effect.
  const onResolvedRef = useRef(onResolved);
  useEffect(() => {
    onResolvedRef.current = onResolved;
  });
  useEffect(() => {
    onResolvedRef.current?.(resolved);
  }, [resolved]);

  const inputStyle = {
    borderColor: theme.elevated3,
    backgroundColor: theme.elevated2,
    color: theme.textPrimary,
  };

  const handleCreate = async () => {
    if (!draft.name.trim()) return;
    setSaving(true);
    try {
      const created = await store.createButtonStyle({
        name: draft.name.trim(),
        from: draft.from,
        to: draft.to,
        textColor: draft.textColor,
        angle: draft.angle,
      });
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
      <label className="jmc-a-label" style={{ color: theme.textSecondary }}>
        Button style
      </label>
      <div className="jmc-a-row">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="jmc-a-input"
          style={inputStyle}
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

        <span
          className="jmc-a-pill"
          style={{
            background: buttonGradient(resolved),
            color: resolved.textColor,
          }}
        >
          Button
        </span>

        <button
          type="button"
          className="jmc-a-link"
          style={{ color: theme.accent }}
          onClick={() => setCreating((v) => !v)}
        >
          + New style
        </button>
      </div>

      {creating ? (
        <div className="jmc-a-card" style={{ borderColor: theme.elevated3 }}>
          <input
            type="text"
            placeholder="Style name (e.g. Sunset)"
            value={draft.name}
            onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
            className="jmc-a-input jmc-a-input--full"
            style={inputStyle}
          />
          <div className="jmc-a-row">
            {(
              [
                { key: "from", label: "From" },
                { key: "to", label: "To" },
                { key: "textColor", label: "Text" },
              ] as const
            ).map(({ key, label }) => (
              <label
                key={key}
                className="jmc-a-swatch"
                style={{ color: theme.textSecondary }}
              >
                {label}
                <input
                  type="color"
                  value={draft[key]}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, [key]: e.target.value }))
                  }
                  aria-label={`${label} color`}
                />
              </label>
            ))}
            <label
              className="jmc-a-swatch"
              style={{ color: theme.textSecondary }}
            >
              Angle
              <input
                type="number"
                value={draft.angle}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, angle: Number(e.target.value) || 0 }))
                }
                className="jmc-a-input jmc-a-input--narrow"
                style={inputStyle}
              />
            </label>
          </div>
          <div className="jmc-a-row jmc-a-row--split">
            <span
              className="jmc-a-pill jmc-a-pill--lg"
              style={{
                background: buttonGradient({
                  from: draft.from,
                  to: draft.to,
                  angle: draft.angle,
                  textColor: draft.textColor,
                }),
                color: draft.textColor,
              }}
            >
              {draft.name.trim() || "Preview"}
            </span>
            <span className="jmc-a-row">
              <button
                type="button"
                className="jmc-a-link"
                style={{ color: theme.textSecondary }}
                onClick={() => setCreating(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="jmc-a-btn jmc-a-btn--ghost"
                style={{ borderColor: theme.accent, color: theme.accent }}
                onClick={() => void handleCreate()}
                disabled={saving || !draft.name.trim()}
              >
                {saving ? "Saving…" : "Save style"}
              </button>
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
