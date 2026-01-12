/**
 * JMStyle - Theme Definitions
 * 
 * Centralized theming system for the John Marr application.
 * Each theme defines colors, typography hints, and branding assets.
 */

export interface JMTheme {
  name: string;
  displayName: string;
  
  // Brand assets
  logo: string;
  logoAlt: string;
  
  // Core colors
  colors: {
    background: string;
    backgroundDark: string;
    foreground: string;
    foregroundDark: string;
    accent: string;
    accentDark: string;
    accentLight: string;
    accentLightDark: string;
    muted: string;
    mutedDark: string;
    headerBackground: string;
    primaryPink: string;
  };
  
  // Semantic colors
  semantic: {
    success: string;
    warning: string;
    error: string;
    info: string;
  };
  
  // Typography hints (used alongside CSS font definitions)
  typography: {
    fontFamily: string;
    monoFamily: string;
  };
}

/**
 * John Marr - Primary brand theme
 * Warm, sophisticated palette with terracotta accents
 */
export const johnmarrTheme: JMTheme = {
  name: "johnmarr",
  displayName: "John Marr",
  
  logo: "/images/logos/JohnMarr-Signature.png",
  logoAlt: "John Marr Signature",
  
  colors: {
    background: "#faf9f7",
    backgroundDark: "#0f0f0f",
    foreground: "#1a1a1a",
    foregroundDark: "#e8e6e3",
    accent: "#c45d3a",
    accentDark: "#e07850",
    accentLight: "#e8d5c4",
    accentLightDark: "#2a2420",
    muted: "#6b6b6b",
    mutedDark: "#8a8a8a",
    headerBackground: "#000000",
    primaryPink: "#e03dff",
  },
  
  semantic: {
    success: "#2d8a5f",
    warning: "#d4a636",
    error: "#c44536",
    info: "#3a7bc4",
  },
  
  typography: {
    fontFamily: "Crimson Pro, Georgia, serif",
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

