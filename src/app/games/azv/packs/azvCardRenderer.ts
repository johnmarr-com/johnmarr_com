"use client";

import { ensureJMFont, jmFontFamily } from "@/JMKit";
import type { AZVCardType, AZVWeaponType, AZVTextStyles } from "@/lib/azv-packs";
import {
  overlayForCard,
  weaponIconPath,
  resolveAZVTextStyle,
  type AZVResolvedTextStyle,
  AZV_LAYOUT,
} from "./azvCardSpec";

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
  level?: number | undefined;
  backgroundImageURL?: string | undefined;
  title?: string | undefined;
  hits?: number | undefined;
  /** Hope (Humans / GoodStuff / MegaStuff) or Hunger (BadStuff). */
  hopeOrHunger?: number | undefined;
  weaponType?: AZVWeaponType | undefined;
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
  ctx.textBaseline = "middle";
  const y = box.y + box.h / 2;
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
  await Promise.all([ensureJMFont(titleStyle.font), ensureJMFont(numbersStyle.font)]);

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

  const overlaySrc = overlayForCard(input.cardType, input.level);
  if (overlaySrc) {
    ctx.drawImage(await loadImage(overlaySrc), 0, 0, CARD_W, CARD_H);
  }

  const title = input.title?.trim();
  if (title) {
    drawBoxedText(ctx, title, titleStyle, AZV_LAYOUT.title);
  }

  if (typeof input.hits === "number") {
    drawBoxedText(ctx, String(input.hits), numbersStyle, slotBox(AZV_LAYOUT.hits));
  }
  if (typeof input.hopeOrHunger === "number") {
    drawBoxedText(ctx, String(input.hopeOrHunger), numbersStyle, slotBox(AZV_LAYOUT.hopeHunger));
  }

  // Weapon badge — occupies the hits slot (types with a weapon have no hits).
  if (input.weaponType) {
    const box = slotBox(AZV_LAYOUT.hits);
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
