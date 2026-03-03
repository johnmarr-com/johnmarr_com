"use client";

/**
 * Story CRUD Operations
 *
 * Firestore Collections:
 * - /stories/{storyId} - Story documents
 * - /users/{userId}/story-settings/preferences - Reader preferences
 * - /users/{userId}/reading-progress/{storyId} - Per-story reading progress (EPUB CFI)
 */

import type {
  JMStory,
  JMStoryInput,
  JMStoryUpdate,
  JMStorySettings,
  JMReadingProgress,
} from "./content-types";

// ─────────────────────────────────────────────────────────────
// STORY CRUD
// ─────────────────────────────────────────────────────────────

export async function createStory(
  input: JMStoryInput,
  creatorId: string
): Promise<JMStory> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, collection, addDoc, serverTimestamp } = await import("firebase/firestore");

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  const storyData = {
    ...input,
    creatorId,
    isPublished: input.isPublished ?? false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, "stories"), storyData);

  return {
    id: docRef.id,
    ...storyData,
    createdAt: storyData.createdAt as unknown as import("firebase/firestore").Timestamp,
    updatedAt: storyData.updatedAt as unknown as import("firebase/firestore").Timestamp,
  } as JMStory;
}

export async function getStory(storyId: string): Promise<JMStory | null> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, doc, getDoc } = await import("firebase/firestore");

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  const docSnap = await getDoc(doc(db, "stories", storyId));
  if (!docSnap.exists()) return null;

  return { id: docSnap.id, ...docSnap.data() } as JMStory;
}

export async function getStoryBySlug(slug: string): Promise<JMStory | null> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, collection, query, where, getDocs, limit } = await import("firebase/firestore");

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  const q = query(
    collection(db, "stories"),
    where("isPublished", "==", true),
    where("slug", "==", slug),
    limit(1)
  );

  const snapshot = await getDocs(q);
  const storyDoc = snapshot.docs[0];
  if (!storyDoc) return null;

  return { id: storyDoc.id, ...storyDoc.data() } as JMStory;
}

export async function getAllStories(publishedOnly: boolean = false): Promise<JMStory[]> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, collection, query, where, orderBy, getDocs } = await import("firebase/firestore");

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  const constraints: Parameters<typeof query>[1][] = [
    orderBy("title", "asc"),
  ];

  if (publishedOnly) {
    constraints.unshift(where("isPublished", "==", true));
  }

  const q = query(collection(db, "stories"), ...constraints);
  const snapshot = await getDocs(q);

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as JMStory[];
}

export async function updateStory(
  storyId: string,
  updates: JMStoryUpdate
): Promise<void> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, doc, updateDoc, serverTimestamp } = await import("firebase/firestore");

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  await updateDoc(doc(db, "stories", storyId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteStory(storyId: string): Promise<void> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, doc, deleteDoc } = await import("firebase/firestore");

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  await deleteDoc(doc(db, "stories", storyId));
}

// ─────────────────────────────────────────────────────────────
// FILE UPLOADS (covers, thumbnails, EPUB)
// ─────────────────────────────────────────────────────────────

export async function uploadStoryCover(
  file: File,
  storyId: string
): Promise<string> {
  const { initializeFirebase } = await import("./firebase");
  const { getStorage, ref, uploadBytes } = await import("firebase/storage");
  const { getPublicStorageUrl } = await import("./content");

  const { app } = await initializeFirebase();
  const storage = getStorage(app);

  const ext = file.type.split("/")[1] || "jpg";
  const storagePath = `story-covers/${storyId}/cover.${ext}`;
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

export async function uploadStoryThumbnail(
  file: File,
  storyId: string
): Promise<string> {
  const { initializeFirebase } = await import("./firebase");
  const { getStorage, ref, uploadBytes } = await import("firebase/storage");
  const { getPublicStorageUrl } = await import("./content");

  const { app } = await initializeFirebase();
  const storage = getStorage(app);

  const ext = file.type.split("/")[1] || "jpg";
  const storagePath = `story-thumbnails/${storyId}/thumbnail.${ext}`;
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

export async function uploadStoryEpub(
  file: File,
  storyId: string
): Promise<string> {
  const { initializeFirebase } = await import("./firebase");
  const { getStorage, ref, uploadBytes } = await import("firebase/storage");
  const { getPublicStorageUrl } = await import("./content");

  const { app } = await initializeFirebase();
  const storage = getStorage(app);

  const storagePath = `story-epubs/${storyId}/book.epub`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, file, {
    contentType: "application/epub+zip",
    cacheControl: "public, max-age=31536000",
  });

  const bucket = storage.app.options.storageBucket;
  if (!bucket) throw new Error("Storage bucket not configured");

  const baseUrl = getPublicStorageUrl(bucket, storagePath);
  return `${baseUrl}&t=${Date.now()}`;
}

// ─────────────────────────────────────────────────────────────
// USER STORY SETTINGS
// ─────────────────────────────────────────────────────────────

const DEFAULT_STORY_SETTINGS: JMStorySettings = {
  fontSize: 18,
  darkMode: true,
};

export async function getStorySettings(userId: string): Promise<JMStorySettings> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, doc, getDoc } = await import("firebase/firestore");

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  const docSnap = await getDoc(doc(db, "users", userId, "story-settings", "preferences"));
  if (!docSnap.exists()) return DEFAULT_STORY_SETTINGS;

  return { ...DEFAULT_STORY_SETTINGS, ...docSnap.data() } as JMStorySettings;
}

export async function updateStorySettings(
  userId: string,
  settings: Partial<JMStorySettings>
): Promise<void> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, doc, setDoc } = await import("firebase/firestore");

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  await setDoc(doc(db, "users", userId, "story-settings", "preferences"), settings, { merge: true });
}

// ─────────────────────────────────────────────────────────────
// READING PROGRESS (EPUB CFI locations)
// ─────────────────────────────────────────────────────────────

export async function getReadingProgress(
  userId: string,
  storyId: string
): Promise<JMReadingProgress | null> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, doc, getDoc } = await import("firebase/firestore");

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  const docSnap = await getDoc(doc(db, "users", userId, "reading-progress", storyId));
  if (!docSnap.exists()) return null;

  return docSnap.data() as JMReadingProgress;
}

export async function updateReadingProgress(
  userId: string,
  storyId: string,
  location: string
): Promise<void> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, doc, setDoc, serverTimestamp } = await import("firebase/firestore");

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  await setDoc(doc(db, "users", userId, "reading-progress", storyId), {
    storyId,
    location,
    lastReadAt: serverTimestamp(),
  });
}
