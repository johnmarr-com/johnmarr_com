import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { getPageContent, type ResolvedSegment } from "@/lib/content-server";
import PageClient from "./PageClient";

// Renders at runtime (Admin SDK creds), like the home page.
export const dynamic = "force-dynamic";

// One read per request, shared by generateMetadata and the page render.
const getPage = cache(async (path: string) => getPageContent(path));

/** First decent share image from the page's segment stack. */
function firstSegmentImage(segments: ResolvedSegment[]): string | undefined {
  for (const seg of segments) {
    if (seg.type === "carousel" && seg.featured[0]?.backdropURL) {
      return seg.featured[0].backdropURL;
    }
    if (seg.type === "rows") {
      for (const row of seg.rows) {
        if (row.items[0]?.coverURL) return row.items[0].coverURL;
      }
    }
    if (seg.type === "grid" && seg.grid.items[0]?.coverURL) {
      return seg.grid.items[0].coverURL;
    }
    if (seg.type === "scrollyfox") {
      const heroImage = seg.heroes[0]?.content.imageUrl;
      if (heroImage) return heroImage;
    }
  }
  return undefined;
}

interface RouteParams {
  params: Promise<{ slug: string[] }>;
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { slug } = await params;
  const content = await getPage(slug.join("/"));
  if (!content) return {};

  const title = content.page.title || content.page.slug;
  const description = content.page.subtitle ?? `${title} on johnmarr.com.`;
  const image = firstSegmentImage(content.segments);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: `/${content.page.slug}`,
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

/**
 * Single slug resolver for standalone pages. Catches any path not matched by a
 * more specific route (so /games, /artist, /show, /admin, … are untouched).
 *
 * Resolution: published page by slug → render. (Phase 2b will add content —
 * shows — by slug here before falling through.) Otherwise 404.
 */
export default async function CatchAllPage({ params }: RouteParams) {
  const { slug } = await params;
  const path = slug.join("/");

  const content = await getPage(path);
  if (content) {
    return <PageClient page={content.page} segments={content.segments} />;
  }

  notFound();
}
