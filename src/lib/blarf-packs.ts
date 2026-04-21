"use client";

import type { Timestamp } from "firebase/firestore";
import type { BlarfRoundData } from "@/app/games/blarf/blarfTypes";

// ─── Types ───────────────────────────────────────────────────

export interface BlarfPack {
  id: string;
  name: string;
  subtitle?: string;
  description?: string;
  coverImageURL: string;
  rounds: BlarfRoundData[];
  visibility: "official" | "private" | "shared";
  creatorId: string;
  creatorGamertag: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreateBlarfPackInput {
  name: string;
  coverImageURL: string;
  visibility: "official" | "private" | "shared";
  subtitle?: string;
  description?: string;
  rounds?: BlarfRoundData[];
}

// ─── Firestore Helpers ───────────────────────────────────────

async function getDb() {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore } = await import("firebase/firestore");
  const { app } = await initializeFirebase();
  return getFirestore(app);
}

// ─── CRUD ────────────────────────────────────────────────────

export async function createBlarfPack(
  input: CreateBlarfPackInput,
  userId: string,
  gamertag: string,
): Promise<BlarfPack> {
  const { collection, doc, setDoc, serverTimestamp } =
    await import("firebase/firestore");
  const db = await getDb();

  const ref = doc(collection(db, "blarfPacks"));
  const data = {
    name: input.name,
    coverImageURL: input.coverImageURL,
    rounds: input.rounds ?? [],
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

export async function getBlarfPack(
  packId: string,
): Promise<BlarfPack | null> {
  const { doc, getDoc } = await import("firebase/firestore");
  const db = await getDb();

  const snap = await getDoc(doc(db, "blarfPacks", packId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<BlarfPack, "id">) };
}

export async function getOfficialBlarfPacks(): Promise<BlarfPack[]> {
  const { collection, query, where, orderBy, getDocs } =
    await import("firebase/firestore");
  const db = await getDb();

  const q = query(
    collection(db, "blarfPacks"),
    where("visibility", "==", "official"),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BlarfPack, "id">) }));
}

export async function getMyBlarfPacks(
  userId: string,
): Promise<BlarfPack[]> {
  const { collection, query, where, orderBy, getDocs } =
    await import("firebase/firestore");
  const db = await getDb();

  const q = query(
    collection(db, "blarfPacks"),
    where("creatorId", "==", userId),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BlarfPack, "id">) }));
}

export async function getSharedBlarfPacks(): Promise<BlarfPack[]> {
  const { collection, query, where, orderBy, getDocs } =
    await import("firebase/firestore");
  const db = await getDb();

  const q = query(
    collection(db, "blarfPacks"),
    where("visibility", "==", "shared"),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BlarfPack, "id">) }));
}

export async function updateBlarfPack(
  packId: string,
  updates: Partial<Pick<BlarfPack, "name" | "subtitle" | "description" | "coverImageURL" | "visibility" | "rounds">>,
): Promise<void> {
  const { doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
  const db = await getDb();

  const data: Record<string, unknown> = { ...updates, updatedAt: serverTimestamp() };
  await updateDoc(doc(db, "blarfPacks", packId), data);
}

export async function deleteBlarfPack(packId: string): Promise<void> {
  const { doc, deleteDoc } = await import("firebase/firestore");
  const db = await getDb();
  await deleteDoc(doc(db, "blarfPacks", packId));
}

/** Add a round to a pack. Since rounds are objects, we read-modify-write. */
export async function addRoundToPack(
  packId: string,
  round: BlarfRoundData,
): Promise<void> {
  const { doc, getDoc, updateDoc, serverTimestamp } =
    await import("firebase/firestore");
  const db = await getDb();

  const ref = doc(db, "blarfPacks", packId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const existing = (snap.data()["rounds"] ?? []) as BlarfRoundData[];
  await updateDoc(ref, {
    rounds: [...existing, round],
    updatedAt: serverTimestamp(),
  });
}

/** Remove a round by index. */
export async function removeRoundFromPack(
  packId: string,
  roundIndex: number,
): Promise<void> {
  const { doc, getDoc, updateDoc, serverTimestamp } =
    await import("firebase/firestore");
  const db = await getDb();

  const ref = doc(db, "blarfPacks", packId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const existing = (snap.data()["rounds"] ?? []) as BlarfRoundData[];
  const updated = existing.filter((_, i) => i !== roundIndex);
  await updateDoc(ref, {
    rounds: updated,
    updatedAt: serverTimestamp(),
  });
}

/** Update a round at a specific index. */
export async function updateRoundInPack(
  packId: string,
  roundIndex: number,
  round: BlarfRoundData,
): Promise<void> {
  const { doc, getDoc, updateDoc, serverTimestamp } =
    await import("firebase/firestore");
  const db = await getDb();

  const ref = doc(db, "blarfPacks", packId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const existing = (snap.data()["rounds"] ?? []) as BlarfRoundData[];
  const updated = [...existing];
  updated[roundIndex] = round;
  await updateDoc(ref, {
    rounds: updated,
    updatedAt: serverTimestamp(),
  });
}
