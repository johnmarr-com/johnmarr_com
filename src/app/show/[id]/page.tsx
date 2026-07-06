import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getShowServer } from "@/lib/detail-server";
import ShowClient from "./ShowClient";

// Render at runtime (Admin SDK creds on Cloud Run). Server-rendering the show
// is what gives shared links a real unfurl card and crawlers real content —
// the interactive player/gate lives in ShowClient.
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { id } = await params;
  const show = await getShowServer(id);
  if (!show) return { title: "Show not found" };

  const description =
    show.description ?? `Watch ${show.name} free on johnmarr.com.`;
  const image = show.backdropURL ?? show.coverURL;

  return {
    title: show.name,
    description,
    openGraph: {
      title: show.name,
      description,
      type: "video.other",
      url: `/show/${show.id}`,
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: show.name,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function ShowDetailPage({ params }: RouteParams) {
  const { id } = await params;
  const show = await getShowServer(id);
  if (!show) notFound();
  return <ShowClient show={show} />;
}
