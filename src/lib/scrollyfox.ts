/**
 * ScrollyFox — template storage helpers.
 *
 * Templates are system-owned pre-fab segments authored via the ScrollyFox
 * editor (Save to Templates). They populate the Segment Selector when a
 * user creates a new ScrollyFox.
 */

import type { HeroContent, HeroLayout } from "@/app/scrollyfox/segments/HeroSegment";

import { getPublicStorageUrl } from "./content";

const TEMPLATES_COLLECTION = "scrollyfoxTemplates";

export interface HeroTemplateDoc {
  segment: "hero";
  layout: HeroLayout;
  content: HeroContent;
  createdBy: string;
}

/**
 * Upload a Hero template image to Firebase Storage and return a permanent
 * public URL. `slot` distinguishes desktop vs. mobile variants for the same
 * draft.
 */
export async function uploadHeroTemplateImage(
  file: File,
  slot: "desktop" | "mobile",
  draftId: string,
): Promise<string> {
  const { initializeFirebase } = await import("./firebase");
  const { getStorage, ref, uploadBytes } = await import("firebase/storage");

  const { app } = await initializeFirebase();
  const storage = getStorage(app);

  const ext = file.type.split("/")[1] || "jpg";
  const storagePath = `scrollyfox/templates/hero/${draftId}/${slot}.${ext}`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, file, {
    contentType: file.type,
    cacheControl: "public, max-age=31536000",
  });

  const bucket = storage.app.options.storageBucket;
  if (!bucket) throw new Error("Storage bucket not configured");

  const baseUrl = getPublicStorageUrl(bucket, storagePath);
  return `${baseUrl}&t=${Date.now()}`;
}

/**
 * Save a Hero template document to Firestore. Returns the new doc id.
 */
export async function saveHeroTemplate(
  layout: HeroLayout,
  content: HeroContent,
  createdBy: string,
): Promise<string> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, collection, addDoc, serverTimestamp } = await import("firebase/firestore");

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  const docRef = await addDoc(collection(db, TEMPLATES_COLLECTION), {
    segment: "hero",
    layout,
    content,
    createdBy,
    createdAt: serverTimestamp(),
  });

  return docRef.id;
}
