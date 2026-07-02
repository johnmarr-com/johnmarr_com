import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken, getAdminFirestore } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

const GAMERTAG_REGEX = /^[a-zA-Z0-9_-]{3,20}$/;

export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing or invalid authorization header" }, { status: 401 });
    }

    const decodedToken = await verifyIdToken(authHeader.substring(7));
    const uid = decodedToken.uid;

    const { gamertag } = (await request.json()) as { gamertag: string };

    if (!gamertag || typeof gamertag !== "string") {
      return NextResponse.json({ error: "gamertag is required" }, { status: 400 });
    }

    if (!GAMERTAG_REGEX.test(gamertag)) {
      return NextResponse.json({
        error: "Must be 3–20 characters: letters, numbers, underscores, or hyphens.",
      }, { status: 400 });
    }

    const db = getAdminFirestore();
    const lowerTag = gamertag.toLowerCase();
    const tagRef = db.collection("gamertags").doc(lowerTag);
    const userRef = db.collection("users").doc(uid);

    const userDoc = await userRef.get();
    const oldLowerTag: string | null = userDoc.data()?.["gamertagLower"] ?? null;

    // Same tag — no-op
    if (oldLowerTag === lowerTag) {
      return NextResponse.json({ success: true, gamertag });
    }

    // Check availability
    const existing = await tagRef.get();
    if (existing.exists) {
      return NextResponse.json({ error: "That gamertag is already taken." }, { status: 409 });
    }

    const batch = db.batch();

    // Release old gamertag if changing
    if (oldLowerTag) {
      batch.delete(db.collection("gamertags").doc(oldLowerTag));
    }

    // Claim new gamertag
    batch.set(tagRef, {
      uid,
      gamertag,
      createdAt: FieldValue.serverTimestamp(),
    });

    // Create-or-update the user doc — set + merge, NOT update. A brand-new
    // user's `users/{uid}` doc is created by a CLIENT-side write
    // (saveUserProfile) at sign-in, which can still be queued on iOS / flaky
    // networks when they claim their gamertag (their /api/me even returns null).
    // update() would throw NOT_FOUND → 500; set + merge is order-independent and
    // works whether or not that client write has landed yet.
    batch.set(
      userRef,
      {
        gamertag,
        gamertagLower: lowerTag,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    await batch.commit();

    return NextResponse.json({ success: true, gamertag });
  } catch (error) {
    console.error("Error claiming gamertag:", error);

    if (error instanceof Error && error.message.includes("auth")) {
      return NextResponse.json({ error: "Authentication failed" }, { status: 401 });
    }

    return NextResponse.json({ error: "Failed to claim gamertag" }, { status: 500 });
  }
}
