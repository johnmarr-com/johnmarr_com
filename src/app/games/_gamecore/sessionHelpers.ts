/**
 * Shared Firestore session helpers used by all game session hooks.
 *
 * Provides lazy-initialized Firestore access and a typed
 * updateSessionFields helper with automatic updatedAt timestamps.
 */

async function getDb() {
  const { initializeFirebase } = await import("@/lib/firebase");
  const { getFirestore } = await import("firebase/firestore");
  const { app } = await initializeFirebase();
  return getFirestore(app);
}

export async function updateSessionFields(
  sessionId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const { doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
  const db = await getDb();
  await updateDoc(doc(db, "gameSessions", sessionId), {
    ...fields,
    updatedAt: serverTimestamp(),
  });
}
