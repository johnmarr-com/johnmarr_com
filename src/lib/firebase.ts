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
    const [
      { initializeApp },
      { getAnalytics, isSupported },
      { initializeFirestore },
      { firebaseConfig },
    ] = await Promise.all([
      import("firebase/app"),
      import("firebase/analytics"),
      import("firebase/firestore"),
      import("./firebase-config"),
    ]);

    // Initialize the Firebase app
    firebaseApp = initializeApp(firebaseConfig);

    // Configure Firestore once, before any consumer calls getFirestore(app).
    // experimentalAutoDetectLongPolling fixes flaky real-time listeners on
    // iOS Safari (and corporate proxies) that throttle or break WebSockets:
    // the SDK detects an unhealthy WebSocket and transparently switches to
    // long-polling. Chrome / desktop browsers keep the fast WebSocket path.
    initializeFirestore(firebaseApp, {
      experimentalAutoDetectLongPolling: true,
    });

    // iOS Safari suspends long-lived connections on backgrounding / screen-lock
    // / network idle; the wedged Watch stream then only self-heals after the
    // SDK's internal ~30s recovery (the "20-second freeze"). Force an immediate
    // reconnect the moment iOS hands control back, instead of waiting it out.
    installConnectionRevival();

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
 * Force Firestore's realtime connection to rebuild.
 *
 * A `disableNetwork → enableNetwork` toggle drops a wedged Watch stream and
 * re-establishes a fresh one in ~1s, flushing current server state — versus
 * waiting ~30s for the SDK's internal recovery. Only affects READS (all client
 * writes go through Next.js API routes, not the Firestore SDK), so it can never
 * disrupt an in-flight command. Concurrent calls coalesce via the `kicking`
 * guard. Exported so a staleness watchdog (subscribeToSession) can call it.
 */
let kicking = false;
export async function kickFirestoreConnection(): Promise<void> {
  if (kicking || !firebaseApp) return;
  kicking = true;
  try {
    const { getFirestore, disableNetwork, enableNetwork } = await import("firebase/firestore");
    const db = getFirestore(firebaseApp);
    await disableNetwork(db);
    await enableNetwork(db);
  } catch {
    // best-effort; the periodic watchdog will try again
  } finally {
    kicking = false;
  }
}

let revivalInstalled = false;
function installConnectionRevival(): void {
  if (revivalInstalled || typeof window === "undefined") return;
  revivalInstalled = true;
  // Tab/app foregrounded — the prime moment an iOS-suspended stream is stale.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void kickFirestoreConnection();
  });
  // Network returned after a drop.
  window.addEventListener("online", () => void kickFirestoreConnection());
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

