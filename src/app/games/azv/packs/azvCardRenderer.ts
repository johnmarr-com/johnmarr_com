"use client";

import { ensureJMFont, jmFontFamily } from "@/JMKit";
import type { AZVCardType, AZVWeaponType, AZVFontSettings } from "@/lib/azv-packs";
import { overlayForCard, weaponIconPath, AZV_LAYOUT } from "./azvCardSpec";

/**
 * AZV print-card renderer — 900×1500 canvas:
 *   background (cover-fit) → type/level overlay → title (fit-to-box, ≤60px)
 *   → hits number OR weapon badge at (212,1000) → hope/hunger at (684,1000).
 * Fonts + black/white colors come from the pack's fontSettings (JMFonts ids).
 * Description / conditions placement lands later, card type by card type.
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
  fonts?: AZVFontSettings | undefined;
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

const colorHex = (c: "black" | "white" | undefined): string =>
  c === "black" ? "#000000" : "#FFFFFF";

/**
 * Largest font size (≤ max, no minimum) at which the title fits its box.
 * Exported so the live preview sizes exactly like the final render.
 */
export function fitAZVTitleSize(title: string, fontFamily: string): number {
  const { w, h, maxFontSize } = AZV_LAYOUT.title;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx || !title.trim()) return maxFontSize;
  let size = Math.min(maxFontSize, h);
  while (size > 1) {
    ctx.font = `${size}px ${fontFamily}`;
    if (ctx.measureText(title).width <= w) break;
    size--;
  }
  return size;
}

/** Render the card; resolves to a lossless 900×1500 PNG blob. */
export async function renderAZVCard(input: AZVCardRenderInput): Promise<Blob> {
  const fonts = input.fonts ?? {};
  await Promise.all([ensureJMFont(fonts.title), ensureJMFont(fonts.numbers)]);

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

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Title — centered in its transparent box, fit to width (max 60).
  const title = input.title?.trim();
  if (title) {
    const family = jmFontFamily(fonts.title);
    const size = fitAZVTitleSize(title, family);
    ctx.font = `${size}px ${family}`;
    ctx.fillStyle = colorHex(fonts.titleColor);
    const box = AZV_LAYOUT.title;
    ctx.fillText(title, box.x + box.w / 2, box.y + box.h / 2);
  }

  // Numbers — fixed 60px, centered in their 125×125 slots.
  const numbersFamily = jmFontFamily(fonts.numbers);
  ctx.fillStyle = colorHex(fonts.numbersColor);
  if (typeof input.hits === "number") {
    ctx.font = `${AZV_LAYOUT.hits.fontSize}px ${numbersFamily}`;
    ctx.fillText(String(input.hits), AZV_LAYOUT.hits.cx, AZV_LAYOUT.hits.cy);
  }
  if (typeof input.hopeOrHunger === "number") {
    ctx.font = `${AZV_LAYOUT.hopeHunger.fontSize}px ${numbersFamily}`;
    ctx.fillText(String(input.hopeOrHunger), AZV_LAYOUT.hopeHunger.cx, AZV_LAYOUT.hopeHunger.cy);
  }

  // Weapon badge — occupies the hits slot (types with a weapon have no hits).
  if (input.weaponType) {
    const { cx, cy, size } = AZV_LAYOUT.hits;
    try {
      const icon = await loadImage(weaponIconPath(input.weaponType));
      ctx.drawImage(icon, cx - size / 2, cy - size / 2, size, size);
    } catch (err) {
      console.warn("[azv] weapon icon failed to load:", err);
    }
  }

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Card export failed"))),
      "image/png",
    );
  });
}
