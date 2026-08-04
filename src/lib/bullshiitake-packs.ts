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
  /** Physical-card lookup prefix (max 2 chars, e.g. "B" → cards B-1, B-2…).
   * Copied onto every item in the pack so cards resolve without a pack read. */
  searchPrefix?: string;
  creatorId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Normalize a pack's card prefix: trimmed, uppercased, max 2 chars. */
export function normalizeSearchPrefix(raw: string): string {
  return raw.trim().toUpperCase().slice(0, 2);
}

/** Display label for a card: "B-35" when a prefix exists, else "#35". */
export function cardLabel(searchPrefix: string | undefined, searchID: number | undefined): string {
  if (searchID == null) return "";
  return searchPrefix ? `${searchPrefix}-${searchID}` : `#${searchID}`;
}

/** A story item. Lives in the TOP-LEVEL `bullshiitake` collection and
 * references its pack via `packId` (unlike bluffbox, where cards are an
 * array on the pack doc — story items are too big for that). */
export interface BullshiitakeItem {
  id: string;
  packId: string;
  /** Human-readable per-pack index. New items fill the lowest gap left by
   * deletions first, then take max-in-pack + 1. Read-only in the editor. */
  searchID?: number;
  /** The pack's card prefix at creation time (e.g. "B" → this card is B-12).
   * Set automatically from the pack; used for physical-card lookup. */
  searchPrefix?: string;
  title: string;
  bsType: BSType;
  storyText: string;
  /** Optional shortened version — the game prefers this over storyText when
   * set; the full story is kept alongside it. */
  shortText?: string;
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
  /** Back-office only: has a human approved the short form? Saved instantly
   * from the editor toggle (not part of the Save flow) and never read by the
   * game — unapproved shorts still play. */
  adminApproved?: boolean;
  creatorId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreateBullshiitakePackInput {
  name: string;
  iconURL?: string;
  /** Card prefix, max 2 chars (normalized before write). */
  searchPrefix?: string;
}

/** The authored fields of an item (everything but ids / ownership / timestamps). */
export interface BullshiitakeItemFields {
  title: string;
  bsType: BSType;
  storyText: string;
  shortText?: string;
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
  /** Back-office approval toggled before the story was first saved. */
  adminApproved?: boolean;
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
  const prefix = input.searchPrefix ? normalizeSearchPrefix(input.searchPrefix) : "";
  const data = {
    name: input.name,
    ...(input.iconURL ? { iconURL: input.iconURL } : {}),
    ...(prefix ? { searchPrefix: prefix } : {}),
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
  updates: Partial<Pick<BullshiitakePack, "name" | "iconURL" | "searchPrefix">>,
): Promise<void> {
  const { doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
  const db = await getDb();

  const data: Record<string, unknown> = { ...updates, updatedAt: serverTimestamp() };
  if (typeof updates.searchPrefix === "string") {
    data["searchPrefix"] = normalizeSearchPrefix(updates.searchPrefix);
  }
  await updateDoc(doc(db, "bullshiitakePacks", packId), data);
}

/** Set a pack's card prefix AND restamp every item in the pack with it, so
 * existing cards keep resolving (<prefix>-<searchID>) after a prefix change. */
export async function setPackSearchPrefix(packId: string, rawPrefix: string): Promise<void> {
  const { collection, query, where, getDocs, doc, updateDoc, writeBatch, serverTimestamp } =
    await import("firebase/firestore");
  const db = await getDb();
  const prefix = normalizeSearchPrefix(rawPrefix);

  await updateDoc(doc(db, "bullshiitakePacks", packId), {
    searchPrefix: prefix,
    updatedAt: serverTimestamp(),
  });

  const itemsSnap = await getDocs(
    query(collection(db, "bullshiitake"), where("packId", "==", packId)),
  );
  const CHUNK = 450;
  for (let i = 0; i < itemsSnap.docs.length; i += CHUNK) {
    const batch = writeBatch(db);
    for (const d of itemsSnap.docs.slice(i, i + CHUNK)) {
      batch.update(d.ref, { searchPrefix: prefix, updatedAt: serverTimestamp() });
    }
    await batch.commit();
  }
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

/** Live listener on a pack's items, sorted by searchID (card order). The
 * pack-detail authoring view uses this so simultaneous editors see each
 * other's changes (approval dots, new stories) in real time. */
export async function subscribeToItemsForPack(
  packId: string,
  onItems: (items: BullshiitakeItem[]) => void,
): Promise<() => void> {
  const { collection, query, where, onSnapshot } = await import("firebase/firestore");
  const db = await getDb();

  return onSnapshot(
    query(collection(db, "bullshiitake"), where("packId", "==", packId)),
    (snap) => {
      const items = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<BullshiitakeItem, "id">),
      }));
      items.sort((a, b) => (a.searchID ?? 0) - (b.searchID ?? 0));
      onItems(items);
    },
    (err) => console.error("[bullshiitake] items listener error:", err),
  );
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
    ["shortText", fields.shortText?.trim() ? fields.shortText : undefined],
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

  // Auto-assign the human-readable searchID: fill the lowest gap left by a
  // deletion first (deleted indexes stay reusable), else max-in-pack + 1.
  const siblings = await listItemsForPack(input.packId);
  const used = new Set(
    siblings.map((s) => s.searchID).filter((n): n is number => n != null && n > 0),
  );
  let searchID = 1;
  while (used.has(searchID)) searchID++;

  // Cards carry their pack's physical-card prefix (e.g. "B" → B-12).
  const pack = await getBullshiitakePack(input.packId);
  const searchPrefix = pack?.searchPrefix ?? "";

  const data = {
    ...(await itemFieldsData(input, false)),
    packId: input.packId,
    searchID,
    ...(searchPrefix ? { searchPrefix } : {}),
    ...(input.adminApproved ? { adminApproved: true } : {}),
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

/** Instant write of the back-office approval flag — fires the moment the
 * editor toggle flips, independent of the Save button. Deliberately NOT part
 * of BullshiitakeItemFields so the full-replace Save never clobbers it. */
export async function setBullshiitakeItemApproved(
  itemId: string,
  approved: boolean,
): Promise<void> {
  const { doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
  const db = await getDb();

  await updateDoc(doc(db, "bullshiitake", itemId), {
    adminApproved: approved,
    updatedAt: serverTimestamp(),
  });
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
