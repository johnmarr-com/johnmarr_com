"use client";

import type { Timestamp } from "firebase/firestore";

// ─── Types ───────────────────────────────────────────────────

/** How true a Bull Shiitake story actually is. */
export type BSType = "true" | "partlytrue" | "bullshiitake";

export const BS_TYPE_LABELS: Record<BSType, string> = {
  true: "True",
  partlytrue: "Partly True",
  bullshiitake: "Bull Shiitake",
};

export interface BullshiitakePack {
  id: string;
  name: string;
  iconURL?: string;
  creatorId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** A story item. Lives in the TOP-LEVEL `bullshiitake` collection and
 * references its pack via `packId` (unlike bluffbox, where cards are an
 * array on the pack doc — story items are too big for that). */
export interface BullshiitakeItem {
  id: string;
  packId: string;
  /** Human-readable per-pack index (1..N, assigned in random order at import;
   * new items get max-in-pack + 1). Read-only in the editor. */
  searchID?: number;
  title: string;
  bsType: BSType;
  storyText: string;
  citations?: string[];
  /** Clarifying text — required reading when the story is Partly True. */
  correction?: string;
  /** 2:1 banner image. */
  imageURL?: string;
  /** AI prompt used to (re)generate the banner. When an item is created with
   * no image, a banner is auto-generated from this (or from an AI-derived
   * prompt when this is empty too). */
  imagePrompt?: string;
  /** Vimeo link (portrait orientation). */
  videoURL?: string;
  creatorId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreateBullshiitakePackInput {
  name: string;
  iconURL?: string;
}

/** The authored fields of an item (everything but ids / ownership / timestamps). */
export interface BullshiitakeItemFields {
  title: string;
  bsType: BSType;
  storyText: string;
  citations?: string[];
  correction?: string;
  imageURL?: string;
  imagePrompt?: string;
  videoURL?: string;
}

export interface CreateBullshiitakeItemInput extends BullshiitakeItemFields {
  packId: string;
  /** Pre-generated doc id — lets the editor upload the banner to
   * `bullshiitake/items/{itemId}/…` before the doc exists. */
  id?: string;
}

// ─── Firestore Helpers ───────────────────────────────────────

async function getDb() {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore } = await import("firebase/firestore");
  const { app } = await initializeFirebase();
  return getFirestore(app);
}

// ─── Pack CRUD ───────────────────────────────────────────────

export async function createBullshiitakePack(
  input: CreateBullshiitakePackInput,
  userId: string,
): Promise<BullshiitakePack> {
  const { collection, doc, setDoc, serverTimestamp } =
    await import("firebase/firestore");
  const db = await getDb();

  const ref = doc(collection(db, "bullshiitakePacks"));
  const data = {
    name: input.name,
    ...(input.iconURL ? { iconURL: input.iconURL } : {}),
    creatorId: userId,
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

export async function getBullshiitakePack(
  packId: string,
): Promise<BullshiitakePack | null> {
  const { doc, getDoc } = await import("firebase/firestore");
  const db = await getDb();

  const snap = await getDoc(doc(db, "bullshiitakePacks", packId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<BullshiitakePack, "id">) };
}

/** All packs, newest first. No visibility tiers — any authed user can read. */
export async function listBullshiitakePacks(): Promise<BullshiitakePack[]> {
  const { collection, query, orderBy, getDocs } =
    await import("firebase/firestore");
  const db = await getDb();

  const q = query(
    collection(db, "bullshiitakePacks"),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BullshiitakePack, "id">) }));
}

export async function updateBullshiitakePack(
  packId: string,
  updates: Partial<Pick<BullshiitakePack, "name" | "iconURL">>,
): Promise<void> {
  const { doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
  const db = await getDb();

  const data: Record<string, unknown> = { ...updates, updatedAt: serverTimestamp() };
  await updateDoc(doc(db, "bullshiitakePacks", packId), data);
}

/** Delete a pack AND all of its items (items live in the top-level collection). */
export async function deleteBullshiitakePack(packId: string): Promise<void> {
  const { collection, query, where, getDocs, doc, deleteDoc, writeBatch } =
    await import("firebase/firestore");
  const db = await getDb();

  const itemsSnap = await getDocs(
    query(collection(db, "bullshiitake"), where("packId", "==", packId)),
  );
  // Batched deletes (Firestore caps a batch at 500 writes).
  const CHUNK = 450;
  for (let i = 0; i < itemsSnap.docs.length; i += CHUNK) {
    const batch = writeBatch(db);
    for (const d of itemsSnap.docs.slice(i, i + CHUNK)) {
      batch.delete(d.ref);
    }
    await batch.commit();
  }

  await deleteDoc(doc(db, "bullshiitakePacks", packId));
}

// ─── Item CRUD ───────────────────────────────────────────────

/** Items for a pack, oldest first (authoring order). Sorted client-side so no
 * composite index (packId + createdAt) is required. */
export async function listItemsForPack(
  packId: string,
): Promise<BullshiitakeItem[]> {
  const { collection, query, where, getDocs } =
    await import("firebase/firestore");
  const db = await getDb();

  const snap = await getDocs(
    query(collection(db, "bullshiitake"), where("packId", "==", packId)),
  );
  const items = snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<BullshiitakeItem, "id">),
  }));
  items.sort((a, b) => (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0));
  return items;
}

/** Server-side aggregate count of items in a pack. */
export async function countItemsForPack(packId: string): Promise<number> {
  const { collection, query, where, getCountFromServer } =
    await import("firebase/firestore");
  const db = await getDb();

  const snap = await getCountFromServer(
    query(collection(db, "bullshiitake"), where("packId", "==", packId)),
  );
  return snap.data().count;
}

/** Build the Firestore payload for an item's authored fields.
 * `forUpdate` maps absent optionals to deleteField() so clearing sticks. */
async function itemFieldsData(
  fields: BullshiitakeItemFields,
  forUpdate: boolean,
): Promise<Record<string, unknown>> {
  const { deleteField } = await import("firebase/firestore");
  const absent = (): unknown => (forUpdate ? deleteField() : undefined);
  const data: Record<string, unknown> = {
    title: fields.title,
    bsType: fields.bsType,
    storyText: fields.storyText,
  };
  const optionals: [string, unknown][] = [
    ["citations", fields.citations?.length ? fields.citations : undefined],
    ["correction", fields.correction?.trim() ? fields.correction.trim() : undefined],
    ["imageURL", fields.imageURL ? fields.imageURL : undefined],
    ["imagePrompt", fields.imagePrompt?.trim() ? fields.imagePrompt.trim() : undefined],
    ["videoURL", fields.videoURL?.trim() ? fields.videoURL.trim() : undefined],
  ];
  for (const [key, value] of optionals) {
    if (value !== undefined) data[key] = value;
    else if (forUpdate) data[key] = absent();
  }
  return data;
}

export async function createBullshiitakeItem(
  input: CreateBullshiitakeItemInput,
  userId: string,
): Promise<BullshiitakeItem> {
  const { collection, doc, setDoc, serverTimestamp } =
    await import("firebase/firestore");
  const db = await getDb();

  const ref = input.id
    ? doc(db, "bullshiitake", input.id)
    : doc(collection(db, "bullshiitake"));

  // Auto-assign the human-readable searchID: highest in the pack + 1.
  const siblings = await listItemsForPack(input.packId);
  const searchID =
    siblings.reduce((max: number, s: BullshiitakeItem) => Math.max(max, s.searchID ?? 0), 0) + 1;

  const data = {
    ...(await itemFieldsData(input, false)),
    packId: input.packId,
    searchID,
    creatorId: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(ref, data);

  return {
    id: ref.id,
    ...(data as unknown as Omit<BullshiitakeItem, "id">),
  };
}

/** Full replace of the authored fields (cleared optionals are removed). */
export async function updateBullshiitakeItem(
  itemId: string,
  fields: BullshiitakeItemFields,
): Promise<void> {
  const { doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
  const db = await getDb();

  await updateDoc(doc(db, "bullshiitake", itemId), {
    ...(await itemFieldsData(fields, true)),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteBullshiitakeItem(itemId: string): Promise<void> {
  const { doc, deleteDoc } = await import("firebase/firestore");
  const db = await getDb();
  await deleteDoc(doc(db, "bullshiitake", itemId));
}
