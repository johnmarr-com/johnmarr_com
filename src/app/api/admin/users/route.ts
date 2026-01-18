import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/firebase-admin";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Ensure admin app is initialized
function getAdminFirestore() {
  if (getApps().length === 0) {
    const projectId = process.env["FIREBASE_PROJECT_ID"]?.trim();
    const clientEmail = process.env["FIREBASE_CLIENT_EMAIL"]?.trim();
    const privateKey = process.env["FIREBASE_PRIVATE_KEY"]?.replace(/\\n/g, "\n");

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error("Missing Firebase Admin credentials");
    }

    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  }
  return getFirestore();
}

/**
 * GET /api/admin/users
 * Fetch users with optional search (admin only)
 * 
 * Query params:
 * - countOnly: if "true", only return total count
 * - search: search query (searches displayName or email if contains @)
 */
export async function GET(request: NextRequest) {
  try {
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

    const { searchParams } = new URL(request.url);
    const countOnly = searchParams.get("countOnly") === "true";
    const search = searchParams.get("search")?.toLowerCase().trim();

    const db = getAdminFirestore();
    const usersCollection = db.collection("users");

    // Count only mode - just return total
    if (countOnly) {
      const snapshot = await usersCollection.count().get();
      return NextResponse.json({ total: snapshot.data().count });
    }

    // Fetch users
    const usersSnapshot = await usersCollection.get();
    
    let users = usersSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        uid: doc.id,
        displayName: data["displayName"] || null,
        email: data["email"] || null,
        tier: data["tier"] || "free",
        createdAt: data["createdAt"]?.toDate()?.toISOString() || null,
      };
    });

    // Filter by search if provided
    if (search && search.length >= 2) {
      const isEmailSearch = search.includes("@");
      
      users = users.filter((user) => {
        if (isEmailSearch) {
          return user.email?.toLowerCase().includes(search);
        } else {
          const name = (user.displayName || "").toLowerCase();
          return name.includes(search);
        }
      });
    }

    // Sort by displayName
    users.sort((a, b) => {
      const nameA = (a.displayName || a.email || "").toLowerCase();
      const nameB = (b.displayName || b.email || "").toLowerCase();
      return nameA.localeCompare(nameB);
    });

    // Limit results for performance
    const limitedUsers = users.slice(0, 50);

    return NextResponse.json({ users: limitedUsers, total: users.length });

  } catch (error) {
    console.error("[admin/users] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
