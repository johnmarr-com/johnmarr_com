import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken, getAdminFirestore } from "@/lib/firebase-admin";
import { getAuth } from "firebase-admin/auth";
import { getApps } from "firebase-admin/app";
import { FieldValue } from "firebase-admin/firestore";

export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing or invalid authorization header" }, { status: 401 });
    }

    const decodedToken = await verifyIdToken(authHeader.substring(7));
    const uid = decodedToken.uid;

    const { displayName } = (await request.json()) as { displayName?: string };

    if (!displayName || typeof displayName !== "string" || !displayName.trim()) {
      return NextResponse.json({ error: "displayName is required" }, { status: 400 });
    }

    const trimmed = displayName.trim();

    // Update Firebase Auth displayName
    const app = getApps()[0]!;
    const auth = getAuth(app);
    await auth.updateUser(uid, { displayName: trimmed });

    // Update Firestore
    const db = getAdminFirestore();
    await db.collection("users").doc(uid).update({
      displayName: trimmed,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, displayName: trimmed });
  } catch (error) {
    console.error("Error updating profile:", error);

    if (error instanceof Error && error.message.includes("auth")) {
      return NextResponse.json({ error: "Authentication failed" }, { status: 401 });
    }

    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
