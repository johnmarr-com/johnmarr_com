import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

let adminApp: App | undefined = undefined;

function getAdminApp(): App {
  if (adminApp) return adminApp;
  
  const existingApps = getApps();
  const existingApp = existingApps[0];
  if (existingApp) {
    adminApp = existingApp;
    return adminApp;
  }

  // Initialize with service account credentials from environment
  const projectId = process.env["FIREBASE_PROJECT_ID"]?.trim();
  const clientEmail = process.env["FIREBASE_CLIENT_EMAIL"]?.trim();
  const privateKey = process.env["FIREBASE_PRIVATE_KEY"]?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase Admin credentials. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY environment variables."
    );
  }

  adminApp = initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });

  return adminApp;
}

/**
 * Set admin custom claim on a user by email
 */
export async function setAdminRole(email: string): Promise<void> {
  const app = getAdminApp();
  const auth = getAuth(app);
  
  const user = await auth.getUserByEmail(email);
  await auth.setCustomUserClaims(user.uid, { 
    ...user.customClaims,
    admin: true 
  });
}

/**
 * Remove admin custom claim from a user by email
 */
export async function removeAdminRole(email: string): Promise<void> {
  const app = getAdminApp();
  const auth = getAuth(app);
  
  const user = await auth.getUserByEmail(email);
  const currentClaims = (user.customClaims || {}) as Record<string, unknown>;
  delete currentClaims["admin"];
  await auth.setCustomUserClaims(user.uid, currentClaims);
}

/**
 * Check if a user has admin role by UID
 */
export async function isUserAdmin(uid: string): Promise<boolean> {
  const app = getAdminApp();
  const auth = getAuth(app);
  
  const user = await auth.getUser(uid);
  return (user.customClaims as { admin?: boolean })?.admin === true;
}

/**
 * Verify an ID token and return the decoded token with claims
 */
export async function verifyIdToken(idToken: string) {
  const app = getAdminApp();
  const auth = getAuth(app);
  
  return auth.verifyIdToken(idToken);
}

/**
 * Generate a sign-in link for email authentication
 */
export async function generateSignInLink(
  email: string,
  redirectUrl: string
): Promise<string> {
  const app = getAdminApp();
  const auth = getAuth(app);

  const actionCodeSettings = {
    url: redirectUrl,
    handleCodeInApp: true,
  };

  return auth.generateSignInWithEmailLink(email, actionCodeSettings);
}
