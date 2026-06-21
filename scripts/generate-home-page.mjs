// One-off: create a "home"-slug Page that mirrors the current hard-coded home.
//
// Non-destructive COPY — the live `/` is untouched. It creates:
//   1. a "Home" featured carousel,
//   2. copies of the default featured items (no carouselId) into that carousel,
//   3. a Page { slug: "home", hideHeader: true, isPublished: true } pointing at it,
//   4. copies of the home rows (experiences with no pageId) under that page.
//
// View the result at /home. Re-run with --force to duplicate again.
//
//   node scripts/generate-home-page.mjs

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf-8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    }),
);

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}

const db = getFirestore();
const force = process.argv.includes("--force");
const creatorId = "system:generate-home-page";

function stamps() {
  return { createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() };
}

async function main() {
  const existing = await db.collection("pages").where("slug", "==", "home").limit(1).get();
  if (!existing.empty && !force) {
    console.log(`A page with slug "home" already exists (${existing.docs[0].id}). Use --force to create another.`);
    return;
  }

  // 1. "Home" carousel
  const carouselRef = await db.collection("featuredCarousels").add({
    name: "Home",
    creatorId,
    ...stamps(),
  });
  const carouselId = carouselRef.id;

  // 2. Copy default featured items (no carouselId) into the new carousel
  const featuredSnap = await db.collection("featured").get();
  const defaults = featuredSnap.docs.filter((d) => !d.data().carouselId);
  for (const d of defaults) {
    await db.collection("featured").add({ ...d.data(), carouselId, ...stamps() });
  }

  // 3. The "home" page (no visible header), pointing at the copied carousel
  const pageRef = await db.collection("pages").add({
    slug: "home",
    title: "Home",
    hideHeader: true,
    isPublished: true,
    featuredCarouselId: carouselId,
    creatorId,
    ...stamps(),
  });
  const pageId = pageRef.id;

  // 4. Copy home rows (experiences with no pageId, or pageId === "home")
  const expSnap = await db.collection("experiences").get();
  const homeRows = expSnap.docs.filter((d) => {
    const p = d.data().pageId;
    return !p || p === "home";
  });
  for (const d of homeRows) {
    await db.collection("experiences").add({ ...d.data(), pageId, ...stamps() });
  }

  console.log("✅ Home page generated.");
  console.log(`   page id:       ${pageId}  (slug: /home)`);
  console.log(`   carousel id:   ${carouselId}  ("Home")`);
  console.log(`   featured copied: ${defaults.length}`);
  console.log(`   rows copied:     ${homeRows.length}`);
  console.log("   View it at /home");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
