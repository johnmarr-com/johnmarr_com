"use client";

import type { BrandObject } from "@/lib/brand";

export type HeroLayout = "split-image-left" | "split-image-right";

export interface HeroCTA {
  label: string;
  /** URL destination (Phase 1). In-game actions land in Dynamic mode. */
  href?: string;
}

export interface HeroContent {
  /** Layout variant — image-left or image-right. */
  layout: HeroLayout;
  /** Desktop / Tablet image URL. */
  imageUrl: string | null;
  /** Optional mobile-specific image override. Falls back to imageUrl. */
  imageMobileUrl?: string | null;
  /** Image alt text (also used as fallback when imageUrl is missing). */
  imageAlt?: string;
  title: string;
  subtitle?: string;
  ctas?: HeroCTA[];
}

interface HeroSegmentProps extends HeroContent {
  brand: BrandObject;
  /**
   * Forces a specific device mode for preview surfaces (editor, selector).
   * When undefined, the component uses real responsive behavior via Tailwind breakpoints.
   *
   * Breakpoint mapping (per ScrollyFox.md §2):
   *  - desktop: 1070+
   *  - tablet:  734–1069
   *  - mobile:  320–733
   */
  deviceMode?: "desktop" | "tablet" | "mobile";
}

const IMAGE_INSET_PX = 15;

export function HeroSegment({
  brand,
  layout,
  imageUrl,
  imageMobileUrl,
  imageAlt,
  title,
  subtitle,
  ctas,
  deviceMode,
}: HeroSegmentProps) {
  const isForcedMobile = deviceMode === "mobile";
  const isForcedHorizontal = deviceMode === "desktop" || deviceMode === "tablet";

  // Stacking class — forced mobile stacks; forced desktop/tablet stays horizontal; auto follows real viewport.
  const layoutDirection = isForcedMobile
    ? "flex-col"
    : isForcedHorizontal
      ? layout === "split-image-right"
        ? "flex-row-reverse"
        : "flex-row"
      : layout === "split-image-right"
        ? "flex-col md:flex-row-reverse"
        : "flex-col md:flex-row";

  // Resolved image for the current rendering. In auto mode the browser picks via <picture>.
  const resolvedImage =
    isForcedMobile && imageMobileUrl ? imageMobileUrl : imageUrl;
  const altText = imageAlt ?? title ?? "";

  const ctaList = ctas ?? [];

  return (
    <section
      className={`flex w-full ${layoutDirection}`}
      style={{
        backgroundColor: brand.colors.bgPrimary,
        fontFamily: brand.fonts.body,
      }}
    >
      {/* Text column */}
      <div
        className={`flex flex-col items-center justify-center text-center ${
          isForcedMobile ? "w-full" : "w-full md:w-1/2"
        }`}
        style={{ padding: `${IMAGE_INSET_PX * 2}px` }}
      >
        <h1
          className="mb-4 text-3xl font-bold leading-tight md:text-5xl"
          style={{ color: brand.colors.primary, fontFamily: brand.fonts.title }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className="mb-6 max-w-prose text-base md:text-lg"
            style={{ color: brand.colors.secondary }}
          >
            {subtitle}
          </p>
        )}
        {ctaList.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-3">
            {ctaList.map((cta, idx) => (
              <a
                key={`${cta.label}-${idx}`}
                href={cta.href ?? "#"}
                className="inline-flex items-center rounded-xl border-2 px-5 py-3 text-base font-semibold transition-all duration-150"
                style={{
                  borderColor:
                    idx === 0 ? brand.colors.primary : brand.colors.tertiary,
                  color:
                    idx === 0 ? brand.colors.primary : brand.colors.tertiary,
                  backgroundColor: "transparent",
                }}
                onMouseEnter={(e) => {
                  const accent =
                    idx === 0 ? brand.colors.primary : brand.colors.tertiary;
                  e.currentTarget.style.backgroundColor = accent;
                  e.currentTarget.style.color = brand.colors.bgPrimary;
                }}
                onMouseLeave={(e) => {
                  const accent =
                    idx === 0 ? brand.colors.primary : brand.colors.tertiary;
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = accent;
                }}
              >
                {cta.label}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Image column */}
      <div
        className={`flex items-center justify-center ${
          isForcedMobile ? "w-full" : "w-full md:w-1/2"
        }`}
        style={{
          padding: `${IMAGE_INSET_PX}px`,
          backgroundColor: brand.colors.bgSecondary,
        }}
      >
        {resolvedImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- dynamic author-supplied URL; intrinsic sizing
          <img
            src={resolvedImage}
            alt={altText}
            className="h-full w-full object-contain"
            style={{ maxHeight: "100%" }}
          />
        ) : (
          <div
            className="flex aspect-video w-full items-center justify-center rounded-lg border-2 border-dashed text-sm"
            style={{
              borderColor: brand.colors.tertiary,
              color: brand.colors.tertiary,
            }}
          >
            No image yet
          </div>
        )}
      </div>
    </section>
  );
}
