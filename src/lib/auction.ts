"use client";

/**
 * Fine Art Auctions - Firestore CRUD and bid operations
 *
 * Collections:
 * - auctions: Named auctions (each with name, slug, endDate, isActive)
 * - auction_items: Artwork items with auctionId, linked to parent auction
 * - auction_items/{id}/bids: Subcollection of bids per item
 */

import type {
  JMAuction,
  JMAuctionInput,
  JMAuctionUpdate,
  JMAuctionItem,
  JMAuctionItemInput,
  JMAuctionItemUpdate,
  JMAuctionBid,
  JMAuctionItemWithBids,
} from "./content-types";
import type { Timestamp } from "firebase/firestore";
import { getPublicStorageUrl } from "./content";

// ─────────────────────────────────────────────────────────────
// AUCTIONS
// ─────────────────────────────────────────────────────────────

export async function getAllAuctions(activeOnly = false): Promise<JMAuction[]> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, collection, query, orderBy, getDocs } = await import("firebase/firestore");

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  const q = query(collection(db, "auctions"), orderBy("order", "asc"));
  const snap = await getDocs(q);
  let results = snap.docs.map((d) => ({ id: d.id, ...d.data() } as JMAuction));
  if (activeOnly) {
    results = results.filter((a) => a.isActive);
  }
  return results;
}

export async function getAuctionBySlug(slug: string): Promise<JMAuction | null> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, collection, query, where, getDocs } = await import("firebase/firestore");

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  const q = query(collection(db, "auctions"), where("slug", "==", slug));
  const snap = await getDocs(q);
  const first = snap.docs[0];
  if (!first) return null;
  return { id: first.id, ...first.data() } as JMAuction;
}

export async function getAuction(auctionId: string): Promise<JMAuction | null> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, doc, getDoc } = await import("firebase/firestore");

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  const snap = await getDoc(doc(db, "auctions", auctionId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as JMAuction;
}

export async function createAuction(input: JMAuctionInput): Promise<JMAuction> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, collection, addDoc, serverTimestamp } = await import("firebase/firestore");

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  const data = {
    ...input,
    isActive: input.isActive ?? false,
    order: input.order ?? 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, "auctions"), data);
  return {
    id: ref.id,
    ...data,
    createdAt: data.createdAt as Timestamp,
    updatedAt: data.updatedAt as Timestamp,
  } as JMAuction;
}

export async function updateAuction(auctionId: string, updates: JMAuctionUpdate): Promise<void> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, doc, updateDoc, serverTimestamp } = await import("firebase/firestore");

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  await updateDoc(doc(db, "auctions", auctionId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteAuction(auctionId: string): Promise<void> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, doc, collection, query, where, getDocs, deleteDoc } = await import("firebase/firestore");

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  // Delete all items (and their bids)
  const itemsQuery = query(collection(db, "auction_items"), where("auctionId", "==", auctionId));
  const itemsSnap = await getDocs(itemsQuery);
  for (const itemDoc of itemsSnap.docs) {
    const bidsRef = collection(db, "auction_items", itemDoc.id, "bids");
    const bidsSnap = await getDocs(bidsRef);
    for (const bidDoc of bidsSnap.docs) {
      await deleteDoc(bidDoc.ref);
    }
    await deleteDoc(itemDoc.ref);
  }

  await deleteDoc(doc(db, "auctions", auctionId));
}

/** Check if any auction is active (for home banner) */
export async function hasActiveAuction(): Promise<boolean> {
  const auctions = await getAllAuctions(true);
  return auctions.length > 0;
}

// ─────────────────────────────────────────────────────────────
// AUCTION ITEMS
// ─────────────────────────────────────────────────────────────

export async function getAuctionItems(
  auctionId: string,
  publishedOnly = false
): Promise<JMAuctionItem[]> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, collection, query, where, orderBy, getDocs } = await import("firebase/firestore");

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  if (publishedOnly) {
    const auction = await getAuction(auctionId);
    if (!auction?.isActive) return [];
  }

  const q = query(
    collection(db, "auction_items"),
    where("auctionId", "==", auctionId),
    orderBy("order", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as JMAuctionItem));
}

export async function getAuctionItem(itemId: string): Promise<JMAuctionItem | null> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, doc, getDoc } = await import("firebase/firestore");

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  const snap = await getDoc(doc(db, "auction_items", itemId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as JMAuctionItem;
}

export async function createAuctionItem(
  input: JMAuctionItemInput
): Promise<JMAuctionItem> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, collection, addDoc, serverTimestamp } = await import("firebase/firestore");

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  const data = {
    ...input,
    minimumBid: input.minimumBid,
    currentBid: 0,
    currentBidWinnerName: null,
    order: input.order ?? 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, "auction_items"), data);
  return {
    id: ref.id,
    ...data,
    createdAt: data.createdAt as Timestamp,
    updatedAt: data.updatedAt as Timestamp,
  } as JMAuctionItem;
}

export async function updateAuctionItem(
  itemId: string,
  updates: JMAuctionItemUpdate
): Promise<void> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, doc, updateDoc, serverTimestamp } = await import("firebase/firestore");

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  await updateDoc(doc(db, "auction_items", itemId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteAuctionItem(itemId: string): Promise<void> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, doc, collection, getDocs, deleteDoc } = await import("firebase/firestore");

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  const bidsRef = collection(db, "auction_items", itemId, "bids");
  const bidsSnap = await getDocs(bidsRef);
  for (const bidDoc of bidsSnap.docs) {
    await deleteDoc(bidDoc.ref);
  }

  await deleteDoc(doc(db, "auction_items", itemId));
}

export async function getAuctionItemWithBids(
  itemId: string
): Promise<JMAuctionItemWithBids | null> {
  const item = await getAuctionItem(itemId);
  if (!item) return null;

  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, collection, query, orderBy, getDocs } = await import("firebase/firestore");

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  const bidsRef = collection(db, "auction_items", itemId, "bids");
  const bidsSnap = await getDocs(query(bidsRef, orderBy("value", "desc")));
  const bids = bidsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as JMAuctionBid));

  return { ...item, bids };
}

// ─────────────────────────────────────────────────────────────
// BIDS
// ─────────────────────────────────────────────────────────────

export async function placeBid(
  itemId: string,
  userId: string,
  userName: string,
  value: number
): Promise<void> {
  const { initializeFirebase } = await import("./firebase");
  const {
    getFirestore,
    doc,
    collection,
    serverTimestamp,
    runTransaction,
  } = await import("firebase/firestore");

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  const itemRef = doc(db, "auction_items", itemId);
  const bidsRef = collection(db, "auction_items", itemId, "bids");
  const bidRef = doc(bidsRef);

  await runTransaction(db, async (tx) => {
    const itemSnap = await tx.get(itemRef);
    if (!itemSnap.exists()) throw new Error("Auction item not found");

    const item = itemSnap.data() as Record<string, unknown>;
    const minimumBid = (item?.["minimumBid"] as number) ?? 0;
    const currentBid = (item?.["currentBid"] as number) ?? 0;
    const effectiveMinimum = currentBid > 0 ? Math.max(minimumBid, currentBid) : minimumBid;

    if (value < effectiveMinimum) {
      throw new Error(
        `Bid must be at least $${effectiveMinimum}. ${
          currentBid > 0 ? `(Current high: $${currentBid})` : ""
        }`
      );
    }

    tx.set(bidRef, {
      auctionItemId: itemId,
      userId,
      userName,
      value,
      bidAt: serverTimestamp(),
    });
    tx.update(itemRef, {
      currentBid: value,
      currentBidWinnerName: userName,
      updatedAt: serverTimestamp(),
    });
  });
}

// ─────────────────────────────────────────────────────────────
// IMAGE UPLOAD
// ─────────────────────────────────────────────────────────────

export async function uploadAuctionImage(
  file: File,
  itemId: string,
  imageType: "thumbnail" | "detail" | "banner"
): Promise<string> {
  const { initializeFirebase } = await import("./firebase");
  const { getStorage, ref, uploadBytes } = await import("firebase/storage");

  const { app } = await initializeFirebase();
  const storage = getStorage(app);

  const ext = file.type.split("/")[1] || "jpg";
  const storagePath = `auction-images/${itemId}/${imageType}.${ext}`;
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
