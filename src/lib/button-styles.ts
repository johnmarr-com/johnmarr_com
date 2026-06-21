/**
 * Button styles — named, reusable CTA pill styles (gradient + text color).
 *
 * ScrollyFox CTAs reference one by id (HeroContent.ctaButtonStyleId). When none
 * is selected, the built-in Pink-Purple default (the johnmarr brand) is used.
 * Mirrors featured-carousels.ts. Client-SDK writes, admin-gated by rules.
 */

import type { JMButtonStyle, JMButtonStyleInput } from "./content-types";

const COLLECTION = "buttonStyles";

/** Concrete values a CTA pill renders with. */
export interface ResolvedButtonStyle {
  from: string;
  to: string;
  angle: number;
  textColor: string;
}

/** johnmarr brand default — pink → purple, white label ("Wonka"). */
export const DEFAULT_BUTTON_STYLE: ResolvedButtonStyle = {
  from: "#FF36AB",
  to: "#8B35FF",
  angle: 135,
  textColor: "#FFFFFF",
};

/** Built-in gold pill (the classic feature-banner look) — solid gold, dark label. */
export const GOLD_BUTTON_STYLE: ResolvedButtonStyle = {
  from: "#FFD700",
  to: "#FFD700",
  angle: 135,
  textColor: "#000000",
};

/**
 * Sentinel ids for the built-in styles (not Firestore docs). "" / "pink-purple"
 * resolve to the Pink-Purple default; "gold" to the gold pill. Anything else is
 * a saved /buttonStyles doc id. There is a single source of truth per built-in,
 * so adjusting a constant updates every CTA that references it.
 */
export const BUILTIN_BUTTON_OPTIONS: { id: string; name: string }[] = [
  { id: "", name: "Pink-Purple (default)" },
  { id: "gold", name: "Gold" },
];

/** Resolve a built-in id to its pill colors, or null if it's a saved-doc id. */
export function resolveBuiltinStyle(id: string): ResolvedButtonStyle | null {
  if (!id || id === "pink-purple") return DEFAULT_BUTTON_STYLE;
  if (id === "gold") return GOLD_BUTTON_STYLE;
  return null;
}

/** Resolve a raw button-style doc (or nothing) into concrete render values. */
export function resolveButtonStyle(
  data:
    | { from?: unknown; to?: unknown; angle?: unknown; textColor?: unknown }
    | null
    | undefined,
): ResolvedButtonStyle {
  if (!data) return DEFAULT_BUTTON_STYLE;
  return {
    from: typeof data.from === "string" ? data.from : DEFAULT_BUTTON_STYLE.from,
    to: typeof data.to === "string" ? data.to : DEFAULT_BUTTON_STYLE.to,
    angle: typeof data.angle === "number" ? data.angle : DEFAULT_BUTTON_STYLE.angle,
    textColor:
      typeof data.textColor === "string"
        ? data.textColor
        : DEFAULT_BUTTON_STYLE.textColor,
  };
}

/**
 * Resolve an id to pill colors using an already-loaded list (client preview):
 * built-in first, then a saved doc, else the Pink-Purple default.
 */
export function resolveStyleFromList(
  id: string,
  styles: JMButtonStyle[],
): ResolvedButtonStyle {
  const builtin = resolveBuiltinStyle(id);
  if (builtin) return builtin;
  return resolveButtonStyle(styles.find((s) => s.id === id) ?? null);
}

export async function listButtonStyles(): Promise<JMButtonStyle[]> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, collection, getDocs } = await import("firebase/firestore");

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  const snap = await getDocs(collection(db, COLLECTION));
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as JMButtonStyle);
  items.sort((a, b) => a.name.localeCompare(b.name));
  return items;
}

export async function createButtonStyle(
  input: JMButtonStyleInput,
  creatorId: string,
): Promise<JMButtonStyle> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, collection, addDoc, serverTimestamp } = await import(
    "firebase/firestore"
  );

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  const data = {
    name: input.name.trim(),
    from: input.from,
    to: input.to,
    angle: input.angle ?? 135,
    textColor: input.textColor,
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
  } as JMButtonStyle;
}

export async function deleteButtonStyle(id: string): Promise<void> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, doc, deleteDoc } = await import("firebase/firestore");

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  await deleteDoc(doc(db, COLLECTION, id));
}
