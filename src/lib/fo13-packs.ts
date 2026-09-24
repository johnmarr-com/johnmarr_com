"use client";

import type { Timestamp } from "firebase/firestore";
import { FO13_RANK_ART } from "@/app/games/fo13/packs/fo13CardSpec";

/**
 * Field Office 13 card packs.
 *
 * Deliberately smaller than AZV: four card types, no per-type field sets, no
 * style sets. A card is either a full-bleed Rank image or one typed line on
 * its type's fixed background.
 */

// ─── Types ───────────────────────────────────────────────────

export type FO13CardType = "Rank" | "Subject" | "Research" | "Footnote";

export const FO13_CARD_TYPES: FO13CardType[] = [
  "Rank",
  "Subject",
  "Research",
  "Footnote",
];

export const FO13_CARD_TYPE_LABELS: Record<FO13CardType, string> = {
  Rank: "Rank",
  Subject: "Subject",
  Research: "Research",
  Footnote: "Footnote",
};

/** The three types that carry a typed line on a fixed background. */
export const FO13_TEXT_CARD_TYPES: FO13CardType[] = [
  "Subject",
  "Research",
  "Footnote",
];

export function isFO13TextCard(cardType: FO13CardType): boolean {
  return cardType !== "Rank";
}

export interface FO13Pack {
  id: string;
  name: string;
  creatorId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * A card. Top-level `fo13` collection, referencing its pack via `packId`
 * (same shape as AZV). The background is NOT stored — it derives from
 * cardType (see fo13CardSpec).
 */
export interface FO13Card {
  id: string;
  packId: string;
  cardType: FO13CardType;
  /** Subject / Research / Footnote: the typed line (≤ 40 chars). */
  text?: string;
  /** Rank: the full-bleed 825×1125 art (bundled asset path or Storage URL). */
  imageURL?: string;
  /** Sort position within its type group. */
  order: number;
  /** Generated print card (825×1125 PNG in `cards/{packId}/`) — written by
   * Render, outside the Save flow so editing never clobbers it. */
  cardImageURL?: string;
  creatorId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** The authored fields of a card (everything but ids/ownership/timestamps). */
export interface FO13CardFields {
  cardType: FO13CardType;
  text?: string;
  imageURL?: string;
  order: number;
}

export interface CreateFO13CardInput extends FO13CardFields {
  packId: string;
  /** Pre-generated doc id — lets the builder upload art to
   * `fo13/cards/{cardId}/…` before the doc exists. */
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

/**
 * Create a pack, pre-seeded with its two Rank cards.
 *
 * Rank art ships with the game, so the pair exists from the moment a pack
 * does — the only cards left to author are the typed ones.
 */
export async function createFO13Pack(name: string, userId: string): Promise<FO13Pack> {
  const { collection, doc, setDoc, writeBatch, serverTimestamp } = await import(
    "firebase/firestore"
  );
  const db = await getDb();

  const ref = doc(collection(db, "fo13Packs"));
  const data = {
    name,
    creatorId: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, data);

  const batch = writeBatch(db);
  FO13_RANK_ART.forEach((art, i) => {
    batch.set(doc(collection(db, "fo13")), {
      packId: ref.id,
      cardType: "Rank" satisfies FO13CardType,
      imageURL: art,
      order: i,
      creatorId: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  await batch.commit();

  return {
    id: ref.id,
    ...data,
    createdAt: data.createdAt as unknown as Timestamp,
    updatedAt: data.updatedAt as unknown as Timestamp,
  };
}

/** All packs, newest first. Any authed user can read. */
export async function listFO13Packs(): Promise<FO13Pack[]> {
  const { collection, query, orderBy, getDocs } = await import("firebase/firestore");
  const db = await getDb();

  const q = query(collection(db, "fo13Packs"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FO13Pack, "id">) }));
}

export async function renameFO13Pack(packId: string, name: string): Promise<void> {
  const { doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
  const db = await getDb();
  await updateDoc(doc(db, "fo13Packs", packId), {
    name: name.trim(),
    updatedAt: serverTimestamp(),
  });
}

/** Delete a pack AND all of its cards. */
export async function deleteFO13Pack(packId: string): Promise<void> {
  const { collection, query, where, getDocs, doc, deleteDoc, writeBatch } = await import(
    "firebase/firestore"
  );
  const db = await getDb();

  const cardsSnap = await getDocs(query(collection(db, "fo13"), where("packId", "==", packId)));
  const CHUNK = 450;
  for (let i = 0; i < cardsSnap.docs.length; i += CHUNK) {
    const batch = writeBatch(db);
    for (const d of cardsSnap.docs.slice(i, i + CHUNK)) batch.delete(d.ref);
    await batch.commit();
  }
  await deleteDoc(doc(db, "fo13Packs", packId));
}

// ─── Card CRUD ───────────────────────────────────────────────

/** Live subscribe to a pack's cards, grouped-order first (type, then order). */
export async function subscribeToFO13Cards(
  packId: string,
  onCards: (cards: FO13Card[]) => void,
): Promise<() => void> {
  const { collection, query, where, onSnapshot } = await import("firebase/firestore");
  const db = await getDb();

  const q = query(collection(db, "fo13"), where("packId", "==", packId));
  return onSnapshot(q, (snap) => {
    const cards = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FO13Card, "id">) }));
    cards.sort((a, b) => {
      const byType =
        FO13_CARD_TYPES.indexOf(a.cardType) - FO13_CARD_TYPES.indexOf(b.cardType);
      if (byType !== 0) return byType;
      if (a.order !== b.order) return a.order - b.order;
      return (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0);
    });
    onCards(cards);
  });
}

/** Build the Firestore payload. `forUpdate` maps absent optionals to
 * deleteField() so clearing sticks. */
async function cardFieldsData(
  fields: FO13CardFields,
  forUpdate: boolean,
): Promise<Record<string, unknown>> {
  const { deleteField } = await import("firebase/firestore");
  const data: Record<string, unknown> = {
    cardType: fields.cardType,
    order: fields.order,
  };
  const optionals: [string, unknown][] = [
    ["text", fields.text?.trim() ? fields.text.trim() : undefined],
    ["imageURL", fields.imageURL || undefined],
  ];
  for (const [key, value] of optionals) {
    if (value !== undefined) data[key] = value;
    else if (forUpdate) data[key] = deleteField();
  }
  return data;
}

export async function createFO13Card(
  input: CreateFO13CardInput,
  userId: string,
): Promise<FO13Card> {
  const { collection, doc, setDoc, serverTimestamp } = await import("firebase/firestore");
  const db = await getDb();

  const ref = input.id ? doc(db, "fo13", input.id) : doc(collection(db, "fo13"));
  const data = {
    ...(await cardFieldsData(input, false)),
    packId: input.packId,
    creatorId: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, data);
  return { id: ref.id, ...(data as unknown as Omit<FO13Card, "id">) };
}

/** Full replace of the authored fields (cleared optionals are removed). */
export async function updateFO13Card(cardId: string, fields: FO13CardFields): Promise<void> {
  const { doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
  const db = await getDb();
  await updateDoc(doc(db, "fo13", cardId), {
    ...(await cardFieldsData(fields, true)),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteFO13Card(cardId: string): Promise<void> {
  const { doc, deleteDoc } = await import("firebase/firestore");
  const db = await getDb();
  await deleteDoc(doc(db, "fo13", cardId));
}

/** Record a freshly rendered card image (outside the Save flow). */
export async function setFO13CardImage(cardId: string, cardImageURL: string): Promise<void> {
  const { doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
  const db = await getDb();
  await updateDoc(doc(db, "fo13", cardId), {
    cardImageURL,
    updatedAt: serverTimestamp(),
  });
}
