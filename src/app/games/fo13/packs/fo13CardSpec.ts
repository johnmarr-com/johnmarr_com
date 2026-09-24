/**
 * Field Office 13 card spec — the single source of geometry, shared by the
 * builder form, the live preview, and the renderer.
 *
 * Poker size at 300 DPI: 2.75" × 3.75" = 825 × 1125 px.
 */

import type { FO13CardType } from "@/lib/fo13-packs";

export const FO13_CARD_W = 825;
export const FO13_CARD_H = 1125;

/**
 * The two Rank cards ship with the game, so a new pack is seeded with them
 * rather than asking anyone to upload art that already exists.
 */
export const FO13_RANK_ART: string[] = [
  "/games/fo13/Ranks-1.png",
  "/games/fo13/Ranks-2.png",
];

/** Fixed front background per typed card type. Rank supplies its own art. */
const BACKGROUNDS: Record<FO13CardType, string | null> = {
  Rank: null,
  Subject: "/games/fo13/1-Subject-Front.png",
  Research: "/games/fo13/2-Research-Front.png",
  Footnote: "/games/fo13/3-Footnote-Front.png",
};

/** Background for a card type, or null when the card carries its own image. */
export function backgroundForCard(cardType: FO13CardType): string | null {
  return BACKGROUNDS[cardType];
}

/**
 * The typed line's box, in card pixels.
 *
 * y is 20px above the authored 276: dead-centre in the form area rendered a
 * shade low against the artwork, so the block sits slightly high of true
 * centre. Height is unchanged, so the copy budget is the same.
 */
export const FO13_TEXT_BOX = { x: 98, y: 256, w: 630, h: 600 } as const;

/**
 * Type style for the typed line.
 *
 * `maxSize` 100 is Photoshop's 24 pt at 300 DPI (24 ÷ 72 × 300), measured off
 * the approved sample card; `lineHeight` 1.2 matches the 120.6 px baseline
 * spacing on that same card. At this size ~38 mixed-case characters fill the
 * box exactly, which is what makes the 40-character limit the right limit —
 * anything longer simply shrinks to fit.
 */
export const FO13_TEXT_STYLE = {
  fontId: "bohemian-typewriter",
  maxSize: 100,
  lineHeight: 1.2,
  /** Sampled from the approved card's ink. */
  color: "#0B0B0B",
} as const;

/** Typed lines are capped so they stay legible at the design size. */
export const FO13_MAX_TEXT_LENGTH = 40;

/**
 * Forced line break inside a typed line.
 *
 * Matches the convention already used for game subtitles in GameLandingPage:
 * `<br>`, `<br/>`, a literal `\n`, or a real newline from a paste. `/n` is
 * accepted too, since it is the easier one to type — but it is greedy about
 * copy that happens to contain it ("and/nothing" breaks after "and"), so
 * write "and / nothing" if you mean the slash.
 *
 * The markers are layout, not copy, so they do not count against
 * FO13_MAX_TEXT_LENGTH.
 */
const LINE_BREAK = /<br\s*\/?>|\r?\n|\/n|\\n/gi;

/**
 * Split a typed line into its forced segments. A stray break at either end
 * is a typo and is dropped; one in the middle is a deliberate blank line.
 */
export function fo13TextLines(text: string): string[] {
  const parts = text.split(LINE_BREAK).map((part) => part.trim());
  while (parts.length > 0 && parts[0] === "") parts.shift();
  while (parts.length > 0 && parts[parts.length - 1] === "") parts.pop();
  return parts;
}

/** The typed line with its break markers removed — what the counter counts. */
export function fo13VisibleText(text: string): string {
  return text.replace(LINE_BREAK, "");
}

/** Visible character count, ignoring break markers. */
export function fo13VisibleLength(text: string): number {
  return fo13VisibleText(text).length;
}
