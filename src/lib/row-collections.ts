/**
 * Row collections — named, reusable bundles of content rows.
 *
 * A collection is just a name; its rows live in the `experiences` collection
 * joined by `rowCollectionId`. Pages reference a collection by id via a "rows"
 * segment. Mirrors featured-carousels.ts.
 *
 * Client-SDK writes, admin-gated by Firestore rules.
 */

import type {
  JMRowCollection,
  JMRowCollectionInput,
} from "./content-types";

const COLLECTION = "rowCollections";

export async function listRowCollections(): Promise<JMRowCollection[]> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, collection, getDocs } = await import(
    "firebase/firestore"
  );

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  const snap = await getDocs(collection(db, COLLECTION));
  const items = snap.docs.map(
    (d) => ({ id: d.id, ...d.data() }) as JMRowCollection,
  );
  items.sort((a, b) => a.name.localeCompare(b.name));
  return items;
}

export async function createRowCollection(
  input: JMRowCollectionInput,
  creatorId: string,
): Promise<JMRowCollection> {
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
  const docRef = await addDoc(collection(db, COLLECTION), data);
  return {
    id: docRef.id,
    ...data,
    createdAt: data.createdAt as unknown as import("firebase/firestore").Timestamp,
    updatedAt: data.updatedAt as unknown as import("firebase/firestore").Timestamp,
  } as JMRowCollection;
}

export async function renameRowCollection(id: string, name: string): Promise<void> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, doc, updateDoc, serverTimestamp } = await import(
    "firebase/firestore"
  );

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  await updateDoc(doc(db, COLLECTION, id), {
    name: name.trim(),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteRowCollection(id: string): Promise<void> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, doc, deleteDoc } = await import("firebase/firestore");

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  await deleteDoc(doc(db, COLLECTION, id));
}
