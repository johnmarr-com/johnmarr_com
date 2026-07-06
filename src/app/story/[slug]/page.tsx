import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStoryServer } from "@/lib/detail-server";
import StoryClient from "./StoryClient";

// Render at runtime (Admin SDK creds on Cloud Run). Server-rendering the story
// gives shared links a real unfurl card and crawlers real content — the reader
// and signup gate live in StoryClient.
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { slug } = await params;
  const story = await getStoryServer(slug);
  if (!story) return { title: "Story not found" };

  const description =
    story.description ??
    story.subtitle ??
    `Read ${story.title} by ${story.author} free on johnmarr.com.`;

  return {
    title: story.title,
    description,
    openGraph: {
      title: story.title,
      description,
      type: "book",
      url: `/story/${story.slug}`,
      ...(story.coverImageURL ? { images: [{ url: story.coverImageURL }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: story.title,
      description,
      ...(story.coverImageURL ? { images: [story.coverImageURL] } : {}),
    },
  };
}

export default async function StoryPage({ params }: RouteParams) {
  const { slug } = await params;
  const story = await getStoryServer(slug);
  if (!story) notFound();
  return <StoryClient story={story} />;
}
