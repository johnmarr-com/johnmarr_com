"use client";

/**
 * FYVE Bombs — Firestore CRUD
 *
 * Collection: fyveBombs/{id}
 * Follows the same visibility pattern as fyveHeists / bluffboxPacks.
 */

import type { FyveBombEntity } from "@/app/games/fyve/fyveTypes";

// ─── Firestore helpers ──────────────────────────────────────

async function getDb() {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore } = await import("firebase/firestore");
  const { app } = await initializeFirebase();
  return getFirestore(app);
}

const COLLECTION = "fyveBombs";

// ─── Read ───────────────────────────────────────────────────

export async function getBomb(bombId: string): Promise<FyveBombEntity | null> {
  const { doc, getDoc } = await import("firebase/firestore");
  const db = await getDb();
  const snap = await getDoc(doc(db, COLLECTION, bombId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as FyveBombEntity;
}

export async function getOfficialBombs(): Promise<FyveBombEntity[]> {
  const { collection, query, where, orderBy, getDocs } = await import("firebase/firestore");
  const db = await getDb();
  const q = query(
    collection(db, COLLECTION),
    where("visibility", "==", "official"),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FyveBombEntity);
}

export async function getMyBombs(userId: string): Promise<FyveBombEntity[]> {
  const { collection, query, where, orderBy, getDocs } = await import("firebase/firestore");
  const db = await getDb();
  const q = query(
    collection(db, COLLECTION),
    where("creatorId", "==", userId),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FyveBombEntity);
}

export async function getSharedBombs(): Promise<FyveBombEntity[]> {
  const { collection, query, where, orderBy, getDocs } = await import("firebase/firestore");
  const db = await getDb();
  const q = query(
    collection(db, COLLECTION),
    where("visibility", "==", "shared"),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FyveBombEntity);
}

// ─── Create ─────────────────────────────────────────────────

export interface CreateBombInput {
  name: string;
  imageUrl: string;
  audioUrl: string;
  visibility: "official" | "private" | "shared";
}

export async function createBomb(
  input: CreateBombInput,
  userId: string,
  gamertag: string,
): Promise<FyveBombEntity> {
  const { collection, doc, setDoc, serverTimestamp } = await import("firebase/firestore");
  const db = await getDb();

  const ref = doc(collection(db, COLLECTION));
  const data = {
    ...input,
    creatorId: userId,
    creatorGamertag: gamertag,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(ref, data);

  return {
    id: ref.id,
    ...input,
    creatorId: userId,
    creatorGamertag: gamertag,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  } as FyveBombEntity;
}

// ─── Update ─────────────────────────────────────────────────

export async function updateBomb(
  bombId: string,
  fields: Partial<Omit<FyveBombEntity, "id" | "creatorId" | "creatorGamertag" | "createdAt">>,
): Promise<void> {
  const { doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
  const db = await getDb();
  await updateDoc(doc(db, COLLECTION, bombId), {
    ...fields,
    updatedAt: serverTimestamp(),
  });
}

// ─── Delete ─────────────────────────────────────────────────

export async function deleteBomb(bombId: string): Promise<void> {
  const { doc, deleteDoc } = await import("firebase/firestore");
  const db = await getDb();
  await deleteDoc(doc(db, COLLECTION, bombId));
}
