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
 *      return (
 *        <div style={{ background: theme.surfaces.base, color: theme.text.primary }}>
 *          <button style={{ background: theme.gradient.css }}>Click me</button>
 *        </div>
 *      );
 *    }
 *    ```
 * 
 * 3. For server components, import theme directly:
 *    ```tsx
 *    import { getTheme, getSurface } from "@/JMStyle";
 *    
 *    const theme = getTheme("johnmarr");
 *    const cardBg = getSurface(1); // elevated surface
 *    ```
 */

// Provider and hook
export { JMStyleProvider, useJMStyle } from "./JMStyleProvider";

// Theme utilities
export { themes, defaultTheme, getTheme, getGradientButton, getSurface } from "./themes";

// Types
export type { JMTheme, ThemeName } from "./themes";

