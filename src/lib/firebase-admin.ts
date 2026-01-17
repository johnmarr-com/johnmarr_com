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
  const projectId = process.env["FIREBASE_PROJECT_ID"];
  const clientEmail = process.env["FIREBASE_CLIENT_EMAIL"];
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
