import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken, getAdminFirestore } from "@/lib/firebase-admin";

/**
 * POST /api/user/level-up-dismiss
 *
 * Sets levelledUp = false on the authenticated user's document.
 * Called after the level-up celebration popup has been shown.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid authorization header" },
        { status: 401 },
      );
    }

    const decodedToken = await verifyIdToken(authHeader.substring(7));
    const uid = decodedToken.uid;

    const db = getAdminFirestore();
    await db.collection("users").doc(uid).update({ levelledUp: false });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Level-up dismiss error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
