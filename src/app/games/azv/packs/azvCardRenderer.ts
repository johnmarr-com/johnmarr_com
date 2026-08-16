"use client";

import { ensureJMFont, jmFontFamily } from "@/JMKit";
import type {
  AZVCardType,
  AZVWeaponType,
  AZVGoodStuffType,
  AZVTextStyles,
  AZVCondition,
} from "@/lib/azv-packs";
import {
  overlayForCard,
  weaponIconPath,
  resolveAZVTextStyle,
  type AZVResolvedTextStyle,
  AZV_LAYOUT,
} from "./azvCardSpec";
import { parseAZVRichText, azvRichWords, type AZVRichToken } from "./azvRichText";

/**
 * AZV print-card renderer — 900×1500 canvas:
 *   background (cover-fit) → type/level overlay → title (styled, fit-to-box)
 *   → hits number OR weapon badge → hope/hunger number.
 * Text styling (font / size / weight / color / alignment) comes from the
 * card's textStyles, resolved against role defaults. Description placement
 * lands later, card type by card type.
 */

const CARD_W = 900;
const CARD_H = 1500;

export interface AZVCardRenderInput {
  cardType: AZVCardType;
  goodStuffType?: AZVGoodStuffType | undefined;
  level?: number | undefined;
  backgroundImageURL?: string | undefined;
  title?: string | undefined;
  hits?: number | undefined;
  /** Hope (Humans / GoodStuff / MegaStuff) or Hunger (BadStuff). */
  hopeOrHunger?: number | undefined;
  weaponType?: AZVWeaponType | undefined;
  description?: string | undefined;
  /** Rendered in the description box instead of `description` when present. */
  conditions?: AZVCondition[] | undefined;
  textStyles?: AZVTextStyles | undefined;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src.slice(0, 80)}`));
    img.src = src;
  });
}

/** Draw an image to fill the card (cover — crops overflow, never stretches). */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement): void {
  const scale = Math.max(CARD_W / img.width, CARD_H / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (CARD_W - w) / 2, (CARD_H - h) / 2, w, h);
}

const colorHex = (c: "black" | "white"): string => (c === "black" ? "#000000" : "#FFFFFF");

const fontString = (style: AZVResolvedTextStyle, size: number): string =>
  `${style.weight === "bold" ? "bold " : ""}${size}px ${jmFontFamily(style.font)}`;

/**
 * Baseline offset that vertically centers text the way CSS does: half the
 * font's line box (ascent − descent). Canvas textBaseline:"middle" centers on
 * the em square instead, which sits a few px higher than the CSS preview —
 * the preview is the approved look, so the render matches it.
 * Requires ctx.font to be set first.
 */
function cssCenterBaseline(ctx: CanvasRenderingContext2D): number {
  const m = ctx.measureText("Mg");
  const ascent = m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent;
  const descent = m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent;
  return (ascent - descent) / 2;
}

/**
 * Largest size (≤ the style's size, no minimum) at which `text` fits `width`.
 * Exported so the live preview sizes exactly like the final render.
 */
export function fitAZVTextSize(
  text: string,
  style: AZVResolvedTextStyle,
  width: number,
): number {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx || !text.trim()) return style.size;
  let size = style.size;
  while (size > 1) {
    ctx.font = fontString(style, size);
    if (ctx.measureText(text).width <= width) break;
    size--;
  }
  return size;
}

/** Draw one aligned line inside a box (vertically centered). */
function drawBoxedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  style: AZVResolvedTextStyle,
  box: { x: number; y: number; w: number; h: number },
): void {
  const size = fitAZVTextSize(text, style, box.w);
  ctx.font = fontString(style, size);
  ctx.fillStyle = colorHex(style.color);
  ctx.textBaseline = "alphabetic";
  const y = box.y + box.h / 2 + style.offsetY + cssCenterBaseline(ctx);
  if (style.align === "left") {
    ctx.textAlign = "left";
    ctx.fillText(text, box.x, y);
  } else if (style.align === "right") {
    ctx.textAlign = "right";
    ctx.fillText(text, box.x + box.w, y);
  } else {
    ctx.textAlign = "center";
    ctx.fillText(text, box.x + box.w / 2, y);
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

const DESC_LINE_HEIGHT = 1.2;

/** Font string for one rich token (role weight/italic combine with markup). */
function richFont(style: AZVResolvedTextStyle, token: AZVRichToken, size: number): string {
  const bold = token.bold || style.weight === "bold";
  return `${token.italic ? "italic " : ""}${bold ? "bold " : ""}${size}px ${jmFontFamily(style.font)}`;
}

/** Greedy rich word-wrap at a given size; null when any word overflows. */
function wrapRichAt(
  ctx: CanvasRenderingContext2D,
  words: AZVRichToken[],
  style: AZVResolvedTextStyle,
  size: number,
  maxWidth: number,
): AZVRichToken[][] | null {
  ctx.font = fontString(style, size);
  const spaceW = ctx.measureText(" ").width;
  const lines: AZVRichToken[][] = [];
  let line: AZVRichToken[] = [];
  let lineW = 0;
  for (const word of words) {
    ctx.font = richFont(style, word, size);
    const w = ctx.measureText(word.text).width;
    if (w > maxWidth) return null;
    if (line.length && lineW + spaceW + w > maxWidth) {
      lines.push(line);
      line = [word];
      lineW = w;
    } else {
      line.push(word);
      lineW += (line.length > 1 ? spaceW : 0) + w;
    }
  }
  if (line.length) lines.push(line);
  return lines;
}

/**
 * Largest size (≤ the style's size) at which the rich text, word-wrapped,
 * fits the box. Exported so the live preview sizes exactly like the render.
 */
export function fitAZVBlockSize(
  text: string,
  style: AZVResolvedTextStyle,
  box: { w: number; h: number },
): number {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx || !text.trim()) return style.size;
  const words = azvRichWords(parseAZVRichText(text));
  let size = style.size;
  while (size > 1) {
    const lines = wrapRichAt(ctx, words, style, size, box.w);
    if (lines && lines.length * size * DESC_LINE_HEIGHT <= box.h) break;
    size--;
  }
  return size;
}

/** Draw wrapped rich text, aligned per line, vertically centered in its box. */
function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  style: AZVResolvedTextStyle,
  box: { x: number; y: number; w: number; h: number },
): void {
  const size = fitAZVBlockSize(text, style, box);
  const words = azvRichWords(parseAZVRichText(text));
  const lines = wrapRichAt(ctx, words, style, size, box.w) ?? [words];
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.font = fontString(style, size);
  const spaceW = ctx.measureText(" ").width;
  const step = size * DESC_LINE_HEIGHT;
  const baselineShift = cssCenterBaseline(ctx);
  let y = box.y + (box.h - lines.length * step) / 2 + step / 2 + style.offsetY + baselineShift;
  for (const line of lines) {
    const widths = line.map((word) => {
      ctx.font = richFont(style, word, size);
      return ctx.measureText(word.text).width;
    });
    const total = widths.reduce((a, b) => a + b, 0) + spaceW * (line.length - 1);
    let x =
      style.align === "left"
        ? box.x
        : style.align === "right"
          ? box.x + box.w - total
          : box.x + (box.w - total) / 2;
    line.forEach((word, i) => {
      ctx.font = richFont(style, word, size);
      ctx.fillStyle = word.color ?? colorHex(style.color);
      ctx.fillText(word.text, x, y);
      x += widths[i]! + spaceW;
    });
    y += step;
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

// ── Conditions ──────────────────────────────────────────────
// Each row: bold "Weakness:" + 70×70 weapon icon + the note, the trio
// centered horizontally; rows centered vertically in the description box.

const conditionLabel = (c: AZVCondition): string => `${c.condition}:`;

/** Row part widths at a given size (label / note; icon is fixed). */
function measureConditionRow(
  ctx: CanvasRenderingContext2D,
  c: AZVCondition,
  style: AZVResolvedTextStyle,
  size: number,
): { labelW: number; noteW: number; total: number } {
  const { iconSize, gap } = AZV_LAYOUT.conditionRow;
  const family = jmFontFamily(style.font);
  ctx.font = `bold ${size}px ${family}`;
  const labelW = ctx.measureText(conditionLabel(c)).width;
  const note = c.conditionDescription?.trim() ?? "";
  ctx.font = fontString(style, size);
  const noteW = note ? ctx.measureText(note).width : 0;
  const total = labelW + gap + iconSize + (noteW ? gap + noteW : 0);
  return { labelW, noteW, total };
}

/** Largest size (≤ style size) where every condition row fits the box width. */
export function fitAZVConditionsSize(
  conditions: AZVCondition[],
  style: AZVResolvedTextStyle,
  box: { w: number },
): number {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx || conditions.length === 0) return style.size;
  let size = style.size;
  while (size > 1) {
    if (conditions.every((c) => measureConditionRow(ctx, c, style, size).total <= box.w)) break;
    size--;
  }
  return size;
}

async function drawConditions(
  ctx: CanvasRenderingContext2D,
  conditions: AZVCondition[],
  style: AZVResolvedTextStyle,
  box: { x: number; y: number; w: number; h: number },
): Promise<void> {
  const { height: rowH, iconSize, gap } = AZV_LAYOUT.conditionRow;
  const rows = conditions.slice(0, 2);
  const size = fitAZVConditionsSize(rows, style, box);
  const family = jmFontFamily(style.font);
  const color = colorHex(style.color);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  // Rows centered as a group, whatever the count.
  let centerY = box.y + (box.h - rows.length * rowH) / 2 + rowH / 2 + style.offsetY;
  for (const c of rows) {
    const { labelW, total } = measureConditionRow(ctx, c, style, size);
    let x = box.x + (box.w - total) / 2;

    ctx.font = `bold ${size}px ${family}`;
    ctx.fillStyle = color;
    ctx.fillText(conditionLabel(c), x, centerY + cssCenterBaseline(ctx));
    x += labelW + gap;

    try {
      const icon = await loadImage(weaponIconPath(c.weapon));
      ctx.drawImage(icon, x, centerY - iconSize / 2, iconSize, iconSize);
    } catch (err) {
      console.warn("[azv] condition icon failed to load:", err);
    }
    x += iconSize + gap;

    const note = c.conditionDescription?.trim() ?? "";
    if (note) {
      ctx.font = fontString(style, size);
      ctx.fillStyle = color;
      ctx.fillText(note, x, centerY + cssCenterBaseline(ctx));
    }
    centerY += rowH;
  }
}

const slotBox = (slot: { cx: number; cy: number; size: number }) => ({
  x: slot.cx - slot.size / 2,
  y: slot.cy - slot.size / 2,
  w: slot.size,
  h: slot.size,
});

/** Render the card; resolves to a lossless 900×1500 PNG blob. */
export async function renderAZVCard(input: AZVCardRenderInput): Promise<Blob> {
  const titleStyle = resolveAZVTextStyle("title", input.textStyles);
  const numbersStyle = resolveAZVTextStyle("numbers", input.textStyles);
  const descStyle = resolveAZVTextStyle("description", input.textStyles);
  await Promise.all([
    ensureJMFont(titleStyle.font),
    ensureJMFont(numbersStyle.font),
    ensureJMFont(descStyle.font),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  // Base — dark neutral so overlay-only cards still read as cards.
  ctx.fillStyle = "#111111";
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  if (input.backgroundImageURL) {
    drawCover(ctx, await loadImage(input.backgroundImageURL));
  }

  const overlaySrc = overlayForCard(input.cardType, {
    level: input.level,
    goodStuffType: input.goodStuffType,
  });
  if (overlaySrc) {
    ctx.drawImage(await loadImage(overlaySrc), 0, 0, CARD_W, CARD_H);
  }

  const title = input.title?.trim();
  if (title) {
    drawBoxedText(ctx, title, titleStyle, AZV_LAYOUT.title);
  }

  // A card carries conditions OR a description — conditions win the box.
  const conditions = input.conditions?.length ? input.conditions : null;
  const description = input.description?.trim();
  if (conditions) {
    await drawConditions(ctx, conditions, descStyle, AZV_LAYOUT.description);
  } else if (description) {
    drawWrappedText(ctx, description, descStyle, AZV_LAYOUT.description);
  }

  if (typeof input.hits === "number") {
    drawBoxedText(ctx, String(input.hits), numbersStyle, slotBox(AZV_LAYOUT.hits));
  }
  if (typeof input.hopeOrHunger === "number") {
    drawBoxedText(ctx, String(input.hopeOrHunger), numbersStyle, slotBox(AZV_LAYOUT.hopeHunger));
  }

  // Weapon badge — its own slot (types with a weapon have no hits number).
  if (input.weaponType) {
    const box = slotBox(AZV_LAYOUT.weaponBadge);
    try {
      const icon = await loadImage(weaponIconPath(input.weaponType));
      ctx.drawImage(icon, box.x, box.y, box.w, box.h);
    } catch (err) {
      console.warn("[azv] weapon icon failed to load:", err);
    }
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Card export failed"))),
      "image/png",
    );
  });
}
