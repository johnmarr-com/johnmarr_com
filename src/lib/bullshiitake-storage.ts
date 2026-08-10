"use client";

import { firebaseConfig } from "./firebase-config";
import { getPublicStorageUrl } from "./content";

/** Pack icons are square; item banners are 2:1. */
const ICON_SIZE = 720;
const BANNER_WIDTH = 1200;
const BANNER_HEIGHT = 600;

/** `accept` value for Bull Shiitake icon / banner file inputs */
export const BS_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

/** Returns an error message if invalid, otherwise `null`. */
export function validateBullshiitakeImageFile(file: File): string | null {
  if (!file.type.startsWith("image/")) return "Please choose an image file.";
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return "Use JPEG, PNG, or WebP.";
  }
  if (file.size > MAX_UPLOAD_BYTES) return "Image must be 12MB or smaller.";
  return null;
}

/**
 * Resize an image blob to the given dimensions using an offscreen canvas,
 * returning a JPEG blob. Avoids uploading full-resolution images.
 */
async function resizeTo(blob: Blob, width: number, height: number): Promise<Blob> {
  const bmp = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0, width, height);
  bmp.close();
  return canvas.convertToBlob({ type: "image/jpeg", quality: 0.88 });
}

async function uploadToPath(
  path: string,
  blob: Blob,
  contentType = "image/jpeg",
): Promise<string> {
  const { initializeFirebase } = await import("./firebase");
  const { getStorage, ref, uploadBytes } = await import("firebase/storage");

  const { app } = await initializeFirebase();
  const storage = getStorage(app);
  const storageRef = ref(storage, path);

  await uploadBytes(storageRef, blob, { contentType });

  // Cache-buster: re-uploads to the same path must yield a NEW URL string,
  // or the doc update is a no-op and browsers keep the cached old image.
  return `${getPublicStorageUrl(firebaseConfig.storageBucket, path)}&t=${Date.now()}`;
}

/**
 * Upload a Bull Shiitake pack icon (square) to Firebase Storage.
 * Resizes to 720×720 first, then uploads and returns a permanent public URL.
 */
export async function uploadBullshiitakePackIcon(
  packId: string,
  blob: Blob,
): Promise<string> {
  const resized = await resizeTo(blob, ICON_SIZE, ICON_SIZE);
  return uploadToPath(`bullshiitake/packs/${packId}/icon.jpg`, resized);
}

/**
 * Upload a Bull Shiitake item banner (2:1) to Firebase Storage.
 * Resizes to 1200×600 first, then uploads and returns a permanent public URL.
 */
export async function uploadBullshiitakeItemImage(
  itemId: string,
  blob: Blob,
): Promise<string> {
  const resized = await resizeTo(blob, BANNER_WIDTH, BANNER_HEIGHT);
  return uploadToPath(`bullshiitake/items/${itemId}/banner.jpg`, resized);
}

/**
 * Upload a print-ready card render (900×1500 PNG) to `cards/{packId}/{name}.png`.
 * No resize — the canvas already produced exact print dimensions; PNG stays
 * lossless for print. Returns a cache-busted public URL.
 */
export async function uploadBullshiitakeCardImage(
  packId: string,
  fileName: string,
  blob: Blob,
): Promise<string> {
  return uploadToPath(`cards/${packId}/${fileName}.png`, blob, "image/png");
}

/** Proxy-fetch an ephemeral AI image URL as a Blob (same flow as bluffbox). */
export { fetchImageAsBlob } from "./bluffbox-storage";
