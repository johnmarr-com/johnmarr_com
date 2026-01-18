/**
 * One-time setup script to make hello@johnmarr.com the initial admin
 * 
 * Run this script once to set up the initial admin user.
 * 
 * Usage:
 *   npx tsx scripts/setup-initial-admin.ts
 * 
 * Required environment variables (in .env.local or exported):
 *   - FIREBASE_PROJECT_ID
 *   - FIREBASE_CLIENT_EMAIL  
 *   - FIREBASE_PRIVATE_KEY
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const INITIAL_ADMIN_EMAIL = "hello@johnmarr.com";

async function setupInitialAdmin() {
  console.log("🔐 Setting up initial admin...\n");

  // Load environment variables
  const projectId = process.env["FIREBASE_PROJECT_ID"]?.trim();
  const clientEmail = process.env["FIREBASE_CLIENT_EMAIL"]?.trim();
  const privateKey = process.env["FIREBASE_PRIVATE_KEY"]?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    console.error("❌ Missing Firebase Admin credentials!");
    console.error("Make sure these environment variables are set:");
    console.error("  - FIREBASE_PROJECT_ID");
    console.error("  - FIREBASE_CLIENT_EMAIL");
    console.error("  - FIREBASE_PRIVATE_KEY");
    process.exit(1);
  }

  // Initialize Firebase Admin
  const app = initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });

  const auth = getAuth(app);

  try {
    // Get the user by email
    console.log(`📧 Looking up user: ${INITIAL_ADMIN_EMAIL}`);
    const user = await auth.getUserByEmail(INITIAL_ADMIN_EMAIL);
    console.log(`✓ Found user: ${user.uid}`);

    // Check current claims
    const currentClaims = user.customClaims || {};
    console.log(`📋 Current claims:`, currentClaims);

    if (currentClaims["admin"] === true) {
      console.log(`\n✅ User is already an admin!`);
      process.exit(0);
    }

    // Set admin claim
    console.log(`\n🔧 Setting admin claim...`);
    await auth.setCustomUserClaims(user.uid, {
      ...currentClaims,
      admin: true,
    });

    // Verify the claim was set
    const updatedUser = await auth.getUser(user.uid);
    const updatedClaims = updatedUser.customClaims || {};
    
    if (updatedClaims["admin"] === true) {
      console.log(`✅ Successfully set admin role for ${INITIAL_ADMIN_EMAIL}`);
      console.log(`\n📋 Updated claims:`, updatedClaims);
      console.log(`\n⚠️  Note: The user will need to sign out and sign back in`);
      console.log(`   (or wait up to 1 hour) for the claim to take effect.`);
    } else {
      console.error(`❌ Failed to verify admin claim was set`);
      process.exit(1);
    }

  } catch (error) {
    if ((error as { code?: string }).code === "auth/user-not-found") {
      console.error(`\n❌ User not found: ${INITIAL_ADMIN_EMAIL}`);
      console.error(`   Make sure this user has signed up first!`);
    } else {
      console.error(`\n❌ Error:`, error);
    }
    process.exit(1);
  }

  process.exit(0);
}

setupInitialAdmin();
