/**
 * JMStyle - Theme Definitions
 * 
 * Centralized theming system for the John Marr application.
 * Dark-mode first design with vibrant accent colors.
 */

export interface JMTheme {
  name: string;
  displayName: string;
  
  // Brand assets
  logo: string;
  logoAlt: string;
  
  // Primary gradient (signature CTA)
  gradient: {
    start: string;      // Hot Pink
    middle: string;     // Electric Purple  
    end: string;        // Deep Blue
    css: string;        // Ready-to-use CSS gradient
    angle: number;      // Default angle (degrees)
  };
  
  // Primary solid (when gradient isn't feasible)
  primary: string;
  
  // Background system (surfaces)
  surfaces: {
    base: string;       // Pure black - main canvas
    elevated1: string;  // Cards, elevated content
    elevated2: string;  // Secondary surfaces
    elevated3: string;  // Tertiary, inputs
    header: string;     // Header background (dark purple)
  };
  
  // Text & content
  text: {
    primary: string;    // Main text
    secondary: string;  // 60% - supporting text
    tertiary: string;   // 40% - hints, captions
    disabled: string;   // Disabled states
    accent: string;     // Lavender - quotes, testimonials
  };
  
  // Accent colors (magic/energy)
  accents: {
    neonPink: string;
    electricBlue: string;
    goldenGlow: string;
  };
  
  // Semantic colors (functional states)
  semantic: {
    success: string;
    warning: string;
    error: string;
    info: string;
  };
  
  // Typography hints
  typography: {
    fontFamily: string;
    monoFamily: string;
  };
}

/**
 * John Marr - Primary brand theme
 * Dark, energetic palette with pink-purple gradient accents
 */
export const johnmarrTheme: JMTheme = {
  name: "johnmarr",
  displayName: "John Marr",
  
  logo: "/images/logos/JohnMarr-Signature.jpg",
  logoAlt: "John Marr Signature",
  
  // Primary gradient (pink → purple → blue)
  gradient: {
    start: "#FF1B6D",     // Hot Pink
    middle: "#8B35FF",    // Electric Purple
    end: "#5B21E8",       // Deep Blue
    css: "linear-gradient(135deg, #FF1B6D 0%, #8B35FF 50%, #5B21E8 100%)",
    angle: 135,
  },
  
  // Primary solid
  primary: "#8B35FF",     // Electric Purple
  
  // Background system
  surfaces: {
    base: "#000000",      // Pure black
    elevated1: "#0A0A0A", // Cards
    elevated2: "#141414", // Secondary
    elevated3: "#1E1E1E", // Inputs
    header: "#000000",    // Dark purple (50% darker than brand purple)
  },
  
  // Text colors
  text: {
    primary: "#FFFFFF",
    secondary: "#B8B8B8",
    tertiary: "#808080",
    disabled: "#4D4D4D",
    accent: "#A89DC9",    // Lavender
  },
  
  // Accent colors
  accents: {
    neonPink: "#FF36AB",
    electricBlue: "#00D9FF",
    goldenGlow: "#FFD700",
  },
  
  // Semantic colors
  semantic: {
    success: "#00E676",   // Vibrant green
    warning: "#FFB300",   // Warm gold
    error: "#FF3D71",     // Vibrant red-pink
    info: "#00D9FF",      // Electric blue
  },
  
  // Typography
  typography: {
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
    monoFamily: "JetBrains Mono, monospace",
  },
};

/**
 * All available themes
 */
export const themes = {
  johnmarr: johnmarrTheme,
} as const;

export type ThemeName = keyof typeof themes;

/**
 * Default theme
 */
export const defaultTheme: ThemeName = "johnmarr";

/**
 * Get a theme by name, falls back to default if not found
 */
export function getTheme(name: ThemeName): JMTheme {
  return themes[name] ?? themes[defaultTheme];
}

/**
 * Helper: Get gradient CSS for buttons/CTAs
 */
export function getGradientButton(theme: JMTheme = johnmarrTheme): string {
  return `background: ${theme.gradient.css}; background-color: ${theme.primary};`;
}

/**
 * Helper: Get surface color by elevation level (0-3)
 */
export function getSurface(level: 0 | 1 | 2 | 3, theme: JMTheme = johnmarrTheme): string {
  const surfaces: [string, string, string, string] = [
    theme.surfaces.base,
    theme.surfaces.elevated1,
    theme.surfaces.elevated2,
    theme.surfaces.elevated3,
  ];
  return surfaces[level];
}