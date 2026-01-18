import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken, getAdminFirestore } from "@/lib/firebase-admin";

/**
 * PUT /api/user/avatar - Update current user's avatar
 * 
 * Request body: { avatarName: string | null }
 * Requires authenticated user via Bearer token
 */
export async function PUT(request: NextRequest) {
  try {
    // Get auth token from header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid authorization header" },
        { status: 401 }
      );
    }

    const idToken = authHeader.substring(7); // Remove "Bearer "

    // Verify the token and get user
    const decodedToken = await verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // Parse request body
    const body = await request.json();
    const { avatarName } = body;

    // Validate avatarName (can be string or null)
    if (avatarName !== null && typeof avatarName !== "string") {
      return NextResponse.json(
        { error: "avatarName must be a string or null" },
        { status: 400 }
      );
    }

    // Update user document in Firestore
    const db = getAdminFirestore();
    const userRef = db.collection("users").doc(uid);
    
    await userRef.update({
      avatarName: avatarName,
      updatedAt: new Date(),
    });

    return NextResponse.json({ 
      success: true,
      avatarName: avatarName,
    });

  } catch (error) {
    console.error("Error updating avatar:", error);
    
    if (error instanceof Error && error.message.includes("auth")) {
      return NextResponse.json(
        { error: "Authentication failed" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update avatar" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/user/avatar - Get current user's avatar
 * 
 * Requires authenticated user via Bearer token
 */
export async function GET(request: NextRequest) {
  try {
    // Get auth token from header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid authorization header" },
        { status: 401 }
      );
    }

    const idToken = authHeader.substring(7); // Remove "Bearer "

    // Verify the token and get user
    const decodedToken = await verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // Get user document from Firestore
    const db = getAdminFirestore();
    const userDoc = await db.collection("users").doc(uid).get();
    
    if (!userDoc.exists) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    
    return NextResponse.json({ 
      avatarName: userData?.["avatarName"] ?? null,
    });

  } catch (error) {
    console.error("Error getting avatar:", error);
    
    return NextResponse.json(
      { error: "Failed to get avatar" },
      { status: 500 }
    );
  }
}
