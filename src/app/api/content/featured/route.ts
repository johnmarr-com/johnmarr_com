import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";

/**
 * Active featured carousel items, over plain HTTPS (Admin SDK).
 *
 * Renders the home banner. NOT a client getDocs on the Firestore realtime
 * stream (wedges on iOS). Public data; CDN-cacheable.
 */
interface FeaturedRow {
  id: string;
  title: string;
  backdropURL: string;
  contentId: string;
  contentType: string;
  subtitle?: string;
  description?: string;
  slug?: string;
  engineSlug?: string;
}

export async function GET() {
  const db = getAdminFirestore();
  const snap = await db
    .collection("featured")
    .where("isActive", "==", true)
    .orderBy("order", "asc")
    .get();

  const rows: FeaturedRow[] = snap.docs.map((d) => {
    const data = d.data();
    const row: FeaturedRow = {
      id: d.id,
      title: (data["title"] as string) ?? "",
      backdropURL: (data["backdropURL"] as string) ?? "",
      contentId: (data["contentId"] as string) ?? "",
      contentType: (data["contentType"] as string) ?? "",
    };
    if (data["subtitle"]) row.subtitle = data["subtitle"] as string;
    if (data["description"]) row.description = data["description"] as string;
    if (data["slug"]) row.slug = data["slug"] as string;
    return row;
  });

  // Game rows need slug + engineSlug from their content doc (for the play link).
  await Promise.all(
    rows.map(async (row) => {
      if (row.contentType !== "game" || !row.contentId) return;
      const c = await db.doc(`content/${row.contentId}`).get();
      if (!c.exists) return;
      const cd = c.data() ?? {};
      if (cd["slug"]) row.slug = cd["slug"] as string;
      if (cd["engineSlug"]) row.engineSlug = cd["engineSlug"] as string;
    }),
  );

  return NextResponse.json(
    { rows },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}
