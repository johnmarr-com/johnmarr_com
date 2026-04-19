"use client";

/**
 * FYVE Heists — Firestore CRUD
 *
 * Collection: fyveHeists/{id}
 * Follows the same visibility pattern as bluffboxPacks / megasketchyMissions.
 */

import type { FyveHeist } from "@/app/games/fyve/fyveTypes";

// ─── Firestore helpers ──────────────────────────────────────

async function getDb() {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore } = await import("firebase/firestore");
  const { app } = await initializeFirebase();
  return getFirestore(app);
}

const COLLECTION = "fyveHeists";

// ─── Read ───────────────────────────────────────────────────

export async function getHeist(heistId: string): Promise<FyveHeist | null> {
  const { doc, getDoc } = await import("firebase/firestore");
  const db = await getDb();
  const snap = await getDoc(doc(db, COLLECTION, heistId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as FyveHeist;
}

export async function getOfficialHeists(): Promise<FyveHeist[]> {
  const { collection, query, where, orderBy, getDocs } = await import("firebase/firestore");
  const db = await getDb();
  const q = query(
    collection(db, COLLECTION),
    where("visibility", "==", "official"),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as FyveHeist)
    .filter((h) => !h.draft);
}

export async function getMyHeists(userId: string): Promise<FyveHeist[]> {
  const { collection, query, where, orderBy, getDocs } = await import("firebase/firestore");
  const db = await getDb();
  const q = query(
    collection(db, COLLECTION),
    where("creatorId", "==", userId),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FyveHeist);
}

export async function getSharedHeists(): Promise<FyveHeist[]> {
  const { collection, query, where, orderBy, getDocs } = await import("firebase/firestore");
  const db = await getDb();
  const q = query(
    collection(db, COLLECTION),
    where("visibility", "==", "shared"),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as FyveHeist)
    .filter((h) => !h.draft);
}

// ─── Create ─────────────────────────────────────────────────

export interface CreateHeistInput {
  title: string;
  briefing: string;
  backgroundImageUrl: string;
  targetObjectImageUrl: string;
  setting: FyveHeist["setting"];
  assets: FyveHeist["assets"];
  civilians: FyveHeist["civilians"];
  winMessage: string;
  words: FyveHeist["words"];
  visibility: FyveHeist["visibility"];
}

export async function createHeist(
  input: CreateHeistInput,
  userId: string,
  gamertag: string,
): Promise<FyveHeist> {
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
  } as FyveHeist;
}

// ─── Update ─────────────────────────────────────────────────

export async function updateHeist(
  heistId: string,
  fields: Partial<Omit<FyveHeist, "id" | "creatorId" | "creatorGamertag" | "createdAt">>,
): Promise<void> {
  const { doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
  const db = await getDb();
  await updateDoc(doc(db, COLLECTION, heistId), {
    ...fields,
    updatedAt: serverTimestamp(),
  });
}

// ─── Delete ─────────────────────────────────────────────────

export async function deleteHeist(heistId: string): Promise<void> {
  const { doc, deleteDoc } = await import("firebase/firestore");
  const db = await getDb();
  await deleteDoc(doc(db, COLLECTION, heistId));
}
