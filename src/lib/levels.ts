export interface UserLevel {
  id: string;
  level: number;
  title: string;
  iconRealisticURL: string | null;
  iconIsometricURL: string | null;
  minPoints: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

/**
 * Fetch all levels ordered by level number (ascending).
 * Ties broken by earliest createdAt.
 */
export async function getAllLevels(): Promise<UserLevel[]> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, collection, query, orderBy, getDocs } = await import("firebase/firestore");

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  const q = query(collection(db, "levels"), orderBy("level", "asc"), orderBy("createdAt", "asc"));
  const snap = await getDocs(q);

  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as UserLevel));
}

/**
 * Get a single level by its Firestore doc ID.
 */
export async function getLevelById(id: string): Promise<UserLevel | null> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, doc, getDoc } = await import("firebase/firestore");

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  const snap = await getDoc(doc(db, "levels", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as UserLevel;
}

/**
 * Get a level by its numeric level value.
 */
export async function getLevelByNumber(levelNum: number): Promise<UserLevel | null> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, collection, query, where, orderBy, limit, getDocs } = await import("firebase/firestore");

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  const q = query(
    collection(db, "levels"),
    where("level", "==", levelNum),
    orderBy("createdAt", "asc"),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0]!;
  return { id: d.id, ...d.data() } as UserLevel;
}

/**
 * Create a new level document.
 */
export async function createLevel(data: Omit<UserLevel, "id" | "createdAt" | "updatedAt">): Promise<string> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, collection, addDoc, serverTimestamp } = await import("firebase/firestore");

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  const docRef = await addDoc(collection(db, "levels"), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * Update an existing level document.
 */
export async function updateLevel(id: string, data: Partial<Omit<UserLevel, "id" | "createdAt">>): Promise<void> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, doc, updateDoc, serverTimestamp } = await import("firebase/firestore");

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  await updateDoc(doc(db, "levels", id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a level document.
 */
export async function deleteLevel(id: string): Promise<void> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, doc, deleteDoc } = await import("firebase/firestore");

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  await deleteDoc(doc(db, "levels", id));
}

/**
 * Upload a level icon to Firebase Storage.
 */
export async function uploadLevelIcon(
  file: File,
  levelId: string,
  iconType: "realistic" | "isometric",
): Promise<string> {
  const { initializeFirebase } = await import("./firebase");
  const { getStorage, ref, uploadBytes } = await import("firebase/storage");

  const { app } = await initializeFirebase();
  const storage = getStorage(app);

  const ext = file.type.split("/")[1] || "png";
  const storagePath = `level-icons/${levelId}/${iconType}.${ext}`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, file, {
    contentType: file.type,
    cacheControl: "public, max-age=31536000",
  });

  const bucket = storage.app.options.storageBucket;
  if (!bucket) throw new Error("Storage bucket not configured");

  const encodedPath = encodeURIComponent(storagePath);
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPath}?alt=media&t=${Date.now()}`;
}

/**
 * Helper: get icon URL for a level, preferring isometric.
 */
export function getLevelIconURL(level: UserLevel | null): string | null {
  if (!level) return null;
  return level.iconIsometricURL || level.iconRealisticURL || null;
}
