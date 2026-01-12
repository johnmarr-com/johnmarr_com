"use client";

import type { User, Auth } from "firebase/auth";

let auth: Auth | null = null;
let authInitPromise: Promise<Auth> | null = null;

const HISTORICAL_USER_KEY = "historicalUser";
const NAME_FOR_SIGNIN_KEY = "nameForSignIn";

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
 * Save user profile to Firestore
 */
export async function saveUserProfile(user: User): Promise<void> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, doc, setDoc, serverTimestamp } = await import("firebase/firestore");
  
  const { app } = await initializeFirebase();
  const db = getFirestore(app);
  
  const userRef = doc(db, "users", user.uid);
  await setDoc(userRef, {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

/**
 * Sign in with Google popup
 */
export async function signInWithGoogle(): Promise<User> {
  const [authInstance, { GoogleAuthProvider, signInWithPopup, getAdditionalUserInfo }] =
    await Promise.all([
      getAuth(),
      import("firebase/auth"),
    ]);

  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(authInstance, provider);
  
  // Only save user profile to Firestore for NEW users (signup, not login)
  const additionalInfo = getAdditionalUserInfo(result);
  if (additionalInfo?.isNewUser) {
    await saveUserProfile(result.user);
  }
  
  setHistoricalUser();
  return result.user;
}

/**
 * Send a passwordless sign-in link to the user's email
 */
export async function sendSignInLink(email: string, firstName?: string): Promise<void> {
  const [authInstance, { sendSignInLinkToEmail }] = await Promise.all([
    getAuth(),
    import("firebase/auth"),
  ]);

  // Build redirect URL with email and name in query params
  // This ensures the data survives even if the link opens in a new tab/browser
  let redirectUrl = typeof window !== "undefined" 
    ? `${window.location.origin}/auth?email=${encodeURIComponent(email)}`
    : "http://localhost:3000/auth";
  
  if (firstName) {
    redirectUrl += `&name=${encodeURIComponent(firstName)}`;
  }

  const actionCodeSettings = {
    url: redirectUrl,
    handleCodeInApp: true,
  };

  await sendSignInLinkToEmail(authInstance, email, actionCodeSettings);
  
  // Also save to localStorage as fallback (same browser/tab scenario)
  if (typeof window !== "undefined") {
    window.localStorage.setItem("emailForSignIn", email);
    if (firstName) {
      window.localStorage.setItem(NAME_FOR_SIGNIN_KEY, firstName);
    }
  }
}

/**
 * Complete the sign-in process when user clicks the email link
 * @param email - User's email
 * @param url - Current page URL (contains Firebase auth tokens)
 * @param firstName - Optional first name (from URL params for new signups)
 */
export async function completeSignInWithEmailLink(
  email: string,
  url: string,
  firstName?: string | null
): Promise<User | null> {
  const [authInstance, { isSignInWithEmailLink, signInWithEmailLink, updateProfile, getAdditionalUserInfo }] =
    await Promise.all([
      getAuth(),
      import("firebase/auth"),
    ]);

  if (!isSignInWithEmailLink(authInstance, url)) {
    return null;
  }

  const result = await signInWithEmailLink(authInstance, email, url);
  
  // Get name from parameter (URL) or fall back to localStorage
  const name = firstName || (typeof window !== "undefined" 
    ? window.localStorage.getItem(NAME_FOR_SIGNIN_KEY) 
    : null);
  
  // Only for NEW users (signup): set displayName and save to Firestore
  const additionalInfo = getAdditionalUserInfo(result);
  if (additionalInfo?.isNewUser && name && result.user) {
    // Update Firebase Auth displayName
    await updateProfile(result.user, { displayName: name });
    // Save user profile to Firestore (need to re-fetch user to get updated displayName)
    await saveUserProfile({ ...result.user, displayName: name } as User);
  }
  
  // Clear localStorage and mark as historical user
  if (typeof window !== "undefined") {
    window.localStorage.removeItem("emailForSignIn");
    window.localStorage.removeItem(NAME_FOR_SIGNIN_KEY);
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

/**
 * Get the stored name for completing sign-in
 */
export function getStoredName(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(NAME_FOR_SIGNIN_KEY);
}

