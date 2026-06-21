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
