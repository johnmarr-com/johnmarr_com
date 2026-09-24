/**
 * CTA pill styles — built-ins plus saved styles.
 *
 * A banner stores only an id. "" / "pink-purple" and "gold" are built-in
 * sentinels that resolve without a read; anything else is a saved style's id.
 * One constant per built-in ⇒ retuning it updates every CTA that uses it.
 */

import type {
  ButtonStyleRecord,
  ResolvedButtonStyle,
} from "./types";

/** Brand default — pink → purple, white label. */
export const DEFAULT_BUTTON_STYLE: ResolvedButtonStyle = {
  from: "#FF36AB",
  to: "#8B35FF",
  angle: 135,
  textColor: "#FFFFFF",
};

/** The classic feature-banner look — solid gold, dark label. */
export const GOLD_BUTTON_STYLE: ResolvedButtonStyle = {
  from: "#FFD700",
  to: "#FFD700",
  angle: 135,
  textColor: "#000000",
};

/** Built-in options, for the picker's dropdown. */
export const BUILTIN_BUTTON_OPTIONS: ReadonlyArray<{ id: string; name: string }> = [
  { id: "", name: "Pink-Purple (default)" },
  { id: "gold", name: "Gold" },
];

/** Resolve a built-in id to its colors, or null if it's a saved-style id. */
export function resolveBuiltinStyle(id: string): ResolvedButtonStyle | null {
  if (!id || id === "pink-purple") return DEFAULT_BUTTON_STYLE;
  if (id === "gold") return GOLD_BUTTON_STYLE;
  return null;
}

/** Resolve a raw style record (or nothing) into concrete render values. */
export function resolveButtonStyle(
  data:
    | { from?: unknown; to?: unknown; angle?: unknown; textColor?: unknown }
    | null
    | undefined,
): ResolvedButtonStyle {
  if (!data) return DEFAULT_BUTTON_STYLE;
  return {
    from: typeof data.from === "string" ? data.from : DEFAULT_BUTTON_STYLE.from,
    to: typeof data.to === "string" ? data.to : DEFAULT_BUTTON_STYLE.to,
    angle:
      typeof data.angle === "number" ? data.angle : DEFAULT_BUTTON_STYLE.angle,
    textColor:
      typeof data.textColor === "string"
        ? data.textColor
        : DEFAULT_BUTTON_STYLE.textColor,
  };
}

/** Resolve an id against an already-loaded list (client-side previews). */
export function resolveStyleFromList(
  id: string,
  styles: readonly ButtonStyleRecord[],
): ResolvedButtonStyle {
  const builtin = resolveBuiltinStyle(id);
  if (builtin) return builtin;
  return resolveButtonStyle(styles.find((s) => s.id === id) ?? null);
}

/** The CSS `background` value for a resolved style. */
export function buttonGradient(style: ResolvedButtonStyle): string {
  return `linear-gradient(${style.angle}deg, ${style.from}, ${style.to})`;
}
