// Firebase exports
export { FirebaseProvider, useFirebase } from "./FirebaseProvider";
export { initializeFirebase, getFirebaseApp, getFirebaseAnalytics } from "./firebase";
export { firebaseConfig } from "./firebase-config";

// Auth exports
export { AuthProvider, useAuth } from "./AuthProvider";
export { AuthGate } from "./AuthGate";
export {
  getAuth,
  signInWithGoogle,
  signInWithEmail,
  sendSignInLink,
  completeSignInWithEmailLink,
  isEmailSignInLink,
  signOut,
  getStoredEmail,
  getStoredName,
  saveUserProfile,
  setHistoricalUser,
  isHistoricalUser,
  clearHistoricalUser,
} from "./auth";

