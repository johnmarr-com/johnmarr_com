// Firebase configuration
// These values are safe to expose client-side (they're identifiers, not secrets)
// Security is enforced via Firebase Security Rules

export const firebaseConfig = {
  apiKey: "AIzaSyDb-CCUzBuQnpZN2KBl_AYdjaPk80oJB6c",
  // First-party auth domain (served via the next.config /__/auth/* proxy) so the
  // Google OAuth redirect stays same-origin and survives iOS Safari/Chrome ITP.
  // Requires https://johnmarr.com/__/auth/handler in the OAuth client's redirect
  // URIs + johnmarr.com in its JavaScript origins (both added in GCP console).
  authDomain: "johnmarr.com",
  projectId: "johnmarr-com",
  storageBucket: "johnmarr-com.firebasestorage.app",
  messagingSenderId: "422149842206",
  appId: "1:422149842206:web:7104d91f455ea353d9950f",
  measurementId: "G-Q48QQF6PGH",
} as const;

