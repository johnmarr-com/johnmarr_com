"use client";

import type { User, Auth } from "firebase/auth";

let auth: Auth | null = null;
let authInitPromise: Promise<Auth> | null = null;

const HISTORICAL_USER_KEY = "historicalUser";

/**
 * Log a source visit when user arrives at auth page
 * Returns the doc ID to pass through the signup flow
 */
export async function logSourceVisit(source: string, isLoginMode: boolean): Promise<string | null> {
  console.log("[logSourceVisit] Logging visit with source:", source, "isLoginMode:", isLoginMode);
  try {
    const { initializeFirebase } = await import("./firebase");
    const { getFirestore, collection, addDoc, serverTimestamp } = await import("firebase/firestore");
    
    const { app } = await initializeFirebase();
    const db = getFirestore(app);
    
    const docRef = await addDoc(collection(db, "signup_funnel"), {
      source: source,
      isLoginMode: isLoginMode,
      status: "visited",
      visitedAt: serverTimestamp(),
      // Signup attempt fields (updated when user clicks signup button)
      signupAttemptedAt: null,
      method: null,
      firstName: null,
      email: null,
      // Signup completion fields (updated when signup succeeds)
      signedUpAt: null,
      userId: null,
      displayName: null,
    });
    
    console.log("[logSourceVisit] Successfully logged visit, doc ID:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("[logSourceVisit] Failed to log source visit:", error);
    return null;
  }
}

/**
 * Log when user attempts signup (clicks Google or submits email form)
 * Returns the funnel ID to pass to the email link
 */
export async function logSignupAttempt(data: {
  funnelId: string | null;
  method: "google" | "email";
  firstName?: string | null;
  email?: string | null;
}): Promise<string | null> {
  console.log("[logSignupAttempt] Logging signup attempt, funnelId:", data.funnelId, "data:", data);
  
  try {
    const { initializeFirebase } = await import("./firebase");
    const { getFirestore, doc, updateDoc, serverTimestamp, collection, addDoc } = await import("firebase/firestore");
    
    const { app } = await initializeFirebase();
    const db = getFirestore(app);
    
    const updateData = {
      status: "requested",
      signupAttemptedAt: serverTimestamp(),
      method: data.method,
      firstName: data.firstName || null,
      email: data.email || null,
    };
    
    if (data.funnelId) {
      // Update existing visit record
      await updateDoc(doc(db, "signup_funnel", data.funnelId), updateData);
      console.log("[logSignupAttempt] Updated existing visit record:", data.funnelId);
      return data.funnelId;
    } else {
      // No visit record exists (direct signup without source), create new record
      const docRef = await addDoc(collection(db, "signup_funnel"), {
        source: "direct",
        isLoginMode: false,
        visitedAt: serverTimestamp(),
        ...updateData,
        signedUpAt: null,
        userId: null,
        displayName: null,
      });
      console.log("[logSignupAttempt] Created new record:", docRef.id);
      return docRef.id;
    }
  } catch (error) {
    console.error("[logSignupAttempt] Failed to log signup attempt:", error);
    return data.funnelId;
  }
}

/**
 * Update signup funnel for email signup success using the funnel doc ID from the email link
 */
export async function logEmailSignupSuccess(data: {
  funnelId: string;
  userId: string;
  displayName: string | null;
  email: string;
}): Promise<void> {
  console.log("[logEmailSignupSuccess] Updating funnel by ID:", data.funnelId);
  
  try {
    const { initializeFirebase } = await import("./firebase");
    const { getFirestore, doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
    
    const { app } = await initializeFirebase();
    const db = getFirestore(app);
    
    await updateDoc(doc(db, "signup_funnel", data.funnelId), {
      status: "success",
      signedUpAt: serverTimestamp(),
      userId: data.userId,
      displayName: data.displayName,
      email: data.email, // Update email in case it changed
    });
    
    console.log("[logEmailSignupSuccess] Updated funnel record:", data.funnelId);
  } catch (error) {
    console.error("[logEmailSignupSuccess] Failed to update funnel:", error);
  }
}

/**
 * Update the source visit record when signup completes successfully
 */
export async function logSignupSuccess(data: {
  funnelId: string | null;
  method: "google" | "email";
  userId: string;
  email: string | null;
  displayName: string | null;
}): Promise<void> {
  console.log("[logSignupSuccess] Attempting to update signup, funnelId:", data.funnelId, "data:", data);
  
  try {
    const { initializeFirebase } = await import("./firebase");
    const { getFirestore, doc, updateDoc, serverTimestamp, collection, addDoc } = await import("firebase/firestore");
    
    const { app } = await initializeFirebase();
    const db = getFirestore(app);
    
    const successData = {
      status: "success",
      signedUpAt: serverTimestamp(),
      userId: data.userId,
      email: data.email,
      displayName: data.displayName,
    };
    
    if (data.funnelId) {
      // Update existing visit record
      await updateDoc(doc(db, "signup_funnel", data.funnelId), successData);
      console.log("[logSignupSuccess] Updated existing visit record:", data.funnelId);
    } else {
      // No visit record exists (direct signup without source), create new record
      const docRef = await addDoc(collection(db, "signup_funnel"), {
        source: "direct",
        isLoginMode: false,
        visitedAt: serverTimestamp(),
        signupAttemptedAt: serverTimestamp(),
        method: data.method,
        firstName: null,
        ...successData,
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
 * @param funnelId - Funnel doc ID for tracking signup success
 */
export async function signInWithGoogle(funnelId?: string | null): Promise<User> {
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
    // Log signup success - fire and forget
    logSignupSuccess({
      funnelId: funnelId || null,
      method: "google",
      userId: result.user.uid,
      email: result.user.email,
      displayName: result.user.displayName,
    });
  }
  
  setHistoricalUser();
  return result.user;
}

/**
 * Send a passwordless sign-in link to the user's email via Resend
 * @param email - User's email
 * @param firstName - Optional first name for new signups
 * @param funnelId - Funnel doc ID for tracking signup success
 */
export async function sendSignInLink(email: string, firstName?: string, funnelId?: string | null): Promise<void> {
  console.log("[sendSignInLink] Starting email send for:", email);

  try {
    const response = await fetch("/api/auth/send-signin-link", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        firstName,
        funnelId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to send sign-in link");
    }

    console.log("[sendSignInLink] Email sent successfully via Resend");
  } catch (error) {
    console.error("[sendSignInLink] Error:", error);
    throw error;
  }
}

/**
 * Complete the sign-in process when user clicks the email link
 * @param email - User's email
 * @param url - Current page URL (contains Firebase auth tokens)
 * @param firstName - Optional first name (from URL params for new signups)
 * @param funnelId - Optional funnel doc ID for tracking signup success
 */
export async function completeSignInWithEmailLink(
  email: string,
  url: string,
  firstName?: string | null,
  funnelId?: string | null
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
  
  // Only for NEW users (signup): set displayName and save to Firestore
  const additionalInfo = getAdditionalUserInfo(result);
  if (additionalInfo?.isNewUser && firstName && result.user) {
    // Update Firebase Auth displayName
    await updateProfile(result.user, { displayName: firstName });
    // Save user profile to Firestore
    await saveUserProfile({ ...result.user, displayName: firstName } as User);
    // Log email signup success - fire and forget
    if (funnelId) {
      logEmailSignupSuccess({
        funnelId: funnelId,
        userId: result.user.uid,
        displayName: firstName,
        email: email,
      });
    }
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


