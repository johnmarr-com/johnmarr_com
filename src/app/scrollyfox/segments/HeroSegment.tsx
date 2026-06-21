"use client";

import type { ResolvedStyle } from "@/lib/scrollyfox-style";

export type HeroLayout =
  | "split-image-left"
  | "split-image-right"
  | "centered"
  | "overlay";

export interface HeroCTA {
  label: string;
  /** URL destination (Phase 1). In-game actions land in Dynamic mode. */
  href?: string;
}

export interface HeroContent {
  /** Layout variant. */
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
  /** Fully resolved style for the device this segment is rendering at. */
  style: ResolvedStyle;
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

export function HeroSegment({
  style,
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

  const resolvedImage =
    isForcedMobile && imageMobileUrl ? imageMobileUrl : imageUrl;
  const altText = imageAlt ?? title ?? "";
  const ctaList = ctas ?? [];

  // The styled "card" — bg / border / radius / shadow live on the section.
  const card = {
    backgroundColor: style.background,
    border: style.border,
    borderRadius: `${style.borderRadius}px`,
    boxShadow: style.boxShadow,
  } as const;

  // Title / subtitle / CTAs — shared across every layout, always centered.
  const copy = (
    <div className="flex w-full max-w-xl flex-col items-center text-center">
      <h1
        className="mb-4 text-3xl leading-tight md:text-5xl"
        style={{
          color: style.title.color,
          fontFamily: style.title.fontFamily,
          fontWeight: style.title.fontWeight,
        }}
      >
        {title}
      </h1>
      {subtitle && (
        <p
          className="mb-6 max-w-prose text-base md:text-lg"
          style={{
            color: style.subtitle.color,
            fontFamily: style.subtitle.fontFamily,
            fontWeight: style.subtitle.fontWeight,
          }}
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
              className="inline-flex items-center rounded-xl border-2 px-5 py-3 text-sm transition-all duration-150"
              style={{
                borderColor: style.cta.color,
                color: style.cta.color,
                fontFamily: style.cta.fontFamily,
                fontWeight: style.cta.fontWeight,
                backgroundColor: "transparent",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = style.cta.color;
                e.currentTarget.style.color = style.background;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = style.cta.color;
              }}
            >
              {cta.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );

  const placeholder = (
    <div
      className="flex aspect-video w-full items-center justify-center rounded-lg border-2 border-dashed text-sm"
      style={{
        borderColor: style.subtitle.color,
        color: style.subtitle.color,
        opacity: 0.5,
      }}
    >
      No image yet
    </div>
  );

  // ── Overlay: full-bleed image, copy centered on a contrast scrim (Apple-ish) ──
  if (layout === "overlay") {
    return (
      <section
        className="relative flex w-full items-center justify-center overflow-hidden"
        style={{ ...card, minHeight: "clamp(320px, 52vh, 640px)" }}
      >
        {resolvedImage && (
          // eslint-disable-next-line @next/next/no-img-element -- dynamic author-supplied URL
          <img
            src={resolvedImage}
            alt={altText}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        {resolvedImage && (
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to bottom, rgba(0,0,0,0.25), rgba(0,0,0,0.6))",
            }}
          />
        )}
        <div className="relative z-10 flex w-full max-w-2xl justify-center px-6 py-12">
          {copy}
        </div>
      </section>
    );
  }

  // ── Centered: copy stacked above a centered image (Apple product-hero) ──
  if (layout === "centered") {
    return (
      <section className="w-full overflow-hidden" style={card}>
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-8 px-6 py-10 md:px-12 md:py-16">
          {copy}
          {resolvedImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- dynamic author-supplied URL
            <img
              src={resolvedImage}
              alt={altText}
              className="w-full max-w-3xl rounded-xl object-contain"
            />
          ) : (
            <div className="w-full max-w-3xl">{placeholder}</div>
          )}
        </div>
      </section>
    );
  }

  // ── Split: two columns, content kept toward center via a capped, gapped row ──
  const direction = isForcedMobile
    ? "flex-col"
    : isForcedHorizontal
      ? layout === "split-image-right"
        ? "flex-row-reverse"
        : "flex-row"
      : layout === "split-image-right"
        ? "flex-col md:flex-row-reverse"
        : "flex-col md:flex-row";

  return (
    <section className="w-full overflow-hidden" style={card}>
      <div
        className={`mx-auto flex w-full max-w-6xl items-center gap-6 px-6 py-8 md:gap-12 md:px-10 md:py-12 ${direction}`}
      >
        {/* Text column */}
        <div
          className={`flex items-center justify-center ${
            isForcedMobile ? "w-full" : "w-full md:w-1/2"
          }`}
        >
          {copy}
        </div>

        {/* Image column */}
        <div
          className={`flex items-center justify-center ${
            isForcedMobile ? "w-full" : "w-full md:w-1/2"
          }`}
        >
          {resolvedImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- dynamic author-supplied URL
            <img
              src={resolvedImage}
              alt={altText}
              className="max-h-[440px] w-full rounded-lg object-contain"
            />
          ) : (
            placeholder
          )}
        </div>
      </div>
    </section>
  );
}
