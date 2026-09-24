"use client";

import { firebaseConfig } from "./firebase-config";
import { getPublicStorageUrl } from "./content";
import { FO13_CARD_H, FO13_CARD_W } from "@/app/games/fo13/packs/fo13CardSpec";

/** Field Office 13 cards are poker sized: 2.75" × 3.75" at 300 DPI. */

export const FO13_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

/** Returns an error message if invalid, otherwise `null`. */
export function validateFO13ImageFile(file: File): string | null {
  if (!file.type.startsWith("image/")) return "Please choose an image file.";
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return "Use JPEG, PNG, or WebP.";
  }
  if (file.size > MAX_UPLOAD_BYTES) return "Image must be 12MB or smaller.";
  return null;
}

async function uploadToPath(path: string, blob: Blob, contentType: string): Promise<string> {
  const { initializeFirebase } = await import("./firebase");
  const { getStorage, ref, uploadBytes } = await import("firebase/storage");

  const { app } = await initializeFirebase();
  const storage = getStorage(app);
  await uploadBytes(ref(storage, path), blob, { contentType });

  // Cache-buster: re-uploads to the same path must yield a NEW URL string,
  // or the doc update is a no-op and browsers keep the cached old image.
  return `${getPublicStorageUrl(firebaseConfig.storageBucket, path)}&t=${Date.now()}`;
}

/**
 * Upload Rank art, resized to exactly 825×1125 PNG (lossless — Rank cards are
 * the full artwork, with no background beneath to hide compression).
 * Path: fo13/cards/{cardId}/art.png
 */
export async function uploadFO13CardArt(cardId: string, blob: Blob): Promise<string> {
  const bmp = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(FO13_CARD_W, FO13_CARD_H);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(bmp, 0, 0, FO13_CARD_W, FO13_CARD_H);
  bmp.close();
  const resized = await canvas.convertToBlob({ type: "image/png" });
  return uploadToPath(`fo13/cards/${cardId}/art.png`, resized, "image/png");
}

/**
 * Upload a rendered card (lossless 825×1125 PNG) to `cards/{packId}/{name}.png`
 * — the shared print-cards storage area the deck zip is built from.
 */
export async function uploadFO13CardImage(
  packId: string,
  fileName: string,
  blob: Blob,
): Promise<string> {
  return uploadToPath(`cards/${packId}/${fileName}.png`, blob, "image/png");
}
