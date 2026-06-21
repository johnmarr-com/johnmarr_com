/**
 * Featured carousels — named, reusable feature banners.
 *
 * A carousel is just a name; its items live in the `featured` collection joined
 * by `carouselId`. The home banner is the implicit default carousel (items with
 * no carouselId), so this module is additive. Pages reference a carousel by id.
 *
 * Client-SDK writes, admin-gated by Firestore rules.
 */

import type {
  JMFeaturedCarousel,
  JMFeaturedCarouselInput,
} from "./content-types";

const CAROUSELS_COLLECTION = "featuredCarousels";

export async function listCarousels(): Promise<JMFeaturedCarousel[]> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, collection, getDocs } = await import(
    "firebase/firestore"
  );

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  const snap = await getDocs(collection(db, CAROUSELS_COLLECTION));
  const carousels = snap.docs.map(
    (d) => ({ id: d.id, ...d.data() }) as JMFeaturedCarousel,
  );
  carousels.sort((a, b) => a.name.localeCompare(b.name));
  return carousels;
}

export async function createCarousel(
  input: JMFeaturedCarouselInput,
  creatorId: string,
): Promise<JMFeaturedCarousel> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, collection, addDoc, serverTimestamp } = await import(
    "firebase/firestore"
  );

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  const data = {
    name: input.name.trim(),
    creatorId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const docRef = await addDoc(collection(db, CAROUSELS_COLLECTION), data);
  return {
    id: docRef.id,
    ...data,
    createdAt: data.createdAt as unknown as import("firebase/firestore").Timestamp,
    updatedAt: data.updatedAt as unknown as import("firebase/firestore").Timestamp,
  } as JMFeaturedCarousel;
}

export async function renameCarousel(id: string, name: string): Promise<void> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, doc, updateDoc, serverTimestamp } = await import(
    "firebase/firestore"
  );

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  await updateDoc(doc(db, CAROUSELS_COLLECTION, id), {
    name: name.trim(),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteCarousel(id: string): Promise<void> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, doc, deleteDoc } = await import("firebase/firestore");

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  await deleteDoc(doc(db, CAROUSELS_COLLECTION, id));
}
