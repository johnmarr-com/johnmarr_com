"use client";

import { firebaseConfig } from "./firebase-config";
import { getPublicStorageUrl } from "./content";

const TARGET_SIZE = 720;

/** `accept` value for cover file inputs */
export const BLARF_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

/** Returns an error message if invalid, otherwise `null`. */
export function validateBlarfImageFile(file: File): string | null {
  if (!file.type.startsWith("image/")) return "Please choose an image file.";
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return "Use JPEG, PNG, or WebP.";
  }
  if (file.size > MAX_UPLOAD_BYTES) return "Image must be 12MB or smaller.";
  return null;
}

/**
 * Resize an image blob to TARGET_SIZE × TARGET_SIZE using an offscreen canvas,
 * returning a JPEG blob.
 */
async function resizeToSquare(blob: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(TARGET_SIZE, TARGET_SIZE);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0, TARGET_SIZE, TARGET_SIZE);
  bmp.close();
  return canvas.convertToBlob({ type: "image/jpeg", quality: 0.88 });
}

/**
 * Upload a BLARF pack cover image to Firebase Storage.
 * Resizes to 720×720 first, then uploads and returns a permanent public URL.
 */
export async function uploadBlarfCover(
  packId: string,
  blob: Blob,
): Promise<string> {
  const resized = await resizeToSquare(blob);

  const { initializeFirebase } = await import("./firebase");
  const { getStorage, ref, uploadBytes } = await import("firebase/storage");

  const { app } = await initializeFirebase();
  const storage = getStorage(app);

  const path = `blarf-packs/${packId}/cover.jpg`;
  const storageRef = ref(storage, path);

  await uploadBytes(storageRef, resized, { contentType: "image/jpeg" });

  return getPublicStorageUrl(firebaseConfig.storageBucket, path);
}

/**
 * Fetch an image from an external URL and return it as a Blob.
 * Uses a server-side proxy to avoid CORS restrictions.
 */
export async function fetchBlarfImageAsBlob(url: string): Promise<Blob> {
  const { getAIAuthHeaders } = await import(
    "@/app/games/_gamecore/getAIAuthHeaders"
  );
  const headers = await getAIAuthHeaders();

  const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(url)}`;
  const res = await fetch(proxyUrl, { headers });
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  return res.blob();
}
