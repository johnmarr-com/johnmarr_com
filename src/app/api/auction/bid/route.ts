import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { verifyIdToken, getAdminFirestore } from "@/lib/firebase-admin";

/**
 * POST /api/auction/bid
 * Place a bid on an auction item (authenticated users only)
 *
 * Body: { itemId: string, value: number }
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing authorization" }, { status: 401 });
    }

    const idToken = authHeader.substring(7);
    let decodedToken: { uid: string; name?: string; email?: string };
    try {
      decodedToken = (await verifyIdToken(idToken)) as { uid: string; name?: string; email?: string };
    } catch {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    const userId = decodedToken.uid;
    const userName =
      decodedToken["name"] ||
      (decodedToken.email ?? "").split("@")[0] ||
      "Bidder";

    const body = await request.json();
    const itemId = body?.itemId;
    const value = typeof body?.value === "number" ? body.value : parseFloat(body?.value);

    if (!itemId || typeof itemId !== "string") {
      return NextResponse.json({ error: "Invalid itemId" }, { status: 400 });
    }
    if (typeof value !== "number" || isNaN(value) || value < 0) {
      return NextResponse.json({ error: "Invalid bid value" }, { status: 400 });
    }

    const db = getAdminFirestore();
    const itemRef = db.collection("auction_items").doc(itemId);
    const bidRef = db.collection("auction_items").doc(itemId).collection("bids").doc();

    await db.runTransaction(async (tx) => {
      const itemSnap = await tx.get(itemRef);
      if (!itemSnap.exists) {
        throw new Error("Auction item not found");
      }

      const item = itemSnap.data() as Record<string, unknown> | undefined;
      const minimumBid = (item?.["minimumBid"] as number) ?? 0;
      const currentBid = (item?.["currentBid"] as number) ?? 0;
      const effectiveMinimum = currentBid > 0 ? Math.max(minimumBid, currentBid) : minimumBid;

      if (value < effectiveMinimum) {
        throw new Error(
          `Bid must be at least $${effectiveMinimum}. ${currentBid > 0 ? `(Current high: $${currentBid})` : ""}`
        );
      }

      tx.set(bidRef, {
        auctionItemId: itemId,
        userId,
        userName,
        value,
        bidAt: FieldValue.serverTimestamp(),
      });
      tx.update(itemRef, {
        currentBid: value,
        currentBidWinnerName: userName,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to place bid";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
