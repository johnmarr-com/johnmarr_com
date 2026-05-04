"use client";

/**
 * Game Invite System
 *
 * Firestore Collection: /gameInvites/{inviteId}
 * Enables hosts to invite known players directly from the lobby.
 * Invitees see a real-time banner on the home page.
 */

import type { Timestamp } from "firebase/firestore";

export interface GameInvite {
  id: string;
  sessionId: string;
  gameSlug: string;
  engineSlug?: string;
  gameName: string;
  gameLogoURL: string;
  fromUid: string;
  fromGamertag: string;
  toUid: string;
  createdAt: Timestamp;
}

export interface KnownPlayer {
  uid: string;
  gamertag: string;
  avatarName: string | null;
}

async function getDb() {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore } = await import("firebase/firestore");
  const { app } = await initializeFirebase();
  return getFirestore(app);
}

/**
 * Send a game invite to a specific player.
 * Creates an invite doc and adds the UID to the session's pendingInviteUids.
 */
export async function sendGameInvite(
  sessionId: string,
  gameInfo: { gameSlug: string; gameName: string; gameLogoURL: string; engineSlug?: string },
  fromUid: string,
  fromGamertag: string,
  toUid: string,
): Promise<GameInvite> {
  const { collection, addDoc, doc, updateDoc, arrayUnion, serverTimestamp } =
    await import("firebase/firestore");
  const db = await getDb();

  const inviteData = {
    sessionId,
    gameSlug: gameInfo.gameSlug,
    ...(gameInfo.engineSlug != null && gameInfo.engineSlug !== ""
      ? { engineSlug: gameInfo.engineSlug }
      : {}),
    gameName: gameInfo.gameName,
    gameLogoURL: gameInfo.gameLogoURL,
    fromUid,
    fromGamertag,
    toUid,
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, "gameInvites"), inviteData);

  // Add to session's pending list
  await updateDoc(doc(db, "gameSessions", sessionId), {
    pendingInviteUids: arrayUnion(toUid),
  });

  return {
    id: docRef.id,
    ...inviteData,
    createdAt: inviteData.createdAt as unknown as Timestamp,
  };
}

/**
 * Remove a single invite (host cancels or player dismisses).
 */
export async function removeInvite(
  inviteId: string,
  sessionId: string,
  toUid: string,
): Promise<void> {
  const { doc, deleteDoc, updateDoc, arrayRemove } =
    await import("firebase/firestore");
  const db = await getDb();

  await deleteDoc(doc(db, "gameInvites", inviteId));
  await updateDoc(doc(db, "gameSessions", sessionId), {
    pendingInviteUids: arrayRemove(toUid),
  });
}

/**
 * Delete all invites for a session (called on game start / end).
 */
export async function deleteSessionInvites(
  sessionId: string,
): Promise<void> {
  const { collection, query, where, getDocs, deleteDoc } =
    await import("firebase/firestore");
  const db = await getDb();

  const q = query(
    collection(db, "gameInvites"),
    where("sessionId", "==", sessionId),
  );
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
}

/**
 * Subscribe to invites targeting a specific user (real-time).
 * Returns an unsubscribe function.
 */
export async function subscribeToMyInvites(
  uid: string,
  callback: (invites: GameInvite[]) => void,
): Promise<() => void> {
  const { collection, query, where, orderBy, onSnapshot } =
    await import("firebase/firestore");
  const db = await getDb();

  const q = query(
    collection(db, "gameInvites"),
    where("toUid", "==", uid),
    orderBy("createdAt", "desc"),
  );

  return onSnapshot(q, (snap) => {
    const invites = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<GameInvite, "id">),
    }));
    callback(invites);
  });
}

/**
 * Fetch public profiles (gamertag + avatarName) for a list of UIDs.
 *
 * Goes through /api/games/profiles (Admin SDK) because the user-doc read
 * rule restricts direct Firestore reads to the owner. This route exposes
 * only the public fields needed for invite UI.
 */
export async function fetchKnownPlayers(
  uids: string[],
): Promise<KnownPlayer[]> {
  if (uids.length === 0) return [];

  try {
    const { getAIAuthHeaders } = await import(
      "@/app/games/_gamecore/getAIAuthHeaders"
    );
    const headers = await getAIAuthHeaders();
    if (!("Authorization" in headers)) return [];

    const res = await fetch("/api/games/profiles", {
      method: "POST",
      headers,
      body: JSON.stringify({ uids }),
    });
    if (!res.ok) return [];

    const data = (await res.json()) as { profiles?: KnownPlayer[] };
    return data.profiles ?? [];
  } catch {
    return [];
  }
}

/**
 * Remove a pending invite by session + recipient UID.
 * Finds the invite doc, deletes it, and removes from pendingInviteUids.
 */
export async function removePendingInviteByUid(
  sessionId: string,
  toUid: string,
  fromUid: string,
): Promise<void> {
  const { collection, query, where, getDocs, deleteDoc, doc, updateDoc, arrayRemove } =
    await import("firebase/firestore");
  const db = await getDb();

  // Query must include fromUid so the caller satisfies the Firestore read
  // rule (which requires the reader to be the sender OR recipient).
  const q = query(
    collection(db, "gameInvites"),
    where("sessionId", "==", sessionId),
    where("toUid", "==", toUid),
    where("fromUid", "==", fromUid),
  );
  const snap = await getDocs(q);
  const inviteDoc = snap.docs[0];
  if (inviteDoc) {
    await deleteDoc(inviteDoc.ref);
  }
  await updateDoc(doc(db, "gameSessions", sessionId), {
    pendingInviteUids: arrayRemove(toUid),
  });
}

/**
 * Get a user's known player UIDs from their user doc.
 */
export async function getKnownPlayerUids(uid: string): Promise<string[]> {
  const { doc, getDoc } = await import("firebase/firestore");
  const db = await getDb();

  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return [];
  return (snap.data()["knownPlayerUids"] as string[]) ?? [];
}
