"use client";

/**
 * SEVYN Bombs — Firestore CRUD
 *
 * Collection: sevynBombs/{id}
 * Follows the same visibility pattern as sevynHeists / bluffboxPacks.
 */

import type { SevynBombEntity } from "@/app/games/sevyn/sevynTypes";

// ─── Firestore helpers ──────────────────────────────────────

async function getDb() {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore } = await import("firebase/firestore");
  const { app } = await initializeFirebase();
  return getFirestore(app);
}

const COLLECTION = "sevynBombs";

// ─── Read ───────────────────────────────────────────────────

export async function getBomb(bombId: string): Promise<SevynBombEntity | null> {
  const { doc, getDoc } = await import("firebase/firestore");
  const db = await getDb();
  const snap = await getDoc(doc(db, COLLECTION, bombId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as SevynBombEntity;
}

export async function getOfficialBombs(): Promise<SevynBombEntity[]> {
  const { collection, query, where, orderBy, getDocs } = await import("firebase/firestore");
  const db = await getDb();
  const q = query(
    collection(db, COLLECTION),
    where("visibility", "==", "official"),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SevynBombEntity);
}

export async function getMyBombs(userId: string): Promise<SevynBombEntity[]> {
  const { collection, query, where, orderBy, getDocs } = await import("firebase/firestore");
  const db = await getDb();
  const q = query(
    collection(db, COLLECTION),
    where("creatorId", "==", userId),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SevynBombEntity);
}

export async function getSharedBombs(): Promise<SevynBombEntity[]> {
  const { collection, query, where, orderBy, getDocs } = await import("firebase/firestore");
  const db = await getDb();
  const q = query(
    collection(db, COLLECTION),
    where("visibility", "==", "shared"),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SevynBombEntity);
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
): Promise<SevynBombEntity> {
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
  } as SevynBombEntity;
}

// ─── Update ─────────────────────────────────────────────────

export async function updateBomb(
  bombId: string,
  fields: Partial<Omit<SevynBombEntity, "id" | "creatorId" | "creatorGamertag" | "createdAt">>,
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
