"use client";

/**
 * FYVE — Firebase Storage helpers for heist images.
 *
 * Storage paths:
 *   fyve-heists/{heistId}/background.jpg
 *   fyve-heists/{heistId}/target-object.jpg
 *   fyve-heists/{heistId}/asset-{index}.jpg
 *   fyve-heists/{heistId}/civilian-{index}.jpg
 *   fyve-heists/{heistId}/bomb.jpg
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

const v = () => Date.now().toString(36);

function storagePath(
  heistId: string,
  type: "background" | "target-object" | "asset" | "civilian" | "bomb",
  index?: number,
): string {
  switch (type) {
    case "background":
      return `fyve-heists/${heistId}/background-${v()}.jpg`;
    case "target-object":
      return `fyve-heists/${heistId}/target-object-${v()}.jpg`;
    case "asset":
      return `fyve-heists/${heistId}/asset-${index}-${v()}.jpg`;
    case "civilian":
      return `fyve-heists/${heistId}/civilian-${index}-${v()}.jpg`;
    case "bomb":
      return `fyve-heists/${heistId}/bomb-${v()}.jpg`;
  }
}

/**
 * Upload an image blob to Firebase Storage for a heist.
 * Returns the permanent public URL.
 */
export async function uploadFyveImage(
  heistId: string,
  type: "background" | "target-object" | "asset" | "civilian" | "bomb",
  blob: Blob,
  index?: number,
): Promise<string> {
  const { ref, uploadBytes } = await import("firebase/storage");
  const storage = await getStorage();

  // Resize + compress before uploading (backgrounds larger, card images 720)
  const maxDim = type === "background" ? 1280 : 720;
  const compressed = await compressImage(blob, maxDim, 0.25);

  const path = storagePath(heistId, type, index);
  const storageRef = ref(storage, path);

  await uploadBytes(storageRef, compressed, {
    contentType: "image/jpeg",
    cacheControl: "public, max-age=31536000",
  });

  // Build permanent URL from bucket + path
  return getPublicStorageUrl(storage.app.options.storageBucket ?? "", path);
}

/**
 * Upload an audio file to Firebase Storage for a heist element's bomb sound.
 * Returns the permanent public URL.
 */
export async function uploadFyveAudio(
  heistId: string,
  elementIndex: number,
  file: File,
): Promise<string> {
  const { ref, uploadBytes } = await import("firebase/storage");
  const storage = await getStorage();

  const ext = file.name.split(".").pop() ?? "mp3";
  const path = `fyve-heists/${heistId}/bomb-sound-${elementIndex}-${v()}.${ext}`;
  const storageRef = ref(storage, path);

  await uploadBytes(storageRef, file, {
    contentType: file.type || "audio/mpeg",
    cacheControl: "public, max-age=31536000",
  });

  return getPublicStorageUrl(storage.app.options.storageBucket ?? "", path);
}

/**
 * Delete all images for a heist from Storage.
 */
export async function deleteFyveHeistImages(heistId: string): Promise<void> {
  const { ref, listAll, deleteObject } = await import("firebase/storage");
  const storage = await getStorage();

  const folderRef = ref(storage, `fyve-heists/${heistId}`);
  try {
    const result = await listAll(folderRef);
    await Promise.all(result.items.map((item) => deleteObject(item)));
  } catch {
    // Folder may not exist — that's fine
  }
}
