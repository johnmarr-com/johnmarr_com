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
   * Forces a specific device mode for preview surfaces (the segment editor's
   * device selector). When undefined, the component is fully responsive — it
   * reflows and swaps the mobile image via real CSS breakpoints / <picture>.
   *
   * Breakpoint mapping (per ScrollyFox.md §2): desktop 1070+, tablet 734–1069,
   * mobile 320–733. Reflow uses Tailwind `md` (768) as the stack boundary.
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
  const altText = imageAlt ?? title ?? "";
  const ctaList = ctas ?? [];

  // Desktop-preferred source; forced-device previews pick a variant explicitly.
  const baseImage = imageUrl ?? imageMobileUrl ?? null;
  const forcedImage =
    isForcedMobile && imageMobileUrl ? imageMobileUrl : baseImage;

  // Forced previews (device selector) pick the variant by deviceMode — a fixed
  // box width can't trigger viewport media queries. Responsive surfaces use
  // <picture> so the browser swaps to the mobile image as the window narrows.
  const renderImage = (imgClassName: string) => {
    if (deviceMode) {
      return (
        // eslint-disable-next-line @next/next/no-img-element -- dynamic author-supplied URL
        <img
          src={forcedImage ?? undefined}
          alt={altText}
          className={imgClassName}
        />
      );
    }
    return (
      <picture className="contents">
        {imageMobileUrl && (
          <source media="(max-width: 767px)" srcSet={imageMobileUrl} />
        )}
        <img src={baseImage ?? undefined} alt={altText} className={imgClassName} />
      </picture>
    );
  };

  // The styled "card" — bg / border / radius / shadow live on the section.
  const card = {
    backgroundColor: style.background,
    border: style.border,
    borderRadius: `${style.borderRadius}px`,
    boxShadow: style.boxShadow,
  } as const;

  // Title / subtitle / CTAs — shared across every layout. The wrapping element
  // (per layout) owns width + alignment; this is just the content.
  const copyInner = (
    <>
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
    </>
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
        {baseImage && renderImage("absolute inset-0 h-full w-full object-cover")}
        {baseImage && (
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to bottom, rgba(0,0,0,0.25), rgba(0,0,0,0.6))",
            }}
          />
        )}
        <div className="relative z-10 flex w-full max-w-2xl flex-col items-center px-6 py-12 text-center">
          {copyInner}
        </div>
      </section>
    );
  }

  // ── Centered: copy stacked above a centered image (Apple product-hero) ──
  if (layout === "centered") {
    return (
      <section className="w-full overflow-hidden" style={card}>
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-8 px-6 py-10 md:px-12 md:py-16">
          <div className="flex w-full max-w-2xl flex-col items-center text-center">
            {copyInner}
          </div>
          {baseImage ? (
            renderImage("w-full max-w-3xl rounded-xl object-contain")
          ) : (
            <div className="w-full max-w-3xl">{placeholder}</div>
          )}
        </div>
      </section>
    );
  }

  // ── Split: image + copy sized to content, centered as an adjacent pair. ──
  const imageOnLeft = layout === "split-image-left";

  // Forced previews stack/align by deviceMode (a fixed-width box can't trigger
  // viewport breakpoints); responsive surfaces use `md` as the stack boundary.
  const splitDirection =
    deviceMode === "mobile"
      ? "flex-col"
      : deviceMode === "tablet" || deviceMode === "desktop"
        ? "flex-row"
        : "flex-col md:flex-row";

  const imageBlock = (
    <div
      key="image"
      className="flex w-full items-center justify-center md:w-auto"
    >
      {baseImage ? (
        renderImage("max-h-[440px] w-full rounded-lg object-contain md:max-w-xl")
      ) : (
        <div className="w-full max-w-md">{placeholder}</div>
      )}
    </div>
  );

  const textBlock = (
    <div
      key="text"
      className="flex w-full max-w-xl flex-col items-center text-center md:w-auto md:max-w-md"
    >
      {copyInner}
    </div>
  );

  return (
    <section className="w-full overflow-hidden" style={card}>
      <div
        className={`mx-auto flex w-full max-w-5xl items-center justify-center gap-8 px-6 py-10 md:gap-10 md:px-10 md:py-14 ${splitDirection}`}
      >
        {imageOnLeft ? [imageBlock, textBlock] : [textBlock, imageBlock]}
      </div>
    </section>
  );
}
