"use client";

import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import { themes, defaultTheme, getTheme, type JMTheme, type ThemeName } from "./themes";

interface JMStyleContextValue {
  /** Current active theme */
  theme: JMTheme;
  /** Current theme name */
  themeName: ThemeName;
  /** Switch to a different theme */
  setTheme: (name: ThemeName) => void;
  /** All available theme names */
  availableThemes: ThemeName[];
}

const JMStyleContext = createContext<JMStyleContextValue | null>(null);

interface JMStyleProviderProps {
  children: React.ReactNode;
  /** Initial theme to use (defaults to "johnmarr") */
  initialTheme?: ThemeName;
}

/**
 * JMStyleProvider - Makes theme available throughout the app
 * 
 * Wrap your app with this provider to access theme values anywhere:
 * 
 * ```tsx
 * const { theme } = useJMStyle();
 * <img src={theme.logo} alt={theme.logoAlt} />
 * ```
 */
export function JMStyleProvider({ 
  children, 
  initialTheme = defaultTheme 
}: JMStyleProviderProps) {
  const [themeName, setThemeName] = useState<ThemeName>(initialTheme);
  
  const theme = useMemo(() => getTheme(themeName), [themeName]);
  
  const setTheme = useCallback((name: ThemeName) => {
    if (themes[name]) {
      setThemeName(name);
    }
  }, []);
  
  const availableThemes = useMemo(() => Object.keys(themes) as ThemeName[], []);
  
  const value = useMemo(() => ({
    theme,
    themeName,
    setTheme,
    availableThemes,
  }), [theme, themeName, setTheme, availableThemes]);
  
  return (
    <JMStyleContext.Provider value={value}>
      {children}
    </JMStyleContext.Provider>
  );
}

/**
 * Hook to access the current theme and style utilities
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { theme } = useJMStyle();
 *   return <div style={{ color: theme.text.accent }}>{theme.displayName}</div>;
 * }
 * ```
 */
export function useJMStyle(): JMStyleContextValue {
  const context = useContext(JMStyleContext);
  
  if (!context) {
    throw new Error("useJMStyle must be used within a JMStyleProvider");
  }
  
  return context;
}

/**
 * Get theme without provider (for server components or static usage)
 * Note: This won't be reactive to theme changes
 */
export { getTheme, themes, defaultTheme };
export type { JMTheme, ThemeName };

