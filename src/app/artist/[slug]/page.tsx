import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getArtistServer } from "@/lib/detail-server";
import ArtistClient from "./ArtistClient";

// Render at runtime (Admin SDK creds on Cloud Run). Server-rendering gives
// shared artist links a real unfurl card; the player UI lives in ArtistClient.
// (Gated artists still redirect anonymous visitors to /auth client-side.)
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { slug } = await params;
  const data = await getArtistServer(slug);
  if (!data) return { title: "Artist not found" };

  const { artist } = data;
  const description =
    artist.description ?? `Listen to ${artist.name} on johnmarr.com.`;

  return {
    title: artist.name,
    description,
    openGraph: {
      title: artist.name,
      description,
      type: "profile",
      url: `/artist/${artist.slug}`,
      ...(artist.coverURL ? { images: [{ url: artist.coverURL }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: artist.name,
      description,
      ...(artist.coverURL ? { images: [artist.coverURL] } : {}),
    },
  };
}

export default async function ArtistPage({ params }: RouteParams) {
  const { slug } = await params;
  const data = await getArtistServer(slug);
  if (!data) notFound();
  return (
    // Suspense: ArtistClient reads ?album= via useSearchParams.
    <Suspense fallback={null}>
      <ArtistClient data={data} />
    </Suspense>
  );
}
