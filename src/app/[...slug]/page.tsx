import { notFound } from "next/navigation";
import { getPageContent } from "@/lib/content-server";
import PageClient from "./PageClient";

// Renders at runtime (Admin SDK creds), like the home page.
export const dynamic = "force-dynamic";

/**
 * Single slug resolver for standalone pages. Catches any path not matched by a
 * more specific route (so /games, /artist, /show, /admin, … are untouched).
 *
 * Resolution: published page by slug → render. (Phase 2b will add content —
 * shows — by slug here before falling through.) Otherwise 404.
 */
export default async function CatchAllPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const path = slug.join("/");

  const content = await getPageContent(path);
  if (content) {
    return <PageClient page={content.page} segments={content.segments} />;
  }

  notFound();
}
