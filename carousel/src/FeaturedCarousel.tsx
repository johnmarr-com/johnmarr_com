"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { EffectCoverflow, Autoplay } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";

import { DEFAULT_BUTTON_STYLE, buttonGradient } from "./button-styles";
import { mergeTheme, type CarouselTheme } from "./theme";
import type { FeaturedItem } from "./types";

import "swiper/css";
import "swiper/css/effect-coverflow";
import "./carousel.css";

/** Slide width at each breakpoint. Any CSS width works; % is what scales. */
export interface SlideWidths {
  /** < 640px */
  mobile: string;
  /** ≥ 640px */
  tablet: string;
  /** ≥ 768px */
  laptop: string;
  /** ≥ 1024px */
  desktop: string;
}

export const DEFAULT_SLIDE_WIDTHS: SlideWidths = {
  mobile: "85%",
  tablet: "75%",
  laptop: "65%",
  desktop: "60%",
};

export interface BannerImageProps {
  src: string;
  alt: string;
  className: string;
  /** Responsive-source hint, derived from the slide widths. */
  sizes: string;
  /** True for the slides that should not lazy-load. */
  priority: boolean;
}

/** Swap in next/image, an Image CDN component, anything. */
export type BannerImageComponent = (props: BannerImageProps) => ReactNode;

function PlainImage({
  src,
  alt,
  className,
  sizes,
  priority,
}: BannerImageProps): ReactElement {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      sizes={sizes}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
    />
  );
}

export interface FeaturedCarouselProps {
  items: FeaturedItem[];
  /** Click on the frame or the CTA. Omit to use `item.href` navigation. */
  onItemClick?: (item: FeaturedItem) => void;
  /** ms between auto-advances. 0 disables autoplay. Default 6000. */
  autoplayDelay?: number;
  /** Active pagination-dot color. Default: theme accent. */
  dotColor?: string;
  /** Partial palette override. */
  theme?: Partial<CarouselTheme>;
  /** Per-breakpoint slide widths. Default 85 / 75 / 65 / 60 %. */
  slideWidths?: Partial<SlideWidths>;
  /** Frame aspect ratio, any CSS `aspect-ratio` value. Default "16 / 9". */
  aspect?: string;
  /** Upper bound on slide width however wide the window is. Default 900px. */
  maxWidth?: string;
  showArrows?: boolean;
  showDots?: boolean;
  showTitle?: boolean;
  showSubtitle?: boolean;
  /** Fallback CTA label when a banner sets none. Default "View". */
  ctaLabel?: string;
  /** Image renderer. Default: a plain <img>. */
  imageComponent?: BannerImageComponent;
  className?: string;
}

function ChevronLeft(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRight(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlayIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

/** "85%" → "85vw" for the `sizes` attribute; anything else passes through. */
function toViewportWidth(width: string): string {
  return width.trim().endsWith("%")
    ? `${width.trim().slice(0, -1)}vw`
    : width.trim();
}

/**
 * Coverflow looping needs slides on both sides of the active one. With fewer
 * than five banners Swiper cannot fill the track, so the list is repeated
 * until it can. Dots and callbacks still address the real items.
 */
function padForLoop(items: FeaturedItem[]): FeaturedItem[] {
  if (items.length >= 5) return items;
  const padded: FeaturedItem[] = [];
  while (padded.length < 5) padded.push(...items);
  return padded.slice(0, Math.max(5, items.length * 2));
}

/**
 * A coverflow banner carousel: one centred 16:9 banner with its neighbours
 * peeking in, dimmed, on either side. Sizing is driven entirely by
 * ./carousel.css — see the comment block at the top of that file.
 */
export function FeaturedCarousel({
  items,
  onItemClick,
  autoplayDelay = 6000,
  dotColor,
  theme: themeOverride,
  slideWidths,
  aspect = "16 / 9",
  maxWidth = "900px",
  showArrows = true,
  showDots = true,
  showTitle = true,
  showSubtitle = true,
  ctaLabel = "View",
  imageComponent,
  className,
}: FeaturedCarouselProps): ReactElement | null {
  const theme = mergeTheme(themeOverride);
  const [swiper, setSwiper] = useState<SwiperType | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const widths: SlideWidths = { ...DEFAULT_SLIDE_WIDTHS, ...slideWidths };
  const Img: BannerImageComponent = imageComponent ?? PlainImage;

  // One `sizes` string derived from the same numbers the CSS uses, so the
  // browser downloads a source that matches the rendered width.
  const sizes = useMemo(
    () =>
      [
        `(max-width: 640px) ${toViewportWidth(widths.mobile)}`,
        `(max-width: 768px) ${toViewportWidth(widths.tablet)}`,
        `(max-width: 1024px) ${toViewportWidth(widths.laptop)}`,
        toViewportWidth(widths.desktop),
      ].join(", "),
    [widths.mobile, widths.tablet, widths.laptop, widths.desktop],
  );

  // Hovering holds the slide still so the copy can be read.
  useEffect(() => {
    const autoplay = swiper?.autoplay;
    if (!autoplay) return;
    if (isHovered) autoplay.stop();
    else autoplay.start();
  }, [isHovered, swiper]);

  const handlePrev = useCallback(() => swiper?.slidePrev(), [swiper]);
  const handleNext = useCallback(() => swiper?.slideNext(), [swiper]);

  const activate = useCallback(
    (item: FeaturedItem) => {
      if (onItemClick) {
        onItemClick(item);
        return;
      }
      if (item.href && typeof window !== "undefined") {
        window.location.assign(item.href);
      }
    },
    [onItemClick],
  );

  if (items.length === 0) return null;

  const displayItems = padForLoop(items);

  const rootStyle: CSSProperties & Record<string, string> = {
    "--jmc-w-mobile": widths.mobile,
    "--jmc-w-tablet": widths.tablet,
    "--jmc-w-laptop": widths.laptop,
    "--jmc-w-desktop": widths.desktop,
    "--jmc-max-width": maxWidth,
    "--jmc-aspect": aspect,
    "--jmc-dot": dotColor ?? theme.accent,
    "--jmc-dot-idle": theme.textTertiary,
    "--jmc-text": theme.textPrimary,
    "--jmc-text-dim": theme.textSecondary,
    "--jmc-arrow-bg": `${theme.elevated1}cc`,
  };

  return (
    <div
      className={className ? `jmc-root ${className}` : "jmc-root"}
      style={rootStyle}
      data-hovered={isHovered ? "true" : "false"}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={{ position: "relative" }}>
        <Swiper
          onSwiper={setSwiper}
          onSlideChange={(s) => setActiveIndex(s.realIndex % items.length)}
          effect="coverflow"
          grabCursor
          centeredSlides
          slidesPerView="auto"
          loop
          speed={500}
          coverflowEffect={{
            rotate: 0,
            stretch: 0,
            depth: 100,
            modifier: 2.5,
            slideShadows: false,
          }}
          {...(autoplayDelay > 0
            ? {
                autoplay: {
                  delay: autoplayDelay,
                  disableOnInteraction: false,
                  pauseOnMouseEnter: true,
                },
              }
            : {})}
          modules={[EffectCoverflow, Autoplay]}
          className="jmc-swiper"
        >
          {displayItems.map((item, idx) => (
            <SwiperSlide key={`${item.id}-${idx}`} className="jmc-slide">
              {({ isActive }) => {
                const cta = item.ctaButton ?? DEFAULT_BUTTON_STYLE;
                return (
                  <div
                    className="jmc-frame"
                    data-active={isActive ? "true" : "false"}
                    onClick={() => activate(item)}
                    role="button"
                    tabIndex={isActive ? 0 : -1}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        activate(item);
                      }
                    }}
                  >
                    <Img
                      src={item.backdropURL}
                      alt={item.title}
                      className="jmc-image"
                      sizes={sizes}
                      priority={idx < 2}
                    />
                    <div className="jmc-scrim" />
                    <div className="jmc-overlay">
                      {showTitle && item.title ? (
                        <h3 className="jmc-title">{item.title}</h3>
                      ) : null}
                      {showSubtitle && item.subtitle ? (
                        <p className="jmc-subtitle">{item.subtitle}</p>
                      ) : null}
                      {item.description ? (
                        <p className="jmc-description">{item.description}</p>
                      ) : null}
                      <button
                        type="button"
                        className="jmc-cta"
                        style={{
                          background: buttonGradient(cta),
                          color: cta.textColor,
                          pointerEvents: isActive ? "auto" : "none",
                        }}
                        tabIndex={isActive ? 0 : -1}
                        onClick={(e) => {
                          e.stopPropagation();
                          activate(item);
                        }}
                      >
                        <PlayIcon />
                        {item.ctaLabel ?? ctaLabel}
                      </button>
                    </div>
                  </div>
                );
              }}
            </SwiperSlide>
          ))}
        </Swiper>

        {showArrows && items.length > 1 ? (
          <>
            <button
              type="button"
              className="jmc-arrow jmc-arrow--prev"
              onClick={handlePrev}
              aria-label="Previous slide"
            >
              <ChevronLeft />
            </button>
            <button
              type="button"
              className="jmc-arrow jmc-arrow--next"
              onClick={handleNext}
              aria-label="Next slide"
            >
              <ChevronRight />
            </button>
          </>
        ) : null}
      </div>

      {showDots && items.length > 1 ? (
        <div className="jmc-dots">
          {items.map((item, index) => (
            <button
              type="button"
              key={item.id}
              className="jmc-dot"
              aria-current={index === activeIndex ? "true" : "false"}
              aria-label={`Go to slide ${index + 1}`}
              onClick={() => swiper?.slideToLoop(index)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
