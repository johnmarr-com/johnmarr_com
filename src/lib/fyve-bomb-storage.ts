"use client";

/**
 * FYVE — Firebase Storage helpers for bomb images/audio.
 *
 * Storage paths:
 *   fyve-bombs/{bombId}/bomb.jpg
 *   fyve-bombs/{bombId}/bomb-audio.mp3
 */

import { getPublicStorageUrl } from "./content";

/** Resize + JPEG-compress a Blob using Canvas before uploading. */
function compressImage(blob: Blob, maxDim: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width >= height) {
          height = Math.round(height * (maxDim / width));
          width = maxDim;
        } else {
          width = Math.round(width * (maxDim / height));
          height = maxDim;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Canvas compression failed"))),
        "image/jpeg",
        quality,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image load failed"));
    };
    img.src = url;
  });
}

async function getStorage() {
  const { initializeFirebase } = await import("./firebase");
  const { getStorage: fbGetStorage } = await import("firebase/storage");
  const { app } = await initializeFirebase();
  return fbGetStorage(app);
}

/**
 * Upload bomb image to Firebase Storage.
 * Returns the permanent public URL.
 */
export async function uploadBombImage(
  bombId: string,
  blob: Blob,
): Promise<string> {
  const { ref, uploadBytes } = await import("firebase/storage");
  const storage = await getStorage();

  // Resize + compress (720px max, JPEG 25%)
  const compressed = await compressImage(blob, 720, 0.25);

  const path = `fyve-bombs/${bombId}/bomb.jpg`;
  const storageRef = ref(storage, path);

  await uploadBytes(storageRef, compressed, {
    contentType: "image/jpeg",
    cacheControl: "public, max-age=31536000",
  });

  return getPublicStorageUrl(storage.app.options.storageBucket ?? "", path);
}

/**
 * Upload bomb audio (mp3) to Firebase Storage.
 * Returns the permanent public URL.
 */
export async function uploadBombAudio(
  bombId: string,
  blob: Blob,
): Promise<string> {
  const { ref, uploadBytes } = await import("firebase/storage");
  const storage = await getStorage();

  const path = `fyve-bombs/${bombId}/bomb-audio.mp3`;
  const storageRef = ref(storage, path);

  await uploadBytes(storageRef, blob, {
    contentType: "audio/mpeg",
    cacheControl: "public, max-age=31536000",
  });

  return getPublicStorageUrl(storage.app.options.storageBucket ?? "", path);
}

/**
 * Delete all files for a bomb from Storage.
 */
export async function deleteBombFiles(bombId: string): Promise<void> {
  const { ref, listAll, deleteObject } = await import("firebase/storage");
  const storage = await getStorage();

  const folderRef = ref(storage, `fyve-bombs/${bombId}`);
  try {
    const result = await listAll(folderRef);
    await Promise.all(result.items.map((item) => deleteObject(item)));
  } catch {
    // Folder may not exist — that's fine
  }
}
