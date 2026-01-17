"use client";

import type { User, Auth } from "firebase/auth";

let auth: Auth | null = null;
let authInitPromise: Promise<Auth> | null = null;

const HISTORICAL_USER_KEY = "historicalUser";
const NAME_FOR_SIGNIN_KEY = "nameForSignIn";
const SIGNUP_SOURCE_KEY = "signupSource";
const SOURCE_VISIT_DOC_KEY = "sourceVisitDocId";

/**
 * Store the signup source from URL param
 */
export function setSignupSource(source: string): void {
  if (typeof window !== "undefined" && source) {
    window.localStorage.setItem(SIGNUP_SOURCE_KEY, source);
  }
}

/**
 * Get the stored signup source
 */
export function getSignupSource(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(SIGNUP_SOURCE_KEY);
}

/**
 * Clear the stored signup source
 */
export function clearSignupSource(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(SIGNUP_SOURCE_KEY);
    window.localStorage.removeItem(SOURCE_VISIT_DOC_KEY);
  }
}

/**
 * Get the stored source visit document ID
 */
function getSourceVisitDocId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(SOURCE_VISIT_DOC_KEY);
}

/**
 * Log a source visit when user arrives at auth page
 * Creates a new document in Firestore and stores the doc ID for later update
 */
export async function logSourceVisit(source: string, isLoginMode: boolean): Promise<void> {
  console.log("[logSourceVisit] Logging visit with source:", source, "isLoginMode:", isLoginMode);
  try {
    const { initializeFirebase } = await import("./firebase");
    const { getFirestore, collection, addDoc, serverTimestamp } = await import("firebase/firestore");
    
    const { app } = await initializeFirebase();
    const db = getFirestore(app);
    
    const docRef = await addDoc(collection(db, "signup_funnel"), {
      source: source,
      isLoginMode: isLoginMode,
      visitedAt: serverTimestamp(),
      signedUp: false,
      signedUpAt: null,
      method: null,
      userId: null,
      email: null,
    });
    
    // Store doc ID for later update on successful signup
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SOURCE_VISIT_DOC_KEY, docRef.id);
    }
    
    console.log("[logSourceVisit] Successfully logged visit, doc ID:", docRef.id);
  } catch (error) {
    console.error("[logSourceVisit] Failed to log source visit:", error);
  }
}

/**
 * Update the source visit record when signup completes
 */
export async function logSignupSuccess(data: {
  method: "google" | "email";
  userId: string;
  email: string | null;
}): Promise<void> {
  const docId = getSourceVisitDocId();
  console.log("[logSignupSuccess] Attempting to update signup, docId:", docId, "data:", data);
  
  try {
    const { initializeFirebase } = await import("./firebase");
    const { getFirestore, doc, updateDoc, serverTimestamp, collection, addDoc } = await import("firebase/firestore");
    
    const { app } = await initializeFirebase();
    const db = getFirestore(app);
    
    if (docId) {
      // Update existing visit record
      await updateDoc(doc(db, "signup_funnel", docId), {
        signedUp: true,
        signedUpAt: serverTimestamp(),
        method: data.method,
        userId: data.userId,
        email: data.email,
      });
      console.log("[logSignupSuccess] Updated existing visit record:", docId);
    } else {
      // No visit record exists (direct signup without source), create new record
      const docRef = await addDoc(collection(db, "signup_funnel"), {
        source: "direct",
        isLoginMode: false,
        visitedAt: serverTimestamp(),
        signedUp: true,
        signedUpAt: serverTimestamp(),
        method: data.method,
        userId: data.userId,
        email: data.email,
      });
      console.log("[logSignupSuccess] Created new signup record:", docRef.id);
    }
  } catch (error) {
    console.error("[logSignupSuccess] Failed to log signup success:", error);
  }
}

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
  try {
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
  } catch (error) {
    console.error("Failed to save user profile to Firestore:", error);
  }
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
    clearSignupSource();
  }
  
  setHistoricalUser();
  return result.user;
}

/**
 * Send a passwordless sign-in link to the user's email
 */
export async function sendSignInLink(email: string, firstName?: string, source?: string | null): Promise<void> {
  const [authInstance, { sendSignInLinkToEmail }] = await Promise.all([
    getAuth(),
    import("firebase/auth"),
  ]);

  // Build redirect URL with email, name, and source in query params
  // This ensures the data survives even if the link opens in a new tab/browser
  let redirectUrl = typeof window !== "undefined" 
    ? `${window.location.origin}/auth?email=${encodeURIComponent(email)}`
    : "http://localhost:3000/auth";
  
  if (firstName) {
    redirectUrl += `&name=${encodeURIComponent(firstName)}`;
  }
  
  // Include source for analytics tracking
  const signupSource = source || getSignupSource();
  if (signupSource) {
    redirectUrl += `&source=${encodeURIComponent(signupSource)}`;
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
 * @param source - Optional signup source for analytics
 */
export async function completeSignInWithEmailLink(
  email: string,
  url: string,
  firstName?: string | null,
  _source?: string | null // Source is now tracked via logSourceVisit on page load
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
    // Save user profile to Firestore
    await saveUserProfile({ ...result.user, displayName: name } as User);
  }
  
  // Clear localStorage and mark as historical user
  if (typeof window !== "undefined") {
    window.localStorage.removeItem("emailForSignIn");
    window.localStorage.removeItem(NAME_FOR_SIGNIN_KEY);
  }
  clearSignupSource();
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

