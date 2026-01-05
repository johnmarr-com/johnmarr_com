"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { FirebaseApp } from "firebase/app";
import type { Analytics } from "firebase/analytics";

interface FirebaseContextValue {
  app: FirebaseApp | null;
  analytics: Analytics | null;
  isLoading: boolean;
  isInitialized: boolean;
}

const FirebaseContext = createContext<FirebaseContextValue>({
  app: null,
  analytics: null,
  isLoading: true,
  isInitialized: false,
});

interface FirebaseProviderProps {
  children: ReactNode;
}

/**
 * Firebase Provider - Lazily initializes Firebase after the component mounts.
 * 
 * This ensures:
 * - Firebase only loads in the browser (not during SSR or build)
 * - The app renders immediately, Firebase loads in the background
 * - No blocking of initial page paint
 */
export function FirebaseProvider({ children }: FirebaseProviderProps) {
  const [state, setState] = useState<FirebaseContextValue>({
    app: null,
    analytics: null,
    isLoading: true,
    isInitialized: false,
  });

  useEffect(() => {
    // Only run on client
    if (typeof window === "undefined") return;

    let mounted = true;

    const init = async () => {
      try {
        // Dynamic import of our Firebase initialization module
        const { initializeFirebase } = await import("./firebase");
        const { app, analytics } = await initializeFirebase();

        if (mounted) {
          setState({
            app,
            analytics,
            isLoading: false,
            isInitialized: true,
          });
        }
      } catch (error) {
        console.error("Failed to initialize Firebase:", error);
        if (mounted) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            isInitialized: false,
          }));
        }
      }
    };

    void init();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <FirebaseContext.Provider value={state}>
      {children}
    </FirebaseContext.Provider>
  );
}

/**
 * Hook to access Firebase services.
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { app, analytics, isInitialized } = useFirebase();
 *   
 *   useEffect(() => {
 *     if (analytics) {
 *       logEvent(analytics, 'page_view');
 *     }
 *   }, [analytics]);
 * }
 * ```
 */
export function useFirebase(): FirebaseContextValue {
  const context = useContext(FirebaseContext);
  return context;
}

