"use client";

import { firebaseConfig } from "./firebase-config";
import { getPublicStorageUrl } from "./content";

/** AZV cards are tarot-print sized. */
const CARD_WIDTH = 900;
const CARD_HEIGHT = 1500;

export const AZV_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

/** Returns an error message if invalid, otherwise `null`. */
export function validateAZVImageFile(file: File): string | null {
  if (!file.type.startsWith("image/")) return "Please choose an image file.";
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return "Use JPEG, PNG, or WebP.";
  }
  if (file.size > MAX_UPLOAD_BYTES) return "Image must be 12MB or smaller.";
  return null;
}

async function uploadToPath(
  path: string,
  blob: Blob,
  contentType: string,
): Promise<string> {
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
 * Upload a card background, resized to exactly 900×1500 JPEG.
 * Path: azv/cards/{cardId}/bg.jpg
 */
export async function uploadAZVCardBackground(cardId: string, blob: Blob): Promise<string> {
  const bmp = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(CARD_WIDTH, CARD_HEIGHT);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0, CARD_WIDTH, CARD_HEIGHT);
  bmp.close();
  const resized = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.9 });
  return uploadToPath(`azv/cards/${cardId}/bg.jpg`, resized, "image/jpeg");
}

/**
 * Upload a generated card render (lossless 900×1500 PNG) to
 * `cards/{packId}/{name}.png` — the shared print-cards storage area.
 */
export async function uploadAZVCardImage(
  packId: string,
  fileName: string,
  blob: Blob,
): Promise<string> {
  return uploadToPath(`cards/${packId}/${fileName}.png`, blob, "image/png");
}
