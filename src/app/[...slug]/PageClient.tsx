"use client";

import { useRouter } from "next/navigation";
import {
  JMAppHeader,
  JMFeaturedCarousel,
  JMContentScroller,
  JMFeatureRowBanner,
} from "@/JMKit";
import type { FeaturedItem, ContentItem } from "@/JMKit";
import { useJMStyle } from "@/JMStyle";
import { bgMusic } from "@/lib/BackgroundMusicPlayer";
import { getGamePlayHref } from "@/lib/composite-game-slug";
import type { HomeFeatured, HomeRow, PageMeta } from "@/lib/content-server";

interface PageClientProps {
  page: PageMeta;
  featured: HomeFeatured[];
  rows: HomeRow[];
}

/**
 * Renderer for a standalone Page: the same feature carousel + content rows the
 * home uses, minus home-only chrome (welcome/level-up/invites/alert). Content
 * arrives from the server component (Admin SDK), so there's no client read.
 */
export default function PageClient({ page, featured, rows }: PageClientProps) {
  const { theme } = useJMStyle();
  const router = useRouter();

  const handleFeaturedClick = (item: FeaturedItem) => {
    if (item.contentType === "game" && item.slug) {
      bgMusic.play(`/music/${item.slug}.mp3`);
      router.push(getGamePlayHref(item.slug, item.engineSlug));
    } else if (item.contentType === "artist" && item.slug) {
      router.push(`/artist/${item.slug}`);
    } else if (item.contentType === "auction" && item.slug) {
      router.push(`/auction/${item.slug}`);
    } else if (item.contentType === "story" && item.slug) {
      router.push(`/story/${item.slug}`);
    } else {
      router.push(`/${item.contentType}/${item.contentId}`);
    }
  };

  const handleContentClick = (item: ContentItem) => {
    if (item.contentType === "game" && item.slug) {
      bgMusic.play(`/music/${item.slug}.mp3`);
      router.push(getGamePlayHref(item.slug, item.engineSlug));
    } else if (item.contentType === "artist" && item.slug) {
      router.push(`/artist/${item.slug}`);
    } else if (item.contentType === "story" && item.slug) {
      router.push(`/story/${item.slug}`);
    } else {
      router.push(`/${item.contentType}/${item.id}`);
    }
  };

  const hasAnyContent =
    featured.length > 0 ||
    rows.some((r) => r.items.length > 0 || r.featureItem);

  return (
    <div
      className="relative min-h-screen"
      style={{ backgroundColor: theme.surfaces.base }}
    >
      <JMAppHeader />

      <main className="pb-12">
        {/* Page header */}
        <div className="px-4 pt-6 sm:px-6">
          <h1
            className="text-3xl font-bold sm:text-4xl"
            style={{ color: theme.text.primary }}
          >
            {page.title}
          </h1>
          {page.subtitle && (
            <p className="mt-1 text-base" style={{ color: theme.text.secondary }}>
              {page.subtitle}
            </p>
          )}
        </div>

        {/* Featured carousel */}
        {featured.length > 0 && (
          <section className="relative mt-4">
            <JMFeaturedCarousel
              items={featured as FeaturedItem[]}
              onItemClick={handleFeaturedClick}
              autoplayDelay={6000}
            />
          </section>
        )}

        {/* Content rows */}
        {rows.length > 0 && (
          <section className="mt-4 space-y-6 sm:mt-6 sm:space-y-8">
            {rows.map((experience) => {
              if (experience.featureItem) {
                const fi = experience.featureItem;
                return (
                  <div
                    key={experience.id}
                    className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8"
                  >
                    <JMFeatureRowBanner
                      item={fi}
                      rowScaleMobile={experience.rowScaleMobile}
                      rowScaleDesktop={experience.rowScaleDesktop}
                      onClick={() => {
                        if (fi.contentType === "game" && fi.slug) {
                          router.push(getGamePlayHref(fi.slug, fi.engineSlug));
                        } else if (fi.contentType === "auction" && fi.slug) {
                          router.push(`/auction/${fi.slug}`);
                        }
                      }}
                    />
                  </div>
                );
              }

              if (experience.items.length === 0) return null;

              return (
                <JMContentScroller
                  key={experience.id}
                  title={experience.title}
                  fastCasual={experience.fastCasual === true}
                  items={experience.items as ContentItem[]}
                  rowScaleMobile={experience.rowScaleMobile}
                  rowScaleDesktop={experience.rowScaleDesktop}
                  onItemClick={handleContentClick}
                />
              );
            })}
          </section>
        )}

        {!hasAnyContent && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="max-w-md text-lg" style={{ color: theme.text.secondary }}>
              This page has no content yet.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
