import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";

/**
 * Published content by (contentType, slug), over plain HTTPS.
 *
 * Game landing pages load their `gameData` with this (via getContentBySlug in
 * useGameFlow). Reading via the Admin SDK on a stateless request — NOT a client
 * getDocs on the Firestore realtime stream, which wedges on iOS and made the
 * landing hang on a black screen. Content is public (only isPublished==true is
 * ever returned), so no auth is required.
 */
export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type");
  const slug = request.nextUrl.searchParams.get("slug");
  if (!type || !slug) {
    return NextResponse.json({ error: "Missing type or slug" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const snap = await db
    .collection("content")
    .where("isPublished", "==", true)
    .where("contentType", "==", type)
    .where("slug", "==", slug)
    .limit(1)
    .get();

  const content = snap.empty ? null : { id: snap.docs[0]!.id, ...snap.docs[0]!.data() };
  return NextResponse.json(
    { content },
    // Public + rarely changes; let the CDN cache briefly, revalidate in the background.
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}
