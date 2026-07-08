/**
 * Grid collections — named, reusable grids of content shown as page segments.
 *
 * A grid holds a content selection (contentType + auto/curated ids, the same
 * model as a content row) plus display settings (cell aspect, caption styles,
 * per-device column counts). Pages reference one by id via a "grid" segment.
 * Mirrors featured-carousels.ts / row-collections.ts.
 *
 * Client-SDK writes, admin-gated by Firestore rules.
 */

import type {
  JMGridCollection,
  JMGridCollectionInput,
  JMGridCollectionUpdate,
} from "./content-types";

const COLLECTION = "gridCollections";

/** Sensible defaults for a fresh grid. */
export const DEFAULT_GRID: Omit<
  JMGridCollection,
  "id" | "name" | "creatorId" | "createdAt" | "updatedAt"
> = {
  contentIds: [],
  autoPopulate: false,
  cellAspect: "portrait",
  cellRadius: 12,
  textAlign: "center",
  showTitle: true,
  showSubtitle: false,
  title: { fontId: "helvetica", size: 16 },
  subtitle: { fontId: "helvetica", size: 13 },
  columns: { desktop: 4, tablet: 3, mobile: 2 },
  paddingY: { desktop: 0, tablet: 0, mobile: 0 },
  gap: 16,
  maxWidth: 0,
  maxWidthPercent: 0,
};

export async function listGridCollections(): Promise<JMGridCollection[]> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, collection, getDocs } = await import(
    "firebase/firestore"
  );

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  const snap = await getDocs(collection(db, COLLECTION));
  const items = snap.docs.map(
    (d) => ({ id: d.id, ...d.data() }) as JMGridCollection,
  );
  items.sort((a, b) => a.name.localeCompare(b.name));
  return items;
}

export async function createGridCollection(
  input: JMGridCollectionInput,
  creatorId: string,
): Promise<JMGridCollection> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, collection, addDoc, serverTimestamp } = await import(
    "firebase/firestore"
  );

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  const data = {
    name: input.name.trim(),
    ...DEFAULT_GRID,
    creatorId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const docRef = await addDoc(collection(db, COLLECTION), data);
  return {
    id: docRef.id,
    ...data,
    createdAt: data.createdAt as unknown as import("firebase/firestore").Timestamp,
    updatedAt: data.updatedAt as unknown as import("firebase/firestore").Timestamp,
  } as JMGridCollection;
}

export async function updateGridCollection(
  id: string,
  updates: JMGridCollectionUpdate,
): Promise<void> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, doc, updateDoc, serverTimestamp } = await import(
    "firebase/firestore"
  );

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  await updateDoc(doc(db, COLLECTION, id), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteGridCollection(id: string): Promise<void> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, doc, deleteDoc } = await import("firebase/firestore");

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  await deleteDoc(doc(db, COLLECTION, id));
}
