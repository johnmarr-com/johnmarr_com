"use client";

import type { Timestamp } from "firebase/firestore";

// ─── Types ───────────────────────────────────────────────────

export interface WordonkulousPack {
  id: string;
  name: string;
  subtitle?: string;
  description?: string;
  coverImageURL: string;
  definitions: string[];
  visibility: "official" | "private" | "shared";
  creatorId: string;
  creatorGamertag: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreatePackInput {
  name: string;
  coverImageURL: string;
  visibility: "official" | "private" | "shared";
  subtitle?: string;
  description?: string;
}

// ─── Firestore Helpers ───────────────────────────────────────

async function getDb() {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore } = await import("firebase/firestore");
  const { app } = await initializeFirebase();
  return getFirestore(app);
}

// ─── CRUD ────────────────────────────────────────────────────

export async function createPack(
  input: CreatePackInput,
  userId: string,
  gamertag: string,
): Promise<WordonkulousPack> {
  const { collection, doc, setDoc, serverTimestamp } =
    await import("firebase/firestore");
  const db = await getDb();

  const ref = doc(collection(db, "wordonkulousPacks"));
  const data = {
    name: input.name,
    coverImageURL: input.coverImageURL,
    definitions: [],
    visibility: input.visibility,
    creatorId: userId,
    creatorGamertag: gamertag,
    ...(input.subtitle ? { subtitle: input.subtitle } : {}),
    ...(input.description ? { description: input.description } : {}),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(ref, data);

  return {
    id: ref.id,
    ...data,
    createdAt: data.createdAt as unknown as Timestamp,
    updatedAt: data.updatedAt as unknown as Timestamp,
  };
}

export async function getPack(
  packId: string,
): Promise<WordonkulousPack | null> {
  const { doc, getDoc } = await import("firebase/firestore");
  const db = await getDb();

  const snap = await getDoc(doc(db, "wordonkulousPacks", packId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<WordonkulousPack, "id">) };
}

export async function getOfficialPacks(): Promise<WordonkulousPack[]> {
  const { collection, query, where, orderBy, getDocs } =
    await import("firebase/firestore");
  const db = await getDb();

  const q = query(
    collection(db, "wordonkulousPacks"),
    where("visibility", "==", "official"),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WordonkulousPack, "id">) }));
}

export async function getMyPacks(
  userId: string,
): Promise<WordonkulousPack[]> {
  const { collection, query, where, orderBy, getDocs } =
    await import("firebase/firestore");
  const db = await getDb();

  const q = query(
    collection(db, "wordonkulousPacks"),
    where("creatorId", "==", userId),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WordonkulousPack, "id">) }));
}

export async function getSharedPacks(): Promise<WordonkulousPack[]> {
  const { collection, query, where, orderBy, getDocs } =
    await import("firebase/firestore");
  const db = await getDb();

  const q = query(
    collection(db, "wordonkulousPacks"),
    where("visibility", "==", "shared"),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WordonkulousPack, "id">) }));
}

export async function updatePack(
  packId: string,
  updates: Partial<Pick<WordonkulousPack, "name" | "subtitle" | "description" | "coverImageURL" | "visibility">>,
): Promise<void> {
  const { doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
  const db = await getDb();

  const data: Record<string, unknown> = { ...updates, updatedAt: serverTimestamp() };
  await updateDoc(doc(db, "wordonkulousPacks", packId), data);
}

export async function deletePack(packId: string): Promise<void> {
  const { doc, deleteDoc } = await import("firebase/firestore");
  const db = await getDb();
  await deleteDoc(doc(db, "wordonkulousPacks", packId));
}

export async function addDefinitionToPack(
  packId: string,
  definition: string,
): Promise<void> {
  const { doc, updateDoc, arrayUnion, serverTimestamp } =
    await import("firebase/firestore");
  const db = await getDb();

  await updateDoc(doc(db, "wordonkulousPacks", packId), {
    definitions: arrayUnion(definition),
    updatedAt: serverTimestamp(),
  });
}

export async function removeDefinitionFromPack(
  packId: string,
  definition: string,
): Promise<void> {
  const { doc, updateDoc, arrayRemove, serverTimestamp } =
    await import("firebase/firestore");
  const db = await getDb();

  await updateDoc(doc(db, "wordonkulousPacks", packId), {
    definitions: arrayRemove(definition),
    updatedAt: serverTimestamp(),
  });
}

export async function addDefinitionsToPack(
  packId: string,
  definitions: string[],
): Promise<void> {
  const { doc, updateDoc, arrayUnion, serverTimestamp } =
    await import("firebase/firestore");
  const db = await getDb();

  await updateDoc(doc(db, "wordonkulousPacks", packId), {
    definitions: arrayUnion(...definitions),
    updatedAt: serverTimestamp(),
  });
}
