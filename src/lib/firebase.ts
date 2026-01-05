"use client";

import type { FirebaseApp } from "firebase/app";
import type { Analytics } from "firebase/analytics";

let firebaseApp: FirebaseApp | null = null;
let analytics: Analytics | null = null;
let initPromise: Promise<{ app: FirebaseApp; analytics: Analytics | null }> | null = null;

/**
 * Lazily initializes Firebase on the client side only.
 * This function is idempotent - calling it multiple times returns the same instance.
 * 
 * Benefits of this approach:
 * - Firebase SDK is code-split and loaded only when needed
 * - No SSR/build-time errors (runs only in browser)
 * - Safe for Firebase Hosting CI/CD pipelines
 */
export async function initializeFirebase(): Promise<{
  app: FirebaseApp;
  analytics: Analytics | null;
}> {
  // Return cached instance if already initialized
  if (firebaseApp) {
    return { app: firebaseApp, analytics };
  }

  // Return existing promise if initialization is in progress
  if (initPromise) {
    return initPromise;
  }

  // Start initialization
  initPromise = (async () => {
    // Dynamic imports - these chunks only load when this function is called
    const [{ initializeApp }, { getAnalytics, isSupported }, { firebaseConfig }] =
      await Promise.all([
        import("firebase/app"),
        import("firebase/analytics"),
        import("./firebase-config"),
      ]);

    // Initialize the Firebase app
    firebaseApp = initializeApp(firebaseConfig);

    // Initialize Analytics only if supported (not in SSR, not blocked by browser)
    try {
      const analyticsSupported = await isSupported();
      if (analyticsSupported) {
        analytics = getAnalytics(firebaseApp);
      }
    } catch {
      // Analytics not available - that's fine, continue without it
      console.info("Firebase Analytics not available in this environment");
    }

    return { app: firebaseApp, analytics };
  })();

  return initPromise;
}

/**
 * Get the Firebase app instance (must call initializeFirebase first)
 */
export function getFirebaseApp(): FirebaseApp | null {
  return firebaseApp;
}

/**
 * Get the Analytics instance (must call initializeFirebase first)
 */
export function getFirebaseAnalytics(): Analytics | null {
  return analytics;
}

