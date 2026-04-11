"use client";

import { firebaseConfig } from "./firebase-config";
import { getPublicStorageUrl } from "./content";

/**
 * Upload a sketch image to Firebase Storage for a Mega Sketchy game session.
 * Returns a permanent public URL.
 */
export async function uploadSketch(
  sessionId: string,
  elementIdx: number,
  stepIdx: number,
  blob: Blob,
  round: number = 0,
): Promise<string> {
  const { initializeFirebase } = await import("./firebase");
  const { getStorage, ref, uploadBytes } = await import("firebase/storage");

  const { app } = await initializeFirebase();
  const storage = getStorage(app);

  const path = `game-sketches/${sessionId}/${round}/${elementIdx}_${stepIdx}.jpg`;
  const storageRef = ref(storage, path);

  await uploadBytes(storageRef, blob, { contentType: "image/jpeg" });

  return getPublicStorageUrl(firebaseConfig.storageBucket, path);
}
