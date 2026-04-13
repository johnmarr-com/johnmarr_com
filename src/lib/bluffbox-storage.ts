"use client";

import { firebaseConfig } from "./firebase-config";
import { getPublicStorageUrl } from "./content";

const TARGET_SIZE = 720;

/** `accept` value for bluff cover / card file inputs */
export const BLUFF_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

/** Returns an error message if invalid, otherwise `null`. */
export function validateBluffImageFile(file: File): string | null {
  if (!file.type.startsWith("image/")) return "Please choose an image file.";
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return "Use JPEG, PNG, or WebP.";
  }
  if (file.size > MAX_UPLOAD_BYTES) return "Image must be 12MB or smaller.";
  return null;
}

/**
 * Resize an image blob to TARGET_SIZE × TARGET_SIZE using an offscreen canvas,
 * returning a JPEG blob. Avoids uploading full-resolution AI-generated images.
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
 * Upload a bluff pack cover or card image to Firebase Storage.
 * Resizes to 720×720 first, then uploads and returns a permanent public URL.
 */
export async function uploadBluffImage(
  packId: string,
  type: "cover" | "card",
  blob: Blob,
  /** @deprecated Ignored — each card upload uses a unique UUID filename. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for API compatibility
  _cardIndex?: number,
): Promise<string> {
  const resized = await resizeToSquare(blob);

  const { initializeFirebase } = await import("./firebase");
  const { getStorage, ref, uploadBytes } = await import("firebase/storage");

  const { app } = await initializeFirebase();
  const storage = getStorage(app);

  const uniqueCardId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

  const path =
    type === "cover"
      ? `bluffbox-packs/${packId}/cover.jpg`
      : `bluffbox-packs/${packId}/cards/${uniqueCardId}.jpg`;
  const storageRef = ref(storage, path);

  await uploadBytes(storageRef, resized, { contentType: "image/jpeg" });

  return getPublicStorageUrl(firebaseConfig.storageBucket, path);
}

/**
 * Fetch an image from an external URL and return it as a Blob.
 * Uses a server-side proxy to avoid CORS restrictions on ephemeral
 * image hosts (Ideogram, Replicate).
 */
export async function fetchImageAsBlob(url: string): Promise<Blob> {
  const { getAIAuthHeaders } = await import(
    "@/app/games/_gamecore/getAIAuthHeaders"
  );
  const headers = await getAIAuthHeaders();

  const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(url)}`;
  const res = await fetch(proxyUrl, { headers });
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  return res.blob();
}
