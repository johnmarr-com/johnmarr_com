"use client";

import { ensureJMFont, jmFontFamily } from "@/JMKit";
import type { FO13CardType } from "@/lib/fo13-packs";
import {
  FO13_CARD_H,
  FO13_CARD_W,
  FO13_TEXT_BOX,
  FO13_TEXT_STYLE,
  backgroundForCard,
  fo13TextLines,
} from "./fo13CardSpec";

/**
 * Field Office 13 print-card renderer — 825×1125 canvas:
 *   Rank      → the card's own art, full bleed.
 *   otherwise → the type's fixed background + the typed line, wrapped and
 *               shrunk to fit its box, centred on both axes.
 *
 * `drawFO13Card` is what the live preview calls too, so the preview is not a
 * reconstruction of the output — it IS the output, at a smaller CSS size.
 */

export interface FO13CardRenderInput {
  cardType: FO13CardType;
  /** Subject / Research / Footnote. */
  text?: string | undefined;
  /** Rank art (bundled asset path, Storage URL, or object URL). */
  imageURL?: string | undefined;
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
  const scale = Math.max(FO13_CARD_W / img.width, FO13_CARD_H / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (FO13_CARD_W - w) / 2, (FO13_CARD_H - h) / 2, w, h);
}

const fontString = (size: number): string =>
  `${size}px ${jmFontFamily(FO13_TEXT_STYLE.fontId)}`;

/**
 * Baseline offset that vertically centres text the way CSS does: half the
 * font's line box (ascent − descent). Requires ctx.font to be set first.
 */
function centerBaseline(ctx: CanvasRenderingContext2D): number {
  const m = ctx.measureText("Mg");
  const ascent = m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent;
  const descent = m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent;
  return (ascent - descent) / 2;
}

/**
 * Greedy word-wrap at a given size; null when a single word overflows.
 *
 * Each forced segment wraps on its own, so an authored break always lands
 * where it was written and only the overflow inside a segment re-flows.
 */
function wrapAt(
  ctx: CanvasRenderingContext2D,
  segments: string[],
  size: number,
  maxWidth: number,
): string[] | null {
  ctx.font = fontString(size);
  const spaceW = ctx.measureText(" ").width;
  const lines: string[] = [];
  for (const segment of segments) {
    const words = segment.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      // A break with nothing between it and the next one: a blank line.
      lines.push("");
      continue;
    }
    let line = "";
    let lineW = 0;
    for (const word of words) {
      const w = ctx.measureText(word).width;
      if (w > maxWidth) return null;
      if (line && lineW + spaceW + w > maxWidth) {
        lines.push(line);
        line = word;
        lineW = w;
      } else {
        lineW += (line ? spaceW : 0) + w;
        line = line ? `${line} ${word}` : word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

/**
 * Largest size (≤ the design size) at which the wrapped text fits the box.
 * Exported so the character counter can warn before anything is rendered.
 */
export function fitFO13TextSize(text: string): number {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx || !text.trim()) return FO13_TEXT_STYLE.maxSize;
  const segments = fo13TextLines(text);
  let size = FO13_TEXT_STYLE.maxSize;
  while (size > 1) {
    const lines = wrapAt(ctx, segments, size, FO13_TEXT_BOX.w);
    if (lines && lines.length * size * FO13_TEXT_STYLE.lineHeight <= FO13_TEXT_BOX.h) break;
    size--;
  }
  return size;
}

/** Draw the typed line, wrapped and centred in its box. */
function drawTypedLine(ctx: CanvasRenderingContext2D, text: string): void {
  const trimmed = text.trim();
  if (!trimmed) return;

  const size = fitFO13TextSize(trimmed);
  const segments = fo13TextLines(trimmed);
  const lines = wrapAt(ctx, segments, size, FO13_TEXT_BOX.w) ?? segments;
  const step = size * FO13_TEXT_STYLE.lineHeight;

  ctx.font = fontString(size);
  ctx.fillStyle = FO13_TEXT_STYLE.color;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  const cx = FO13_TEXT_BOX.x + FO13_TEXT_BOX.w / 2;
  let y =
    FO13_TEXT_BOX.y +
    (FO13_TEXT_BOX.h - lines.length * step) / 2 +
    step / 2 +
    centerBaseline(ctx);

  for (const line of lines) {
    ctx.fillText(line, cx, y);
    y += step;
  }
  ctx.textAlign = "left";
}

/** Paint a card into an existing 825×1125 context (preview and export). */
export async function drawFO13Card(
  ctx: CanvasRenderingContext2D,
  input: FO13CardRenderInput,
): Promise<void> {
  await ensureJMFont(FO13_TEXT_STYLE.fontId);

  ctx.clearRect(0, 0, FO13_CARD_W, FO13_CARD_H);
  // Base — so a card with no art yet still reads as a card.
  ctx.fillStyle = "#111111";
  ctx.fillRect(0, 0, FO13_CARD_W, FO13_CARD_H);

  const background = backgroundForCard(input.cardType) ?? input.imageURL;
  if (background) {
    drawCover(ctx, await loadImage(background));
  }

  if (input.cardType !== "Rank" && input.text) {
    drawTypedLine(ctx, input.text);
  }
}

/** Render the card to a lossless 825×1125 PNG blob. */
export async function renderFO13Card(input: FO13CardRenderInput): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = FO13_CARD_W;
  canvas.height = FO13_CARD_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  await drawFO13Card(ctx, input);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Card export failed"))),
      "image/png",
    );
  });
}
