"use client";

import type { AZVCardType } from "@/lib/azv-packs";
import { overlayForCard } from "./azvCardSpec";

/**
 * AZV print-card renderer — first pass: 900×1500 canvas with the card's
 * background image (cover-fit) under its auto-resolved foreground overlay.
 * Text/stat placement lands later, card type by card type.
 */

const CARD_W = 900;
const CARD_H = 1500;

export interface AZVCardRenderInput {
  cardType: AZVCardType;
  level?: number | undefined;
  backgroundImageURL?: string | undefined;
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

/** Render the card; resolves to a lossless 900×1500 PNG blob. */
export async function renderAZVCard(input: AZVCardRenderInput): Promise<Blob> {
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

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Card export failed"))),
      "image/png",
    );
  });
}
