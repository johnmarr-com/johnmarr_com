/**
 * Brand Object — cross-app visual identity.
 *
 * A Brand carries the colors and fonts that style content authored across
 * apps in the johnmarr universe (ScrollyFox today; Brandaur will own
 * creation/editing once it ships). It is orthogonal to JMStyle, which
 * dresses the app chrome (J anchor, header, frame).
 */

export interface BrandColors {
  /** Primary brand color — headlines, primary CTA, key accents */
  primary: string;
  /** Secondary brand color — supporting accents, secondary CTA */
  secondary: string;
  /** Tertiary brand color — sparing accent, highlights */
  tertiary: string;
  /** Primary background — most segment backgrounds default to this */
  bgPrimary: string;
  /** Secondary background — alternating sections, cards on primary bg */
  bgSecondary: string;
}

export interface BrandFonts {
  /** Title / display font — used for headings and short emphasis */
  title: string;
  /** Body font — used for subtitles, paragraphs, button labels */
  body: string;
}

export interface BrandObject {
  colors: BrandColors;
  fonts: BrandFonts;
}

/**
 * Default Brand approximated from the johnmarr.com palette.
 * Used until Brandaur ships and a user picks/creates their own brand.
 */
export const DEFAULT_BRAND: BrandObject = {
  colors: {
    primary: "#FF36AB",    // neonPink
    secondary: "#8B35FF",  // electric purple
    tertiary: "#00D9FF",   // electric blue
    bgPrimary: "#000000",
    bgSecondary: "#0A0A0A",
  },
  fonts: {
    title: "var(--font-jm-jambo), system-ui, sans-serif",
    body: "var(--font-geist-sans), system-ui, sans-serif",
  },
};
