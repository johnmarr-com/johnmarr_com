"use client";

/**
 * JohnMarr.com Content CRUD Operations
 * 
 * Firestore Collections:
 * - /content/{contentId} - All JMContent documents
 * - /experiences/{experienceId} - All JMExperience documents
 */

import type {
  JMContent,
  JMContentInput,
  JMContentUpdate,
  JMContentType,
  JMContentWithChildren,
  JMExperience,
  JMExperienceInput,
  JMExperienceUpdate,
  JMExperienceWithContent,
  JMContentCounts,
} from "./content-types";

// ─────────────────────────────────────────────────────────────
// CONTENT CRUD OPERATIONS
// ─────────────────────────────────────────────────────────────

/**
 * Create a new content item
 */
export async function createContent(
  input: JMContentInput,
  creatorId: string
): Promise<JMContent> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, collection, addDoc, serverTimestamp } = await import("firebase/firestore");
  
  const { app } = await initializeFirebase();
  const db = getFirestore(app);
  
  const contentData = {
    ...input,
    creatorId,
    parentId: input.parentId ?? null,
    order: input.order ?? 0,
    isPublished: input.isPublished ?? false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  
  const docRef = await addDoc(collection(db, "content"), contentData);
  
  return {
    id: docRef.id,
    ...contentData,
    createdAt: contentData.createdAt as unknown as import("firebase/firestore").Timestamp,
    updatedAt: contentData.updatedAt as unknown as import("firebase/firestore").Timestamp,
  } as JMContent;
}

/**
 * Get a single content item by ID
 */
export async function getContent(contentId: string): Promise<JMContent | null> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, doc, getDoc } = await import("firebase/firestore");
  
  const { app } = await initializeFirebase();
  const db = getFirestore(app);
  
  const docSnap = await getDoc(doc(db, "content", contentId));
  
  if (!docSnap.exists()) {
    return null;
  }
  
  return { id: docSnap.id, ...docSnap.data() } as JMContent;
}

/**
 * Update a content item
 */
export async function updateContent(
  contentId: string,
  updates: JMContentUpdate
): Promise<void> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
  
  const { app } = await initializeFirebase();
  const db = getFirestore(app);
  
  await updateDoc(doc(db, "content", contentId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a content item and all its children
 */
export async function deleteContent(contentId: string): Promise<void> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, doc, deleteDoc, collection, query, where, getDocs } = await import("firebase/firestore");
  
  const { app } = await initializeFirebase();
  const db = getFirestore(app);
  
  // First, recursively delete all children
  const childrenQuery = query(
    collection(db, "content"),
    where("parentId", "==", contentId)
  );
  const childrenSnap = await getDocs(childrenQuery);
  
  for (const childDoc of childrenSnap.docs) {
    await deleteContent(childDoc.id); // Recursive delete
  }
  
  // Then delete the content itself
  await deleteDoc(doc(db, "content", contentId));
}

/**
 * Get all top-level content (series and standalones) by type
 */
export async function getTopLevelContent(
  contentType?: JMContentType,
  publishedOnly: boolean = true
): Promise<JMContent[]> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, collection, query, where, orderBy, getDocs } = await import("firebase/firestore");
  
  const { app } = await initializeFirebase();
  const db = getFirestore(app);
  
  const constraints: Parameters<typeof query>[1][] = [
    where("parentId", "==", null),
    orderBy("order", "asc"),
  ];
  
  if (contentType) {
    constraints.unshift(where("contentType", "==", contentType));
  }
  
  if (publishedOnly) {
    constraints.unshift(where("isPublished", "==", true));
  }
  
  const q = query(collection(db, "content"), ...constraints);
  const querySnap = await getDocs(q);
  
  return querySnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as JMContent[];
}

/**
 * Get children of a content item (seasons or episodes)
 */
export async function getContentChildren(
  parentId: string,
  publishedOnly: boolean = true
): Promise<JMContent[]> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, collection, query, where, orderBy, getDocs } = await import("firebase/firestore");
  
  const { app } = await initializeFirebase();
  const db = getFirestore(app);
  
  const constraints: Parameters<typeof query>[1][] = [
    where("parentId", "==", parentId),
    orderBy("order", "asc"),
  ];
  
  if (publishedOnly) {
    constraints.unshift(where("isPublished", "==", true));
  }
  
  const q = query(collection(db, "content"), ...constraints);
  const querySnap = await getDocs(q);
  
  return querySnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as JMContent[];
}

/**
 * Get content with all nested children (for detail views)
 */
export async function getContentWithChildren(
  contentId: string,
  publishedOnly: boolean = true
): Promise<JMContentWithChildren | null> {
  const content = await getContent(contentId);
  
  if (!content) {
    return null;
  }
  
  if (!publishedOnly || content.isPublished) {
    const children = await getContentChildren(contentId, publishedOnly);
    
    // Recursively get children's children
    const childrenWithNested = await Promise.all(
      children.map(async (child) => {
        const nested = await getContentWithChildren(child.id, publishedOnly);
        return nested || child;
      })
    );
    
    const result: JMContentWithChildren = {
      ...content,
      children: childrenWithNested.length > 0 ? childrenWithNested : [],
    };
    return result;
  }
  
  return null;
}

/**
 * Get all content by creator (for admin)
 */
export async function getContentByCreator(
  creatorId: string,
  contentType?: JMContentType
): Promise<JMContent[]> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, collection, query, where, orderBy, getDocs } = await import("firebase/firestore");
  
  const { app } = await initializeFirebase();
  const db = getFirestore(app);
  
  const constraints: Parameters<typeof query>[1][] = [
    where("creatorId", "==", creatorId),
    orderBy("updatedAt", "desc"),
  ];
  
  if (contentType) {
    constraints.unshift(where("contentType", "==", contentType));
  }
  
  const q = query(collection(db, "content"), ...constraints);
  const querySnap = await getDocs(q);
  
  return querySnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as JMContent[];
}

/**
 * Get content counts by type (for admin dashboard)
 */
export async function getContentCounts(): Promise<JMContentCounts> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, collection, query, where, getCountFromServer } = await import("firebase/firestore");
  
  const { app } = await initializeFirebase();
  const db = getFirestore(app);
  
  const contentCol = collection(db, "content");
  
  // Only count top-level content (series/standalone)
  const [shows, stories, cards, games] = await Promise.all([
    getCountFromServer(query(contentCol, where("contentType", "==", "show"), where("parentId", "==", null))),
    getCountFromServer(query(contentCol, where("contentType", "==", "story"), where("parentId", "==", null))),
    getCountFromServer(query(contentCol, where("contentType", "==", "card"), where("parentId", "==", null))),
    getCountFromServer(query(contentCol, where("contentType", "==", "game"), where("parentId", "==", null))),
  ]);
  
  return {
    shows: shows.data().count,
    stories: stories.data().count,
    cards: cards.data().count,
    games: games.data().count,
    total: shows.data().count + stories.data().count + cards.data().count + games.data().count,
  };
}

/**
 * Search content by name (fuzzy search for admin)
 */
export async function searchContent(
  searchTerm: string,
  contentType?: JMContentType,
  limit: number = 20
): Promise<JMContent[]> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, collection, query, where, orderBy, getDocs, limit: firestoreLimit } = await import("firebase/firestore");
  
  const { app } = await initializeFirebase();
  const db = getFirestore(app);
  
  // Firestore doesn't support full-text search, so we do a prefix search
  // For better search, consider Algolia or Typesense integration
  
  const constraints: Parameters<typeof query>[1][] = [
    where("name", ">=", searchTerm),
    where("name", "<=", searchTerm + "\uf8ff"),
    orderBy("name"),
    firestoreLimit(limit),
  ];
  
  if (contentType) {
    constraints.unshift(where("contentType", "==", contentType));
  }
  
  const q = query(collection(db, "content"), ...constraints);
  const querySnap = await getDocs(q);
  
  return querySnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as JMContent[];
}

// ─────────────────────────────────────────────────────────────
// EXPERIENCE CRUD OPERATIONS
// ─────────────────────────────────────────────────────────────

/**
 * Create a new experience (content row)
 */
export async function createExperience(
  input: JMExperienceInput,
  creatorId: string
): Promise<JMExperience> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, collection, addDoc, serverTimestamp } = await import("firebase/firestore");
  
  const { app } = await initializeFirebase();
  const db = getFirestore(app);
  
  const experienceData = {
    ...input,
    creatorId,
    contentIds: input.contentIds ?? [],
    order: input.order ?? 0,
    isPublished: input.isPublished ?? false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  
  const docRef = await addDoc(collection(db, "experiences"), experienceData);
  
  return {
    id: docRef.id,
    ...experienceData,
    createdAt: experienceData.createdAt as unknown as import("firebase/firestore").Timestamp,
    updatedAt: experienceData.updatedAt as unknown as import("firebase/firestore").Timestamp,
  } as JMExperience;
}

/**
 * Get a single experience by ID
 */
export async function getExperience(experienceId: string): Promise<JMExperience | null> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, doc, getDoc } = await import("firebase/firestore");
  
  const { app } = await initializeFirebase();
  const db = getFirestore(app);
  
  const docSnap = await getDoc(doc(db, "experiences", experienceId));
  
  if (!docSnap.exists()) {
    return null;
  }
  
  return { id: docSnap.id, ...docSnap.data() } as JMExperience;
}

/**
 * Update an experience
 */
export async function updateExperience(
  experienceId: string,
  updates: JMExperienceUpdate
): Promise<void> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
  
  const { app } = await initializeFirebase();
  const db = getFirestore(app);
  
  await updateDoc(doc(db, "experiences", experienceId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete an experience
 */
export async function deleteExperience(experienceId: string): Promise<void> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, doc, deleteDoc } = await import("firebase/firestore");
  
  const { app } = await initializeFirebase();
  const db = getFirestore(app);
  
  await deleteDoc(doc(db, "experiences", experienceId));
}

/**
 * Get all experiences for the homepage
 */
export async function getExperiences(
  publishedOnly: boolean = true
): Promise<JMExperience[]> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, collection, query, where, orderBy, getDocs } = await import("firebase/firestore");
  
  const { app } = await initializeFirebase();
  const db = getFirestore(app);
  
  const constraints: Parameters<typeof query>[1][] = [
    orderBy("order", "asc"),
  ];
  
  if (publishedOnly) {
    constraints.unshift(where("isPublished", "==", true));
  }
  
  const q = query(collection(db, "experiences"), ...constraints);
  const querySnap = await getDocs(q);
  
  return querySnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as JMExperience[];
}

/**
 * Get an experience with resolved content items
 */
export async function getExperienceWithContent(
  experienceId: string,
  publishedOnly: boolean = true
): Promise<JMExperienceWithContent | null> {
  const experience = await getExperience(experienceId);
  
  if (!experience) {
    return null;
  }
  
  if (publishedOnly && !experience.isPublished) {
    return null;
  }
  
  let resolvedContent: JMContent[];
  
  // If autoPopulate is enabled and contentType is set, fetch all content of that type
  if (experience.autoPopulate && experience.contentType) {
    resolvedContent = await getTopLevelContent(experience.contentType, publishedOnly);
  } else {
    // Otherwise use the curated contentIds list
    const content = await Promise.all(
      experience.contentIds.map((id) => getContent(id))
    );
    
    // Filter out nulls and unpublished content
    resolvedContent = content.filter(
      (c): c is JMContent => c !== null && (!publishedOnly || c.isPublished)
    );
  }
  
  return {
    ...experience,
    content: resolvedContent,
  };
}

/**
 * Get all experiences with resolved content (for homepage)
 */
export async function getExperiencesWithContent(
  publishedOnly: boolean = true
): Promise<JMExperienceWithContent[]> {
  const experiences = await getExperiences(publishedOnly);
  
  const resolved = await Promise.all(
    experiences.map((exp) => getExperienceWithContent(exp.id, publishedOnly))
  );
  
  return resolved.filter((exp): exp is JMExperienceWithContent => exp !== null);
}

/**
 * Add content to an experience
 */
export async function addContentToExperience(
  experienceId: string,
  contentId: string
): Promise<void> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, doc, updateDoc, arrayUnion, serverTimestamp } = await import("firebase/firestore");
  
  const { app } = await initializeFirebase();
  const db = getFirestore(app);
  
  await updateDoc(doc(db, "experiences", experienceId), {
    contentIds: arrayUnion(contentId),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Remove content from an experience
 */
export async function removeContentFromExperience(
  experienceId: string,
  contentId: string
): Promise<void> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, doc, updateDoc, arrayRemove, serverTimestamp } = await import("firebase/firestore");
  
  const { app } = await initializeFirebase();
  const db = getFirestore(app);
  
  await updateDoc(doc(db, "experiences", experienceId), {
    contentIds: arrayRemove(contentId),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Reorder content within an experience
 */
export async function reorderExperienceContent(
  experienceId: string,
  contentIds: string[]
): Promise<void> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
  
  const { app } = await initializeFirebase();
  const db = getFirestore(app);
  
  await updateDoc(doc(db, "experiences", experienceId), {
    contentIds,
    updatedAt: serverTimestamp(),
  });
}

// ─────────────────────────────────────────────────────────────
// IMAGE UPLOAD OPERATIONS
// ─────────────────────────────────────────────────────────────

/**
 * Generate a permanent public URL for a Firebase Storage path
 * This URL doesn't expire (unlike getDownloadURL tokens)
 */
export function getPublicStorageUrl(bucket: string, path: string): string {
  const encodedPath = encodeURIComponent(path);
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPath}?alt=media`;
}

/**
 * Upload a content image (cover or backdrop) to Firebase Storage
 * Returns a permanent public URL
 * 
 * @param file - The image file to upload
 * @param contentId - The content ID (or "new-{timestamp}" for new content)
 * @param imageType - "cover" or "backdrop"
 */
export async function uploadContentImage(
  file: File,
  contentId: string,
  imageType: "cover" | "backdrop" = "cover"
): Promise<string> {
  const { initializeFirebase } = await import("./firebase");
  const { getStorage, ref, uploadBytes } = await import("firebase/storage");
  
  const { app } = await initializeFirebase();
  const storage = getStorage(app);
  
  // Generate file extension from mime type
  const ext = file.type.split("/")[1] || "jpg";
  
  // Storage path: content-images/{contentId}/{imageType}.{ext}
  const storagePath = `content-images/${contentId}/${imageType}.${ext}`;
  const storageRef = ref(storage, storagePath);
  
  // Upload the file
  await uploadBytes(storageRef, file, {
    contentType: file.type,
    cacheControl: "public, max-age=31536000", // Cache for 1 year
  });
  
  // Return permanent public URL with cache-busting timestamp
  const bucket = storage.app.options.storageBucket;
  if (!bucket) {
    throw new Error("Storage bucket not configured");
  }
  
  const baseUrl = getPublicStorageUrl(bucket, storagePath);
  // Add timestamp to bust browser cache when image is replaced
  return `${baseUrl}&t=${Date.now()}`;
}

/**
 * Delete a content image from Firebase Storage
 */
export async function deleteContentImage(
  contentId: string,
  imageType: "cover" | "backdrop" = "cover"
): Promise<void> {
  const { initializeFirebase } = await import("./firebase");
  const { getStorage, ref, deleteObject, listAll } = await import("firebase/storage");
  
  const { app } = await initializeFirebase();
  const storage = getStorage(app);
  
  // List all files in the content's image folder to find the right one
  const folderRef = ref(storage, `content-images/${contentId}`);
  
  try {
    const result = await listAll(folderRef);
    const targetFile = result.items.find(item => item.name.startsWith(imageType));
    
    if (targetFile) {
      await deleteObject(targetFile);
    }
  } catch (err) {
    // Ignore errors if file doesn't exist
    console.warn("Could not delete image:", err);
  }
}

// ─────────────────────────────────────────────────────────────
// FEATURED CONTENT
// ─────────────────────────────────────────────────────────────

export interface JMFeaturedItem {
  id: string;
  contentId: string;
  title: string;
  subtitle?: string;
  description?: string;
  backdropURL: string;
  contentType: JMContentType;
  order: number;
  isActive: boolean;
  createdAt: import("firebase/firestore").Timestamp;
  updatedAt: import("firebase/firestore").Timestamp;
}

export interface JMFeaturedInput {
  contentId: string;
  title: string;
  subtitle?: string;
  description?: string;
  backdropURL: string;
  contentType: JMContentType;
  order: number;
  isActive?: boolean;
}

interface FeaturedContentResult {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  backdropURL: string;
  contentId: string;
  contentType: "show" | "story" | "card" | "game";
}

/**
 * Get all active featured items, ordered by position
 * Returns items formatted for the carousel component
 */
export async function getFeaturedContent(): Promise<FeaturedContentResult[]> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, collection, query, where, orderBy, getDocs } = await import("firebase/firestore");
  
  const { app } = await initializeFirebase();
  const db = getFirestore(app);
  
  const featuredRef = collection(db, "featured");
  const q = query(
    featuredRef,
    where("isActive", "==", true),
    orderBy("order", "asc")
  );
  
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => {
    const data = doc.data() as JMFeaturedItem;
    const result: FeaturedContentResult = {
      id: doc.id,
      title: data.title,
      backdropURL: data.backdropURL,
      contentId: data.contentId,
      contentType: data.contentType,
    };
    if (data.subtitle) result.subtitle = data.subtitle;
    if (data.description) result.description = data.description;
    return result;
  });
}

/**
 * Get all featured items for admin (including inactive)
 */
export async function getAllFeaturedItems(): Promise<JMFeaturedItem[]> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, collection, query, orderBy, getDocs } = await import("firebase/firestore");
  
  const { app } = await initializeFirebase();
  const db = getFirestore(app);
  
  const featuredRef = collection(db, "featured");
  const q = query(featuredRef, orderBy("order", "asc"));
  
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as JMFeaturedItem));
}

/**
 * Create a new featured item
 */
export async function createFeaturedItem(
  input: JMFeaturedInput,
  creatorId: string
): Promise<string> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, collection, addDoc, serverTimestamp } = await import("firebase/firestore");
  
  const { app } = await initializeFirebase();
  const db = getFirestore(app);
  
  const featuredRef = collection(db, "featured");
  
  const docRef = await addDoc(featuredRef, {
    ...input,
    isActive: input.isActive ?? true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    creatorId,
  });
  
  return docRef.id;
}

/**
 * Update a featured item
 */
export async function updateFeaturedItem(
  id: string,
  updates: Partial<JMFeaturedInput>
): Promise<void> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
  
  const { app } = await initializeFirebase();
  const db = getFirestore(app);
  
  const docRef = doc(db, "featured", id);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a featured item
 */
export async function deleteFeaturedItem(id: string): Promise<void> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, doc, deleteDoc } = await import("firebase/firestore");
  
  const { app } = await initializeFirebase();
  const db = getFirestore(app);
  
  const docRef = doc(db, "featured", id);
  await deleteDoc(docRef);
}

/**
 * Reorder featured items
 */
export async function reorderFeaturedItems(
  orderedIds: string[]
): Promise<void> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, doc, writeBatch, serverTimestamp } = await import("firebase/firestore");
  
  const { app } = await initializeFirebase();
  const db = getFirestore(app);
  
  const batch = writeBatch(db);
  
  orderedIds.forEach((id, index) => {
    const docRef = doc(db, "featured", id);
    batch.update(docRef, { 
      order: index,
      updatedAt: serverTimestamp(),
    });
  });
  
  await batch.commit();
}

// ─────────────────────────────────────────────────────────────
// ALERT CRUD OPERATIONS
// ─────────────────────────────────────────────────────────────

import type { JMAlert, JMAlertInput, JMAlertUpdate, JMBrand, JMBrandInput, JMBrandUpdate } from "./content-types";

/**
 * Create a new alert (starts as draft/unpublished)
 */
export async function createAlert(input: JMAlertInput): Promise<JMAlert> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, collection, addDoc, serverTimestamp } = await import("firebase/firestore");
  
  const { app } = await initializeFirebase();
  const db = getFirestore(app);
  
  const alertData = {
    text: input.text,
    isPublished: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  
  const docRef = await addDoc(collection(db, "alerts"), alertData);
  
  return {
    id: docRef.id,
    ...alertData,
    createdAt: alertData.createdAt as unknown as import("firebase/firestore").Timestamp,
    updatedAt: alertData.updatedAt as unknown as import("firebase/firestore").Timestamp,
  } as JMAlert;
}

/**
 * Get all alerts (ordered by creation date, newest first)
 * Requires admin access - forces token refresh to ensure admin claim is sent
 */
export async function getAllAlerts(): Promise<JMAlert[]> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, collection, query, orderBy, getDocs } = await import("firebase/firestore");
  const { getAuth } = await import("firebase/auth");
  
  const { app } = await initializeFirebase();
  const db = getFirestore(app);
  
  // Force token refresh to ensure admin claim is sent with request
  const auth = getAuth(app);
  if (auth.currentUser) {
    await auth.currentUser.getIdToken(true);
  }
  
  const q = query(
    collection(db, "alerts"),
    orderBy("createdAt", "desc")
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as JMAlert[];
}

/**
 * Get the currently published alert (if any)
 */
export async function getPublishedAlert(): Promise<JMAlert | null> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, collection, query, where, getDocs, limit } = await import("firebase/firestore");
  
  const { app } = await initializeFirebase();
  const db = getFirestore(app);
  
  const q = query(
    collection(db, "alerts"),
    where("isPublished", "==", true),
    limit(1)
  );
  
  const snapshot = await getDocs(q);
  const alertDoc = snapshot.docs[0];
  
  if (!alertDoc) {
    return null;
  }
  
  return {
    id: alertDoc.id,
    ...alertDoc.data(),
  } as JMAlert;
}

/**
 * Update an alert
 */
export async function updateAlert(
  id: string,
  updates: JMAlertUpdate
): Promise<void> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
  
  const { app } = await initializeFirebase();
  const db = getFirestore(app);
  
  const docRef = doc(db, "alerts", id);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Publish an alert (and unpublish all others)
 */
export async function publishAlert(id: string): Promise<void> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, collection, doc, query, where, getDocs, writeBatch, serverTimestamp } = await import("firebase/firestore");
  
  const { app } = await initializeFirebase();
  const db = getFirestore(app);
  
  // Find all currently published alerts
  const q = query(
    collection(db, "alerts"),
    where("isPublished", "==", true)
  );
  const snapshot = await getDocs(q);
  
  const batch = writeBatch(db);
  
  // Unpublish all currently published alerts
  snapshot.docs.forEach(alertDoc => {
    batch.update(alertDoc.ref, { 
      isPublished: false,
      updatedAt: serverTimestamp(),
    });
  });
  
  // Publish the specified alert
  const targetRef = doc(db, "alerts", id);
  batch.update(targetRef, { 
    isPublished: true,
    updatedAt: serverTimestamp(),
  });
  
  await batch.commit();
}

/**
 * Unpublish an alert
 */
export async function unpublishAlert(id: string): Promise<void> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
  
  const { app } = await initializeFirebase();
  const db = getFirestore(app);
  
  const docRef = doc(db, "alerts", id);
  await updateDoc(docRef, {
    isPublished: false,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete an alert
 */
export async function deleteAlert(id: string): Promise<void> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, doc, deleteDoc } = await import("firebase/firestore");
  
  const { app } = await initializeFirebase();
  const db = getFirestore(app);
  
  const docRef = doc(db, "alerts", id);
  await deleteDoc(docRef);
}

// ─────────────────────────────────────────────────────────────
// BRAND CRUD OPERATIONS
// ─────────────────────────────────────────────────────────────

/**
 * Create a new brand
 */
export async function createBrand(
  input: JMBrandInput,
  creatorId: string
): Promise<JMBrand> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, collection, addDoc, serverTimestamp } = await import("firebase/firestore");
  
  const { app } = await initializeFirebase();
  const db = getFirestore(app);
  
  const brandData = {
    ...input,
    creatorId,
    isPublished: input.isPublished ?? false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  
  const docRef = await addDoc(collection(db, "brands"), brandData);
  
  return {
    id: docRef.id,
    ...brandData,
    createdAt: brandData.createdAt as unknown as import("firebase/firestore").Timestamp,
    updatedAt: brandData.updatedAt as unknown as import("firebase/firestore").Timestamp,
  } as JMBrand;
}

/**
 * Get a single brand by ID
 */
export async function getBrand(brandId: string): Promise<JMBrand | null> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, doc, getDoc } = await import("firebase/firestore");
  
  const { app } = await initializeFirebase();
  const db = getFirestore(app);
  
  const docSnap = await getDoc(doc(db, "brands", brandId));
  
  if (!docSnap.exists()) {
    return null;
  }
  
  return { id: docSnap.id, ...docSnap.data() } as JMBrand;
}

/**
 * Get all brands (for admin dropdown)
 */
export async function getAllBrands(publishedOnly: boolean = false): Promise<JMBrand[]> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, collection, query, where, orderBy, getDocs } = await import("firebase/firestore");
  const { getAuth } = await import("firebase/auth");
  
  const { app } = await initializeFirebase();
  const db = getFirestore(app);
  
  // Force token refresh if fetching all (including drafts)
  if (!publishedOnly) {
    const auth = getAuth(app);
    if (auth.currentUser) {
      await auth.currentUser.getIdToken(true);
    }
  }
  
  const constraints: Parameters<typeof query>[1][] = [
    orderBy("name", "asc"),
  ];
  
  if (publishedOnly) {
    constraints.unshift(where("isPublished", "==", true));
  }
  
  const q = query(collection(db, "brands"), ...constraints);
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as JMBrand[];
}

/**
 * Update a brand
 */
export async function updateBrand(
  brandId: string,
  updates: JMBrandUpdate
): Promise<void> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
  
  const { app } = await initializeFirebase();
  const db = getFirestore(app);
  
  await updateDoc(doc(db, "brands", brandId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a brand
 * Note: This doesn't delete associated content, just removes the brand
 */
export async function deleteBrand(brandId: string): Promise<void> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, doc, deleteDoc } = await import("firebase/firestore");
  
  const { app } = await initializeFirebase();
  const db = getFirestore(app);
  
  await deleteDoc(doc(db, "brands", brandId));
}

/**
 * Upload a brand logo to Firebase Storage
 * Returns a permanent public URL
 */
export async function uploadBrandLogo(
  file: File,
  brandId: string
): Promise<string> {
  const { initializeFirebase } = await import("./firebase");
  const { getStorage, ref, uploadBytes } = await import("firebase/storage");
  
  const { app } = await initializeFirebase();
  const storage = getStorage(app);
  
  const ext = file.type.split("/")[1] || "png";
  const storagePath = `brand-logos/${brandId}/logo.${ext}`;
  const storageRef = ref(storage, storagePath);
  
  await uploadBytes(storageRef, file, {
    contentType: file.type,
    cacheControl: "public, max-age=31536000",
  });
  
  const bucket = storage.app.options.storageBucket;
  if (!bucket) {
    throw new Error("Storage bucket not configured");
  }
  
  const baseUrl = getPublicStorageUrl(bucket, storagePath);
  return `${baseUrl}&t=${Date.now()}`;
}

/**
 * Get all content for a specific brand
 */
export async function getContentByBrand(
  brandId: string,
  publishedOnly: boolean = true
): Promise<JMContent[]> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, collection, query, where, orderBy, getDocs } = await import("firebase/firestore");
  
  const { app } = await initializeFirebase();
  const db = getFirestore(app);
  
  const constraints: Parameters<typeof query>[1][] = [
    where("brandId", "==", brandId),
    where("parentId", "==", null), // Only top-level content
    orderBy("order", "asc"),
  ];
  
  if (publishedOnly) {
    constraints.unshift(where("isPublished", "==", true));
  }
  
  const q = query(collection(db, "content"), ...constraints);
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as JMContent[];
}
