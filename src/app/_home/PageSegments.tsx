"use client";

import { useRouter } from "next/navigation";
import {
  JMFeaturedCarousel,
  JMContentScroller,
  JMFeatureRowBanner,
} from "@/JMKit";
import type { FeaturedItem, ContentItem } from "@/JMKit";
import { bgMusic } from "@/lib/BackgroundMusicPlayer";
import { getGamePlayHref } from "@/lib/composite-game-slug";
import type { HomeRow, ResolvedSegment } from "@/lib/content-server";
import { HeroSegment } from "@/app/scrollyfox/segments/HeroSegment";

/**
 * Renders a page's ordered segment stack (carousels, row collections,
 * scrollyfoxes, …). Shared by the home (inside HomeClient's chrome) and
 * standalone pages (PageClient), so every surface renders the full stack.
 */
export function PageSegments({ segments }: { segments: ResolvedSegment[] }) {
  const router = useRouter();

  const goFeatured = (item: FeaturedItem) => {
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

  const goContent = (item: ContentItem) => {
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

  const renderRows = (rows: HomeRow[]) =>
    rows.map((experience) => {
      if (experience.featureItem) {
        const fi = experience.featureItem;
        return (
          <div key={experience.id} className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
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
          onItemClick={goContent}
        />
      );
    });

  return (
    <>
      {segments.map((seg) => {
        if (seg.type === "carousel") {
          if (seg.featured.length === 0) return null;
          return (
            <section key={seg.id} className="relative mt-4">
              <JMFeaturedCarousel
                items={seg.featured as FeaturedItem[]}
                onItemClick={goFeatured}
                autoplayDelay={6000}
              />
            </section>
          );
        }
        if (seg.type === "rows") {
          if (seg.rows.length === 0) return null;
          return (
            <section key={seg.id} className="mt-4 space-y-6 sm:mt-6 sm:space-y-8">
              {renderRows(seg.rows)}
            </section>
          );
        }
        if (seg.type === "scrollyfox") {
          if (seg.heroes.length === 0) return null;
          return (
            <section key={seg.id} className="mt-4">
              {seg.heroes.map((h, i) => (
                <HeroSegment key={i} {...h.content} style={h.style} />
              ))}
            </section>
          );
        }
        return null;
      })}
    </>
  );
}

/** True if any segment has renderable content. */
export function segmentsHaveContent(segments: ResolvedSegment[]): boolean {
  return segments.some(
    (s) =>
      (s.type === "carousel" && s.featured.length > 0) ||
      (s.type === "rows" && s.rows.length > 0) ||
      (s.type === "scrollyfox" && s.heroes.length > 0),
  );
}
