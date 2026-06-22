"use client";

import type { ResolvedStyle } from "@/lib/scrollyfox-style";
import { DEFAULT_BUTTON_STYLE, type ResolvedButtonStyle } from "@/lib/button-styles";

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
  /** Named CTA button style (gradient pill). Absent ⇒ Pink-Purple default. */
  ctaButtonStyleId?: string;
}

interface HeroSegmentProps extends HeroContent {
  /** Fully resolved style for the device this segment is rendering at. */
  style: ResolvedStyle;
  /** Resolved CTA pill colors. Absent ⇒ Pink-Purple default. */
  ctaButton?: ResolvedButtonStyle;
  /**
   * Per-device layout overrides (tablet/mobile). On responsive surfaces these
   * drive the split image/text order per breakpoint via CSS `order`, so a
   * different left/right per device is honored (e.g. text-on-top on mobile).
   * Desktop layout always comes from `layout`.
   */
  layouts?: { tablet?: HeroLayout; mobile?: HeroLayout };
  /** Max content width in px (0 / absent ⇒ full width). Caps + centers the segment. */
  maxWidth?: number;
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
  ctaButton,
  layout,
  layouts,
  maxWidth,
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
  const btn = ctaButton ?? DEFAULT_BUTTON_STYLE;

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
  // An optional maxWidth caps + centers the segment (applied here, inside the
  // container-query variant, so it never shifts the device tier).
  const card = {
    backgroundColor: style.background,
    border: style.border,
    borderRadius: `${style.borderRadius}px`,
    boxShadow: style.boxShadow,
    ...(maxWidth && maxWidth > 0
      ? { maxWidth, marginInline: "auto" as const }
      : {}),
  } as const;

  // When a maxWidth is set, the segment caps + centers AND its inner content
  // fills that width (the default max-w-* / per-block caps are relaxed so the
  // setting actually widens or narrows the content, not just the outer band).
  const capped = !!(maxWidth && maxWidth > 0);

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
              className="inline-flex items-center rounded-full px-6 py-3 text-sm shadow-lg transition-all duration-200 hover:scale-105"
              style={{
                background: `linear-gradient(${btn.angle}deg, ${btn.from}, ${btn.to})`,
                color: btn.textColor,
                fontFamily: style.cta.fontFamily,
                fontWeight: style.cta.fontWeight,
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
        <div
          className={`mx-auto flex w-full ${capped ? "" : "max-w-4xl"} flex-col items-center gap-8 px-6 py-10 md:px-12 md:py-16`}
        >
          <div className="flex w-full max-w-2xl flex-col items-center text-center">
            {copyInner}
          </div>
          {baseImage ? (
            renderImage(
              `w-full ${capped ? "" : "max-w-3xl"} rounded-xl object-contain`,
            )
          ) : (
            <div className={`w-full ${capped ? "" : "max-w-3xl"}`}>{placeholder}</div>
          )}
        </div>
      </section>
    );
  }

  // ── Split: image + copy sized to content, centered as an adjacent pair. ──
  const imageOnLeft = layout === "split-image-left";
  const responsive = !deviceMode;

  // Forced previews stack/align by deviceMode (a fixed-width box can't trigger
  // viewport breakpoints); responsive surfaces use `md` as the stack boundary.
  const splitDirection =
    deviceMode === "mobile"
      ? "flex-col"
      : deviceMode === "tablet" || deviceMode === "desktop"
        ? "flex-row"
        : "flex-col md:flex-row";

  // On responsive surfaces, honor the per-device left/right choice via CSS
  // `order`: mobile (<md) stacks, tablet (md) and desktop (lg) sit side-by-side,
  // each ordered by that device's chosen side. "right" ⇒ text first → image
  // below on mobile (text-on-top scroll flow). Literal classes so Tailwind JIT
  // keeps them. Forced previews skip this — they pass the device's own layout.
  const imgOrder = (l: HeroLayout): 1 | 2 => (l === "split-image-right" ? 2 : 1);
  const flip = (n: 1 | 2): 1 | 2 => (n === 1 ? 2 : 1);
  const IMG = { 1: "order-1", 2: "order-2" } as const;
  const IMG_MD = { 1: "md:order-1", 2: "md:order-2" } as const;
  const IMG_LG = { 1: "lg:order-1", 2: "lg:order-2" } as const;
  const imM = imgOrder(layouts?.mobile ?? layout);
  const imT = imgOrder(layouts?.tablet ?? layout);
  const imD = imgOrder(layout);
  const imageOrderCls = responsive
    ? `${IMG[imM]} ${IMG_MD[imT]} ${IMG_LG[imD]}`
    : "";
  const textOrderCls = responsive
    ? `${IMG[flip(imM)]} ${IMG_MD[flip(imT)]} ${IMG_LG[flip(imD)]}`
    : "";

  // Capped: image + text become proportional columns (~1.3 : 1, like the
  // content-sized pair) that fill the chosen width, and the image is
  // width-driven with AUTO height so it scales — no height cap, no letterbox
  // gap. Uncapped: the original content-sized, tightly-centered pair.
  const imageBlock = (
    <div
      key="image"
      className={`flex w-full items-center justify-center ${capped ? "md:min-w-0 md:flex-[1.3_1_0%]" : "md:w-auto"} ${imageOrderCls}`}
    >
      {baseImage ? (
        renderImage(
          capped
            ? "h-auto w-full rounded-lg"
            : "max-h-[440px] w-full rounded-lg object-contain md:max-w-xl",
        )
      ) : (
        <div className="w-full max-w-md">{placeholder}</div>
      )}
    </div>
  );

  const textBlock = (
    <div
      key="text"
      className={`flex w-full flex-col items-center text-center ${capped ? "md:min-w-0 md:flex-1" : "max-w-xl md:w-auto md:max-w-md"} ${textOrderCls}`}
    >
      {copyInner}
    </div>
  );

  return (
    <section className="w-full overflow-hidden" style={card}>
      <div
        className={`mx-auto flex w-full ${capped ? "" : "max-w-5xl"} items-center justify-center gap-8 px-6 py-10 md:gap-10 md:px-10 md:py-14 ${splitDirection}`}
      >
        {responsive
          ? [imageBlock, textBlock]
          : imageOnLeft
            ? [imageBlock, textBlock]
            : [textBlock, imageBlock]}
      </div>
    </section>
  );
}
