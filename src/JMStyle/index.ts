/**
 * JMStyle - Theming System
 * 
 * Usage:
 * 
 * 1. Wrap your app with JMStyleProvider (already done in providers.tsx)
 * 
 * 2. Use the hook in any component:
 *    ```tsx
 *    import { useJMStyle } from "@/JMStyle";
 *    
 *    function MyComponent() {
 *      const { theme } = useJMStyle();
 *      return <img src={theme.logo} alt={theme.logoAlt} />;
 *    }
 *    ```
 * 
 * 3. For server components, import theme directly:
 *    ```tsx
 *    import { getTheme } from "@/JMStyle";
 *    
 *    const theme = getTheme("johnmarr");
 *    ```
 */

// Provider and hook
export { JMStyleProvider, useJMStyle } from "./JMStyleProvider";

// Theme utilities
export { themes, defaultTheme, getTheme } from "./themes";

// Types
export type { JMTheme, ThemeName } from "./themes";

