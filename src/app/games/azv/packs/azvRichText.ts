"use client";

/**
 * AZV rich text — the tiny inline syntax used by card descriptions:
 *
 *   *text*            bold
 *   **text**          italic
 *   ***text***        bold italic
 *   [red:text]        colored (named color or [#FF00AA:text] raw hex)
 *
 * Color blocks may contain asterisk styling: [red:*RUN*]. No nesting of
 * color inside color. Unmatched markers render literally.
 */

export interface AZVRichToken {
  text: string;
  bold: boolean;
  italic: boolean;
  /** Hex color override; falls back to the role's black/white when absent. */
  color?: string;
}

/** Named colors available in [name:text]. */
export const AZV_RICH_COLORS: Record<string, string> = {
  red: "#EF4444",
  orange: "#F97316",
  yellow: "#FACC15",
  green: "#4ADE80",
  blue: "#60A5FA",
  purple: "#A78BFA",
  pink: "#F472B6",
  gray: "#9CA3AF",
  white: "#FFFFFF",
  black: "#000000",
};

const COLOR_BLOCK = /\[(#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})|[a-zA-Z]+):([^\]]*)\]/g;
const STYLE_RUN = /(\*{1,3})([^*]+)\1/g;

/** Parse asterisk styling within one (possibly colored) segment. */
function parseStyles(text: string, color: string | undefined, out: AZVRichToken[]): void {
  let last = 0;
  for (const m of text.matchAll(STYLE_RUN)) {
    if (m.index! > last) {
      out.push({ text: text.slice(last, m.index), bold: false, italic: false, ...(color ? { color } : {}) });
    }
    const marks = m[1]!.length;
    out.push({
      text: m[2]!,
      bold: marks === 1 || marks === 3,
      italic: marks === 2 || marks === 3,
      ...(color ? { color } : {}),
    });
    last = m.index! + m[0].length;
  }
  if (last < text.length) {
    out.push({ text: text.slice(last), bold: false, italic: false, ...(color ? { color } : {}) });
  }
}

/** Parse the full syntax into styled tokens (text order preserved). */
export function parseAZVRichText(input: string): AZVRichToken[] {
  const out: AZVRichToken[] = [];
  let last = 0;
  for (const m of input.matchAll(COLOR_BLOCK)) {
    if (m.index! > last) parseStyles(input.slice(last, m.index), undefined, out);
    const raw = m[1]!;
    const color = raw.startsWith("#") ? raw : AZV_RICH_COLORS[raw.toLowerCase()];
    // Unknown color name → render the block literally.
    if (color) parseStyles(m[2]!, color, out);
    else parseStyles(m[0], undefined, out);
    last = m.index! + m[0].length;
  }
  if (last < input.length) parseStyles(input.slice(last), undefined, out);
  return out.filter((t) => t.text.length > 0);
}

/** Split styled tokens into single-word tokens (for canvas wrapping). */
export function azvRichWords(tokens: AZVRichToken[]): AZVRichToken[] {
  const words: AZVRichToken[] = [];
  for (const token of tokens) {
    for (const word of token.text.split(/\s+/)) {
      if (word) words.push({ ...token, text: word });
    }
  }
  return words;
}
