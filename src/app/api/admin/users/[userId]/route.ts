import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore, verifyIdToken, setAdminRole, removeAdminRole, isUserAdmin } from "@/lib/firebase-admin";

/**
 * GET /api/admin/users/[userId]
 * Fetch full user data (admin only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    // Verify admin
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing authorization header" },
        { status: 401 }
      );
    }

    const idToken = authHeader.substring(7);
    let decodedToken;
    try {
      decodedToken = await verifyIdToken(idToken);
    } catch {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    if (decodedToken["admin"] !== true) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    // Fetch user from Firestore
    const db = getAdminFirestore();
    const userDoc = await db.collection("users").doc(userId).get();

    if (!userDoc.exists) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const data = userDoc.data()!;
    
    // Check if user is admin via custom claims
    const userIsAdmin = await isUserAdmin(userId);

    const user = {
      uid: userDoc.id,
      email: data["email"] || null,
      displayName: data["displayName"] || null,
      photoURL: data["photoURL"] || null,
      avatarName: data["avatarName"] || null,
      createdAt: data["createdAt"]?.toDate()?.toISOString() || null,
      updatedAt: data["updatedAt"]?.toDate()?.toISOString() || null,
      tier: data["tier"] || "free",
      monthsPaid: data["monthsPaid"] || 0,
      // Gift access
      giftMonthsStarted: data["giftMonthsStarted"]?.toDate()?.toISOString() || null,
      giftMonthsRemaining: data["giftMonthsRemaining"] || 0,
      lifetimeGift: data["lifetimeGift"] || false,
      // Activity
      showsWatched: data["showsWatched"] || 0,
      storiesRead: data["storiesRead"] || 0,
      gamesPlayed: data["gamesPlayed"] || 0,
      gamesHosted: data["gamesHosted"] || 0,
      cardsViewed: data["cardsViewed"] || 0,
      cardsSent: data["cardsSent"] || 0,
      shares: data["shares"] || 0,
      favorites: data["favorites"] || [],
      isAdmin: userIsAdmin,
    };

    return NextResponse.json({ user });

  } catch (error) {
    console.error("[admin/users/[userId]] GET Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/users/[userId]
 * Update user data (admin only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    // Verify admin
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing authorization header" },
        { status: 401 }
      );
    }

    const idToken = authHeader.substring(7);
    let decodedToken;
    try {
      decodedToken = await verifyIdToken(idToken);
    } catch {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    if (decodedToken["admin"] !== true) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Separate admin status and read-only fields from updatable data
    const { isAdmin, ...dataWithReadOnly } = body;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { uid: ignoreUid, createdAt: ignoreCreated, updatedAt: ignoreUpdated, ...updateData } = dataWithReadOnly;

    // Update Firestore user document
    const db = getAdminFirestore();
    const userRef = db.collection("users").doc(userId);
    
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Convert date strings back to Date objects for Firestore
    const processedData = { ...updateData };
    if (processedData.giftMonthsStarted) {
      processedData.giftMonthsStarted = new Date(processedData.giftMonthsStarted);
    }

    // Update user data
    await userRef.update({
      ...processedData,
      updatedAt: new Date(),
    });

    // Handle admin status change
    const currentIsAdmin = await isUserAdmin(userId);
    if (isAdmin !== undefined && isAdmin !== currentIsAdmin) {
      if (isAdmin) {
        await setAdminRole(userId);
      } else {
        await removeAdminRole(userId);
      }
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("[admin/users/[userId]] PUT Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
