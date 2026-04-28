import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/firebase-admin";

export interface AdminAuthResult {
  uid: string;
  ok: true;
}

export type AdminAuthError = NextResponse<{ error: string }>;

/**
 * Verify an admin caller. Returns either { uid, ok: true } or a NextResponse
 * with the appropriate 401/403 status. Caller should `if ('status' in result) return result;`.
 */
export async function requireAdmin(request: NextRequest): Promise<AdminAuthResult | AdminAuthError> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing authorization header" }, { status: 401 });
  }
  try {
    const decoded = await verifyIdToken(authHeader.substring(7));
    if (decoded["admin"] !== true) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
    return { uid: decoded.uid, ok: true };
  } catch {
    return NextResponse.json({ error: "Invalid auth token" }, { status: 401 });
  }
}
