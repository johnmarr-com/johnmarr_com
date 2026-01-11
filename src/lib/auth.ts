"use client";

import type { User, Auth } from "firebase/auth";

let auth: Auth | null = null;
let authInitPromise: Promise<Auth> | null = null;

const HISTORICAL_USER_KEY = "historicalUser";

/**
 * Mark that a user has logged in on this browser before
 */
export function setHistoricalUser(): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(HISTORICAL_USER_KEY, "true");
  }
}

/**
 * Check if a user has ever logged in on this browser
 */
export function isHistoricalUser(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(HISTORICAL_USER_KEY) === "true";
}

/**
 * Clear the historical user flag (for testing)
 */
export function clearHistoricalUser(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(HISTORICAL_USER_KEY);
  }
}

/**
 * Lazily initializes Firebase Auth on the client side only.
 */
export async function getAuth(): Promise<Auth> {
  if (auth) return auth;
  if (authInitPromise) return authInitPromise;

  authInitPromise = (async () => {
    const [{ initializeFirebase }, { getAuth: firebaseGetAuth }] =
      await Promise.all([
        import("./firebase"),
        import("firebase/auth"),
      ]);

    const { app } = await initializeFirebase();
    auth = firebaseGetAuth(app);
    return auth;
  })();

  return authInitPromise;
}

/**
 * Sign in with Google popup
 */
export async function signInWithGoogle(): Promise<User> {
  const [authInstance, { GoogleAuthProvider, signInWithPopup }] =
    await Promise.all([
      getAuth(),
      import("firebase/auth"),
    ]);

  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(authInstance, provider);
  setHistoricalUser();
  return result.user;
}

/**
 * Send a passwordless sign-in link to the user's email
 */
export async function sendSignInLink(email: string): Promise<void> {
  const [authInstance, { sendSignInLinkToEmail }] = await Promise.all([
    getAuth(),
    import("firebase/auth"),
  ]);

  const actionCodeSettings = {
    // URL you want to redirect back to after email link click
    url: typeof window !== "undefined" 
      ? `${window.location.origin}/auth?email=${encodeURIComponent(email)}`
      : "http://localhost:3000/auth",
    handleCodeInApp: true,
  };

  await sendSignInLinkToEmail(authInstance, email, actionCodeSettings);
  
  // Save email to localStorage so we can complete sign-in when they return
  if (typeof window !== "undefined") {
    window.localStorage.setItem("emailForSignIn", email);
  }
}

/**
 * Complete the sign-in process when user clicks the email link
 */
export async function completeSignInWithEmailLink(
  email: string,
  url: string
): Promise<User | null> {
  const [authInstance, { isSignInWithEmailLink, signInWithEmailLink }] =
    await Promise.all([
      getAuth(),
      import("firebase/auth"),
    ]);

  if (!isSignInWithEmailLink(authInstance, url)) {
    return null;
  }

  const result = await signInWithEmailLink(authInstance, email, url);
  
  // Clear the saved email and mark as historical user
  if (typeof window !== "undefined") {
    window.localStorage.removeItem("emailForSignIn");
  }
  setHistoricalUser();
  
  return result.user;
}

/**
 * Check if current URL is a sign-in link
 */
export async function isEmailSignInLink(url: string): Promise<boolean> {
  const [authInstance, { isSignInWithEmailLink }] = await Promise.all([
    getAuth(),
    import("firebase/auth"),
  ]);

  return isSignInWithEmailLink(authInstance, url);
}

/**
 * Sign in with email and password (for existing users)
 */
export async function signInWithEmail(
  email: string,
  password: string
): Promise<User> {
  const [authInstance, { signInWithEmailAndPassword }] = await Promise.all([
    getAuth(),
    import("firebase/auth"),
  ]);

  const result = await signInWithEmailAndPassword(authInstance, email, password);
  setHistoricalUser();
  return result.user;
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<void> {
  const [authInstance, { signOut: firebaseSignOut }] = await Promise.all([
    getAuth(),
    import("firebase/auth"),
  ]);

  await firebaseSignOut(authInstance);
}

/**
 * Get the stored email for completing sign-in
 */
export function getStoredEmail(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("emailForSignIn");
}

