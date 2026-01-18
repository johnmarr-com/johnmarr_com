import { NextRequest, NextResponse } from "next/server";
import { setAdminRole, removeAdminRole, verifyIdToken } from "@/lib/firebase-admin";

/**
 * API endpoint for managing admin roles
 * Only accessible by existing admins
 * 
 * POST /api/admin/roles
 * Body: { email: string, action: "grant" | "revoke" }
 * Headers: Authorization: Bearer <idToken>
 */
export async function POST(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid authorization header" },
        { status: 401 }
      );
    }

    const idToken = authHeader.substring(7); // Remove "Bearer " prefix

    // Verify the token and check admin claim
    let decodedToken;
    try {
      decodedToken = await verifyIdToken(idToken);
    } catch {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    // Check if the requesting user is an admin
    if (decodedToken["admin"] !== true) {
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }

    // Parse request body
    const { email, action } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    if (action !== "grant" && action !== "revoke") {
      return NextResponse.json(
        { error: "Action must be 'grant' or 'revoke'" },
        { status: 400 }
      );
    }

    // Perform the action
    try {
      if (action === "grant") {
        await setAdminRole(email);
        console.log(`[admin/roles] Admin granted admin to: ${email}`);
        return NextResponse.json({ 
          success: true, 
          message: `Admin role granted to ${email}` 
        });
      } else {
        await removeAdminRole(email);
        console.log(`[admin/roles] Admin revoked admin from: ${email}`);
        return NextResponse.json({ 
          success: true, 
          message: `Admin role revoked from ${email}` 
        });
      }
    } catch (error) {
      const errorCode = (error as { code?: string }).code;
      if (errorCode === "auth/user-not-found") {
        return NextResponse.json(
          { error: `User not found: ${email}` },
          { status: 404 }
        );
      }
      throw error;
    }

  } catch (error) {
    console.error("[admin/roles] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
