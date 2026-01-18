// Firebase exports
export { FirebaseProvider, useFirebase } from "./FirebaseProvider";
export { initializeFirebase, getFirebaseApp, getFirebaseAnalytics } from "./firebase";
export { firebaseConfig } from "./firebase-config";

// Auth exports
export { AuthProvider, useAuth } from "./AuthProvider";
export { AuthGate } from "./AuthGate";
export { AdminGate } from "./AdminGate";
export {
  getAuth,
  signInWithGoogle,
  signInWithEmail,
  sendSignInLink,
  completeSignInWithEmailLink,
  isEmailSignInLink,
  signOut,
  saveUserProfile,
  logSourceVisit,
  logSignupAttempt,
  logSignupSuccess,
  logEmailSignupSuccess,
  // Admin role management (client-side)
  grantAdminRole,
  revokeAdminRole,
} from "./auth";

