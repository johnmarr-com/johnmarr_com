import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore, verifyIdToken } from "@/lib/firebase-admin";

/**
 * Record the caller's marketing-email consent choice on their user doc.
 * Body: { granted: boolean, source?: string }.
 *
 * Uses set+merge (never update) — the users doc may not exist yet for a
 * brand-new signup (see docs/SYSTEM-REVIEW.md / the new-user write race).
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let uid: string;
  try {
    ({ uid } = await verifyIdToken(authHeader.substring(7)));
  } catch {
    return NextResponse.json({ error: "Invalid auth token" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const granted = (body as { granted?: unknown }).granted;
  if (typeof granted !== "boolean") {
    return NextResponse.json({ error: "granted must be a boolean" }, { status: 400 });
  }
  const sourceRaw = (body as { source?: unknown }).source;
  const source =
    typeof sourceRaw === "string" && sourceRaw.length > 0
      ? sourceRaw.slice(0, 100)
      : "unknown";

  const db = getAdminFirestore();
  await db.doc(`users/${uid}`).set(
    {
      marketingConsent: {
        granted,
        source,
        at: FieldValue.serverTimestamp(),
      },
    },
    { merge: true },
  );

  return NextResponse.json({ ok: true });
}
