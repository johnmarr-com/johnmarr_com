"use client";

import type { Timestamp } from "firebase/firestore";

// ─── Types ───────────────────────────────────────────────────

export type AZVWeaponType = "Slimy" | "Sharp" | "Smelly" | "Sticky" | "Slamming";
export const AZV_WEAPON_TYPES: AZVWeaponType[] = [
  "Slimy",
  "Sharp",
  "Smelly",
  "Sticky",
  "Slamming",
];

/** Loot sub-kind, shared by Good Stuff and Mega Stuff — drives the overlay
 * and which stats the card carries. (Field name kept as `goodStuffType` for
 * data continuity.) */
export type AZVGoodStuffType = "Weapon" | "Armor" | "Energy";
export const AZV_GOOD_STUFF_TYPES: AZVGoodStuffType[] = ["Weapon", "Armor", "Energy"];

export type AZVConditionType = "Weakness" | "Resistant" | "Immune";
export const AZV_CONDITION_TYPES: AZVConditionType[] = [
  "Weakness",
  "Resistant",
  "Immune",
];

export type AZVCardType =
  | "Humans"
  | "Targets"
  | "BadStuff"
  | "GoodStuff"
  | "MegaStuff"
  | "GoodRoll"
  | "BadRoll"
  | "Levels"
  | "RoundCounter";
export const AZV_CARD_TYPES: AZVCardType[] = [
  "Humans",
  "Targets",
  "BadStuff",
  "GoodStuff",
  "MegaStuff",
  "GoodRoll",
  "BadRoll",
  "Levels",
  "RoundCounter",
];

export const AZV_CARD_TYPE_LABELS: Record<AZVCardType, string> = {
  Humans: "Humans",
  Targets: "Targets",
  BadStuff: "Bad Stuff",
  GoodStuff: "Good Stuff",
  MegaStuff: "Mega Stuff",
  GoodRoll: "Good Roll",
  BadRoll: "Bad Roll",
  Levels: "Levels",
  RoundCounter: "Round Counter",
};

/** One condition line: e.g. [Weakness, Slimy, 2]. */
export interface AZVCondition {
  condition: AZVConditionType;
  weapon: AZVWeaponType;
  value: number;
  /** Short plain-text note rendered after the weapon icon, e.g.
   * "Sticky (+1 to hit her)". */
  conditionDescription?: string;
}

export type AZVTextColor = "black" | "white";
export type AZVTextAlign = "left" | "center" | "right";
export type AZVTextWeight = "normal" | "bold";

/** Full style for one text role (font is a JMFonts registry id). */
export interface AZVTextStyle {
  font?: string;
  /** Font size in card pixels (used as the fit ceiling for boxed text). */
  size?: number;
  weight?: AZVTextWeight;
  color?: AZVTextColor;
  align?: AZVTextAlign;
  /** Vertical nudge in card pixels (+down / −up) — different fonts sit on
   * different baselines. */
  offsetY?: number;
}

/** The three text roles a card renders. */
export interface AZVTextStyles {
  title?: AZVTextStyle;
  description?: AZVTextStyle;
  numbers?: AZVTextStyle;
}

export interface AZVPack {
  id: string;
  name: string;
  iconURL?: string;
  creatorId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** A card. Lives in the TOP-LEVEL `azv` collection, referencing its pack via
 * `packId` (same shape as bullshiitake: cards are too rich for pack arrays).
 * The foreground overlay is NOT stored — it derives from cardType + level
 * (see azvCardSpec). */
export interface AZVCard {
  id: string;
  packId: string;
  cardType: AZVCardType;
  title: string;
  /** Good Stuff / Mega Stuff: Weapon | Armor | Energy. */
  goodStuffType?: AZVGoodStuffType;
  weaponType?: AZVWeaponType;
  /** BadStuff mall floors 1–5; loot (Good Stuff) is found on 1–4. */
  level?: number;
  hits?: number;
  hunger?: number;
  hope?: number;
  conditions?: AZVCondition[];
  description?: string;
  oneTimePower?: string;
  /** Pointer to the card's text style set (azvStyleSets doc id). Cards keep
   * the pointer only — editing a set restyles every card that points at it. */
  styleSetId?: string;
  /** 900×1500 background (Storage upload). */
  backgroundImageURL?: string;
  /** Generated print card (900×1500 PNG in `cards/{packId}/`) — written by
   * Generate, outside the Save flow so editing never clobbers it. */
  cardImageURL?: string;
  creatorId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** The authored fields of a card (everything but ids/ownership/timestamps). */
export interface AZVCardFields {
  cardType: AZVCardType;
  title: string;
  goodStuffType?: AZVGoodStuffType;
  weaponType?: AZVWeaponType;
  level?: number;
  hits?: number;
  hunger?: number;
  hope?: number;
  conditions?: AZVCondition[];
  description?: string;
  oneTimePower?: string;
  styleSetId?: string;
  backgroundImageURL?: string;
}

export interface CreateAZVCardInput extends AZVCardFields {
  packId: string;
  /** Pre-generated doc id — lets the builder upload the background to
   * `azv/cards/{cardId}/…` before the doc exists. */
  id?: string;
}

// ─── Firestore Helpers ───────────────────────────────────────

async function getDb() {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore } = await import("firebase/firestore");
  const { app } = await initializeFirebase();
  return getFirestore(app);
}

/** A named, reusable set of text styles ("style preset") — separate from
 * card data. Cards only remember concrete values; presets make loading a
 * look onto another card easy. */
export interface AZVStyleSet {
  id: string;
  name: string;
  styles: AZVTextStyles;
  creatorId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** All saved style sets, A→Z. */
export async function listAZVStyleSets(): Promise<AZVStyleSet[]> {
  const { collection, query, orderBy, getDocs } = await import("firebase/firestore");
  const db = await getDb();
  const snap = await getDocs(query(collection(db, "azvStyleSets"), orderBy("name")));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AZVStyleSet, "id">) }));
}

/** Save a style set — overwrites the set with the same name, else creates. */
export async function saveAZVStyleSet(
  name: string,
  styles: AZVTextStyles,
  userId: string,
): Promise<AZVStyleSet> {
  const { collection, query, where, getDocs, doc, setDoc, updateDoc, serverTimestamp } =
    await import("firebase/firestore");
  const db = await getDb();

  const trimmed = name.trim();
  const existing = await getDocs(
    query(collection(db, "azvStyleSets"), where("name", "==", trimmed)),
  );
  const found = existing.docs[0];
  if (found) {
    await updateDoc(found.ref, { styles, updatedAt: serverTimestamp() });
    return { id: found.id, ...(found.data() as Omit<AZVStyleSet, "id">), styles };
  }
  const ref = doc(collection(db, "azvStyleSets"));
  const data = {
    name: trimmed,
    styles,
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

// ─── Pack CRUD ───────────────────────────────────────────────

export async function createAZVPack(name: string, userId: string): Promise<AZVPack> {
  const { collection, doc, setDoc, serverTimestamp } = await import("firebase/firestore");
  const db = await getDb();

  const ref = doc(collection(db, "azvPacks"));
  const data = {
    name,
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

/** All packs, newest first. Any authed user can read. */
export async function listAZVPacks(): Promise<AZVPack[]> {
  const { collection, query, orderBy, getDocs } = await import("firebase/firestore");
  const db = await getDb();

  const q = query(collection(db, "azvPacks"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AZVPack, "id">) }));
}

export async function updateAZVPack(
  packId: string,
  updates: Partial<Pick<AZVPack, "name" | "iconURL">>,
): Promise<void> {
  const { doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
  const db = await getDb();
  await updateDoc(doc(db, "azvPacks", packId), { ...updates, updatedAt: serverTimestamp() });
}

/** Delete a pack AND all of its cards. */
export async function deleteAZVPack(packId: string): Promise<void> {
  const { collection, query, where, getDocs, doc, deleteDoc, writeBatch } =
    await import("firebase/firestore");
  const db = await getDb();

  const cardsSnap = await getDocs(query(collection(db, "azv"), where("packId", "==", packId)));
  const CHUNK = 450;
  for (let i = 0; i < cardsSnap.docs.length; i += CHUNK) {
    const batch = writeBatch(db);
    for (const d of cardsSnap.docs.slice(i, i + CHUNK)) batch.delete(d.ref);
    await batch.commit();
  }
  await deleteDoc(doc(db, "azvPacks", packId));
}

// ─── Card CRUD ───────────────────────────────────────────────

/** Live subscribe to a pack's cards, oldest first (authoring order). */
export async function subscribeToAZVCards(
  packId: string,
  onCards: (cards: AZVCard[]) => void,
): Promise<() => void> {
  const { collection, query, where, onSnapshot } = await import("firebase/firestore");
  const db = await getDb();

  const q = query(collection(db, "azv"), where("packId", "==", packId));
  return onSnapshot(q, (snap) => {
    const cards = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AZVCard, "id">) }));
    cards.sort((a, b) => (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0));
    onCards(cards);
  });
}

/** Build the Firestore payload for a card's authored fields.
 * `forUpdate` maps absent optionals to deleteField() so clearing sticks. */
async function cardFieldsData(
  fields: AZVCardFields,
  forUpdate: boolean,
): Promise<Record<string, unknown>> {
  const { deleteField } = await import("firebase/firestore");
  const data: Record<string, unknown> = {
    cardType: fields.cardType,
    title: fields.title,
  };
  const optionals: [string, unknown][] = [
    ["goodStuffType", fields.goodStuffType || undefined],
    ["weaponType", fields.weaponType || undefined],
    ["level", typeof fields.level === "number" ? fields.level : undefined],
    ["hits", typeof fields.hits === "number" ? fields.hits : undefined],
    ["hunger", typeof fields.hunger === "number" ? fields.hunger : undefined],
    ["hope", typeof fields.hope === "number" ? fields.hope : undefined],
    ["conditions", fields.conditions?.length ? fields.conditions : undefined],
    ["description", fields.description?.trim() ? fields.description.trim() : undefined],
    ["oneTimePower", fields.oneTimePower?.trim() ? fields.oneTimePower.trim() : undefined],
    ["styleSetId", fields.styleSetId || undefined],
    ["backgroundImageURL", fields.backgroundImageURL || undefined],
  ];
  for (const [key, value] of optionals) {
    if (value !== undefined) data[key] = value;
    else if (forUpdate) data[key] = deleteField();
  }
  return data;
}

export async function createAZVCard(
  input: CreateAZVCardInput,
  userId: string,
): Promise<AZVCard> {
  const { collection, doc, setDoc, serverTimestamp } = await import("firebase/firestore");
  const db = await getDb();

  const ref = input.id ? doc(db, "azv", input.id) : doc(collection(db, "azv"));
  const data = {
    ...(await cardFieldsData(input, false)),
    packId: input.packId,
    creatorId: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, data);
  return { id: ref.id, ...(data as unknown as Omit<AZVCard, "id">) };
}

/** Full replace of the authored fields (cleared optionals are removed). */
export async function updateAZVCard(cardId: string, fields: AZVCardFields): Promise<void> {
  const { doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
  const db = await getDb();
  await updateDoc(doc(db, "azv", cardId), {
    ...(await cardFieldsData(fields, true)),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteAZVCard(cardId: string): Promise<void> {
  const { doc, deleteDoc } = await import("firebase/firestore");
  const db = await getDb();
  await deleteDoc(doc(db, "azv", cardId));
}

/** Record a freshly generated card render (outside the Save flow). */
export async function setAZVCardImage(cardId: string, cardImageURL: string): Promise<void> {
  const { doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
  const db = await getDb();
  await updateDoc(doc(db, "azv", cardId), {
    cardImageURL,
    updatedAt: serverTimestamp(),
  });
}
