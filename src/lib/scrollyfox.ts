/**
 * ScrollyFox — document model + persistence.
 *
 * A ScrollyFox is a titled document: an ordered stack of segments. Each segment
 * has a type (only "hero" today) and its content. The authoring UI builds the
 * stack one segment at a time; every segment save persists the whole document
 * to the `scrollyfoxes` collection, so it appears on the ScrollyFox home list.
 */

import type { HeroContent } from "@/app/scrollyfox/segments/HeroSegment";

import { getPublicStorageUrl } from "./content";
import type { DeviceStyleLayers } from "./scrollyfox-style";

const DOCS_COLLECTION = "scrollyfoxes";

/** Segment types available in the builder. Only Hero today; ready to grow. */
export type SegmentType = "hero";

export interface ScrollyFoxSegment {
  /** Stable client-generated id — also the image storage folder for this segment. */
  id: string;
  type: SegmentType;
  /** Widen to a discriminated union once more segment types land. */
  content: HeroContent;
  /** Per-device style overrides on top of the ScrollyFox style. */
  style?: DeviceStyleLayers;
}

export interface ScrollyFoxDoc {
  /** Firestore id. `null` for a draft that has never been saved. */
  id: string | null;
  title: string;
  segments: ScrollyFoxSegment[];
  /** ScrollyFox-level style applied to every segment (per-device layers). */
  style: DeviceStyleLayers;
}

export interface ScrollyFoxListItem {
  id: string;
  title: string;
  segmentCount: number;
  /** ms epoch for sorting/display; `null` if not yet stamped. */
  updatedAt: number | null;
}

/** Client-side stable id for a new segment (and its image storage folder). */
export function newSegmentId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** A blank ScrollyFox draft (not yet persisted). */
export function emptyScrollyFox(): ScrollyFoxDoc {
  return { id: null, title: "", segments: [], style: {} };
}

/**
 * Strip `undefined` from Hero content so Firestore accepts the write
 * (the project's Firestore is not configured with `ignoreUndefinedProperties`).
 */
function normalizeHeroContent(content: HeroContent): HeroContent {
  return {
    layout: content.layout,
    imageUrl: content.imageUrl ?? null,
    imageMobileUrl: content.imageMobileUrl ?? null,
    imageAlt: content.imageAlt ?? "",
    title: content.title ?? "",
    subtitle: content.subtitle ?? "",
    ctas: (content.ctas ?? []).map((c) => ({
      label: c.label ?? "",
      href: c.href ?? "#",
    })),
  };
}

function normalizeSegment(segment: ScrollyFoxSegment): ScrollyFoxSegment {
  const out: ScrollyFoxSegment = {
    id: segment.id,
    type: segment.type,
    content: normalizeHeroContent(segment.content),
  };
  // Only store an override object when it carries layers (keeps docs lean and
  // avoids writing an empty map).
  if (segment.style && Object.keys(segment.style).length > 0) {
    out.style = segment.style;
  }
  return out;
}

/**
 * Upload a segment image to Firebase Storage and return a permanent public URL.
 * `slot` distinguishes desktop vs. mobile variants for the same segment.
 */
export async function uploadSegmentImage(
  file: File,
  slot: "desktop" | "mobile",
  segmentId: string,
): Promise<string> {
  const { initializeFirebase } = await import("./firebase");
  const { getStorage, ref, uploadBytes } = await import("firebase/storage");

  const { app } = await initializeFirebase();
  const storage = getStorage(app);

  const ext = file.type.split("/")[1] || "jpg";
  const storagePath = `scrollyfox/segments/${segmentId}/${slot}.${ext}`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, file, {
    contentType: file.type,
    cacheControl: "public, max-age=31536000",
  });

  const bucket = storage.app.options.storageBucket;
  if (!bucket) throw new Error("Storage bucket not configured");

  const baseUrl = getPublicStorageUrl(bucket, storagePath);
  return `${baseUrl}&t=${Date.now()}`;
}

/**
 * Create or update a ScrollyFox document. Returns the doc id (newly minted on
 * first save). Pass the current draft; the whole document is written each time.
 */
export async function saveScrollyFox(
  docData: ScrollyFoxDoc,
  createdBy: string,
): Promise<string> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, collection, addDoc, doc, setDoc, serverTimestamp } =
    await import("firebase/firestore");

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  const title = docData.title.trim() || "Untitled ScrollyFox";
  const segments = docData.segments.map(normalizeSegment);
  const style = docData.style ?? {};

  if (docData.id) {
    await setDoc(
      doc(db, DOCS_COLLECTION, docData.id),
      { title, segments, style, updatedAt: serverTimestamp() },
      { merge: true },
    );
    return docData.id;
  }

  const ref = await addDoc(collection(db, DOCS_COLLECTION), {
    title,
    segments,
    style,
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** List all ScrollyFoxes, newest first. Sorted client-side (no index needed). */
export async function listScrollyFoxes(): Promise<ScrollyFoxListItem[]> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, collection, getDocs } = await import(
    "firebase/firestore"
  );

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  const snap = await getDocs(collection(db, DOCS_COLLECTION));
  const items: ScrollyFoxListItem[] = snap.docs.map((d) => {
    const data = d.data() as {
      title?: string;
      segments?: unknown[];
      updatedAt?: { toMillis?: () => number };
    };
    return {
      id: d.id,
      title: data.title || "Untitled ScrollyFox",
      segmentCount: Array.isArray(data.segments) ? data.segments.length : 0,
      updatedAt: data.updatedAt?.toMillis?.() ?? null,
    };
  });

  items.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  return items;
}

/** Load a single ScrollyFox by id. Returns `null` if it doesn't exist. */
export async function loadScrollyFox(id: string): Promise<ScrollyFoxDoc | null> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, doc, getDoc } = await import("firebase/firestore");

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  const snap = await getDoc(doc(db, DOCS_COLLECTION, id));
  if (!snap.exists()) return null;

  const data = snap.data() as {
    title?: string;
    segments?: ScrollyFoxSegment[];
    style?: DeviceStyleLayers;
  };
  return {
    id: snap.id,
    title: data.title || "",
    segments: Array.isArray(data.segments) ? data.segments : [],
    style: data.style ?? {},
  };
}
