"use client";

/**
 * JMFonts — the central registry of card/design fonts available across the
 * app (pack builders, card renderers, previews).
 *
 * Every font is a bundled woff2 in /public/fonts, registered lazily via the
 * FontFace API under its own family name — so canvas renders and previews are
 * pixel-identical on every machine, independent of installed fonts or
 * next/font's scoped names.
 *
 * Adding a custom font: drop the .woff2 in /public/fonts and add one entry.
 */

export interface JMFontDef {
  /** Stable id stored in data (packs, cards). */
  id: string;
  /** Human label for pickers. */
  label: string;
  /** Registered family name (quoted into canvas/CSS font strings). */
  family: string;
  /** File under /public/fonts. */
  file: string;
  /** FontFace weight descriptor — "400 700" for variable files. */
  weight?: string;
  /** Fallback stack appended after the family. */
  fallback: string;
}

export const JM_FONTS: JMFontDef[] = [
  { id: "crimson-pro", label: "Crimson Pro", family: "JM Crimson Pro", file: "crimson-pro-latin.woff2", weight: "400 700", fallback: "Georgia, serif" },
  { id: "grenze", label: "Grenze", family: "JM Grenze", file: "grenze.woff2", fallback: "Georgia, serif" },
  { id: "cinzel", label: "Cinzel", family: "JM Cinzel", file: "cinzel.woff2", weight: "400 700", fallback: "Georgia, serif" },
  { id: "marcellus", label: "Marcellus", family: "JM Marcellus", file: "marcellus.woff2", fallback: "Georgia, serif" },
  { id: "amaranth", label: "Amaranth", family: "JM Amaranth", file: "amaranth.woff2", fallback: "Arial, sans-serif" },
  { id: "bangers", label: "Bangers", family: "JM Bangers", file: "bangers.woff2", fallback: "Impact, sans-serif" },
  { id: "creepster", label: "Creepster", family: "JM Creepster", file: "creepster.woff2", fallback: "Impact, sans-serif" },
  { id: "luckiest-guy", label: "Luckiest Guy", family: "JM Luckiest Guy", file: "luckiest-guy.woff2", fallback: "Impact, sans-serif" },
  { id: "oswald", label: "Oswald", family: "JM Oswald", file: "oswald.woff2", weight: "400 700", fallback: "Arial Narrow, sans-serif" },
  { id: "bebas-neue", label: "Bebas Neue", family: "JM Bebas Neue", file: "bebas-neue.woff2", fallback: "Arial Narrow, sans-serif" },
  { id: "nunito", label: "Nunito", family: "JM Nunito", file: "nunito.woff2", weight: "400 700", fallback: "Arial, sans-serif" },
  { id: "special-elite", label: "Special Elite", family: "JM Special Elite", file: "special-elite.woff2", fallback: "Courier New, monospace" },
];

export function getJMFont(id: string | undefined): JMFontDef | undefined {
  return JM_FONTS.find((f) => f.id === id);
}

/** CSS/canvas family string for a font id (falls back to serif stack). */
export function jmFontFamily(id: string | undefined): string {
  const font = getJMFont(id);
  return font ? `"${font.family}", ${font.fallback}` : "Georgia, serif";
}

const loaded = new Map<string, Promise<void>>();

/** Register + load a font once per session; resolves even on failure so
 * callers can render with the fallback stack. */
export function ensureJMFont(id: string | undefined): Promise<void> {
  const font = getJMFont(id);
  if (!font) return Promise.resolve();
  let p = loaded.get(font.id);
  if (!p) {
    p = (async () => {
      try {
        const face = new FontFace(
          font.family,
          `url(/fonts/${font.file})`,
          font.weight ? { weight: font.weight } : {},
        );
        await face.load();
        document.fonts.add(face);
      } catch (err) {
        console.warn(`[JMFonts] failed to load "${font.id}" — using fallback:`, err);
      }
    })();
    loaded.set(font.id, p);
  }
  return p;
}
