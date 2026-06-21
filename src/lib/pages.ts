/**
 * Pages — standalone, slug-addressed pages (optional feature banner + rows).
 *
 * A Page's `slug` IS its URL path (e.g. "watch", "watch/shows"). Rows live in
 * the existing `experiences` collection, scoped by `pageId`. The home page is
 * implicit (rows with no `pageId`), so this module is purely additive — it
 * touches none of the current home/experiences behavior.
 *
 * Client-SDK writes, admin-gated by Firestore rules (mirrors experiences).
 */

import type { JMPage, JMPageInput, JMPageUpdate } from "./content-types";

const PAGES_COLLECTION = "pages";

/**
 * First-path segments owned by existing routes. A page slug can't start with
 * one of these (the static route would shadow the catch-all resolver), so the
 * Pages admin should block them.
 */
export const RESERVED_SLUG_SEGMENTS = [
  "admin",
  "api",
  "auth",
  "about",
  "profile",
  "scrollyfox",
  "games",
  "artist",
  "story",
  "auction",
  "show",
  "p",
];

/**
 * Canonical slug: lowercased, no leading/trailing slash, each segment reduced
 * to [a-z0-9-], rejoined with "/". "  /Watch/Shows/ " → "watch/shows".
 */
export function normalizePageSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .map((seg) => seg.replace(/[^a-z0-9-]/g, ""))
    .filter(Boolean)
    .join("/");
}

export function firstSlugSegment(slug: string): string {
  return normalizePageSlug(slug).split("/")[0] ?? "";
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUG_SEGMENTS.includes(firstSlugSegment(slug));
}

export async function createPage(
  input: JMPageInput,
  creatorId: string,
): Promise<JMPage> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, collection, addDoc, serverTimestamp } = await import(
    "firebase/firestore"
  );

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  const data = {
    slug: normalizePageSlug(input.slug),
    title: input.title,
    ...(input.subtitle !== undefined ? { subtitle: input.subtitle } : {}),
    ...(input.featuredCarouselId
      ? { featuredCarouselId: input.featuredCarouselId }
      : {}),
    isPublished: input.isPublished ?? false,
    creatorId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, PAGES_COLLECTION), data);

  return {
    id: docRef.id,
    ...data,
    createdAt: data.createdAt as unknown as import("firebase/firestore").Timestamp,
    updatedAt: data.updatedAt as unknown as import("firebase/firestore").Timestamp,
  } as JMPage;
}

export async function getPage(pageId: string): Promise<JMPage | null> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, doc, getDoc } = await import("firebase/firestore");

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  const snap = await getDoc(doc(db, PAGES_COLLECTION, pageId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as JMPage) : null;
}

/** Look up a page by its canonical slug (input is normalized first). */
export async function getPageBySlug(slug: string): Promise<JMPage | null> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, collection, query, where, limit, getDocs } =
    await import("firebase/firestore");

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  const snap = await getDocs(
    query(
      collection(db, PAGES_COLLECTION),
      where("slug", "==", normalizePageSlug(slug)),
      limit(1),
    ),
  );
  const first = snap.docs[0];
  return first ? ({ id: first.id, ...first.data() } as JMPage) : null;
}

export async function listPages(): Promise<JMPage[]> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, collection, getDocs } = await import(
    "firebase/firestore"
  );

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  const snap = await getDocs(collection(db, PAGES_COLLECTION));
  const pages = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as JMPage);
  pages.sort((a, b) => a.slug.localeCompare(b.slug));
  return pages;
}

export async function updatePage(
  pageId: string,
  updates: JMPageUpdate,
): Promise<void> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, doc, updateDoc, serverTimestamp } = await import(
    "firebase/firestore"
  );

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  const clean: JMPageUpdate = { ...updates };
  if (typeof clean.slug === "string") clean.slug = normalizePageSlug(clean.slug);

  await updateDoc(doc(db, PAGES_COLLECTION, pageId), {
    ...clean,
    updatedAt: serverTimestamp(),
  });
}

export async function deletePage(pageId: string): Promise<void> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, doc, deleteDoc } = await import("firebase/firestore");

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  await deleteDoc(doc(db, PAGES_COLLECTION, pageId));
}
