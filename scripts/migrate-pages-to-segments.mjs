// One-off: migrate existing pages to the PageSegment model.
//
// For each page that has NO segments yet, synthesize them from the legacy
// fields, non-destructively:
//   - featuredCarouselId        → a "carousel" segment
//   - rows (experiences.pageId) → a new named row collection (rows get
//                                 rowCollectionId; pageId is kept as vestigial)
//                                 + a "rows" segment
// The page's `segments` is then set, so it renders via the clean model. The
// legacy implicit-home data (no pageId / no carouselId) is left intact as a
// dormant fallback and only reported, never deleted.
//
//   node scripts/migrate-pages-to-segments.mjs

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
let seq = 0;
const segId = () => `mig-${Date.now()}-${seq++}`;
const now = () => FieldValue.serverTimestamp();

async function main() {
  const [pagesSnap, expSnap] = await Promise.all([
    db.collection("pages").get(),
    db.collection("experiences").get(),
  ]);

  let migrated = 0;
  for (const pageDoc of pagesSnap.docs) {
    const page = pageDoc.data();
    if (Array.isArray(page.segments) && page.segments.length > 0) {
      console.log(`  skip ${page.slug} (already has segments)`);
      continue;
    }

    const segments = [];
    if (page.featuredCarouselId) {
      segments.push({ id: segId(), type: "carousel", refId: page.featuredCarouselId });
    }

    const rowDocs = expSnap.docs.filter((d) => d.data().pageId === pageDoc.id);
    if (rowDocs.length > 0) {
      const colRef = await db.collection("rowCollections").add({
        name: `${page.title || "Page"} Rows`,
        creatorId: "system:migrate-pages-to-segments",
        createdAt: now(),
        updatedAt: now(),
      });
      for (const rd of rowDocs) {
        await rd.ref.update({ rowCollectionId: colRef.id, updatedAt: now() });
      }
      segments.push({ id: segId(), type: "rows", refId: colRef.id });
    }

    if (segments.length > 0) {
      await pageDoc.ref.update({ segments, updatedAt: now() });
      migrated++;
      console.log(
        `  migrated ${page.slug}: [${segments.map((s) => s.type).join(", ")}] (${rowDocs.length} rows)`,
      );
    } else {
      console.log(`  skip ${page.slug} (no legacy carousel/rows to migrate)`);
    }
  }

  // Orphan report (dormant fallback data; not touched).
  const legacyRows = expSnap.docs.filter((d) => !d.data().pageId).length;
  console.log(`\n✅ Migrated ${migrated} page(s).`);
  console.log(`   Legacy rows with no pageId (dormant fallback): ${legacyRows}`);
  console.log("   (Featured items with no carouselId remain the home default fallback.)");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
