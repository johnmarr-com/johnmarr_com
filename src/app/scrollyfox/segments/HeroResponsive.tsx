import type { ResolvedStyle } from "@/lib/scrollyfox-style";
import type { ResolvedButtonStyle } from "@/lib/button-styles";
import { HeroSegment, type HeroContent, type HeroLayout } from "./HeroSegment";

export interface DeviceStyles {
  desktop: ResolvedStyle;
  tablet: ResolvedStyle;
  mobile: ResolvedStyle;
}

interface HeroResponsiveProps {
  content: HeroContent;
  /** Per-device layout overrides (desktop = content.layout). */
  layouts?: { tablet?: HeroLayout; mobile?: HeroLayout };
  ctaButton?: ResolvedButtonStyle;
  /** Fully resolved style per device tier. */
  styles: DeviceStyles;
}

/**
 * Renders a hero responsively by its OWN container width (CSS container
 * queries), not the viewport — so it behaves identically in production and in
 * every fixed-width preview box. Each device tier gets its full layout + style
 * + image; only the one matching the container width is shown.
 *
 * Tiers (per ScrollyFox.md): mobile <734, tablet 734–1069, desktop 1070+.
 */
export function HeroResponsive({
  content,
  layouts,
  ctaButton,
  styles,
}: HeroResponsiveProps) {
  const tabletLayout = layouts?.tablet ?? content.layout;
  const mobileLayout = layouts?.mobile ?? content.layout;
  const btn = ctaButton ? { ctaButton } : {};

  return (
    <div className="@container w-full">
      {/* Mobile: < 734px */}
      <div className="block @min-[734px]:hidden">
        <HeroSegment
          {...content}
          layout={mobileLayout}
          style={styles.mobile}
          deviceMode="mobile"
          {...btn}
        />
      </div>
      {/* Tablet: 734–1069px */}
      <div className="hidden @min-[734px]:block @min-[1070px]:hidden">
        <HeroSegment
          {...content}
          layout={tabletLayout}
          style={styles.tablet}
          deviceMode="tablet"
          {...btn}
        />
      </div>
      {/* Desktop: ≥ 1070px */}
      <div className="hidden @min-[1070px]:block">
        <HeroSegment
          {...content}
          layout={content.layout}
          style={styles.desktop}
          deviceMode="desktop"
          {...btn}
        />
      </div>
    </div>
  );
}
