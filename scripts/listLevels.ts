 
// List user levels from Firestore. Used to align AI skill-tier naming with
// the existing user-progression labels.

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

async function main(): Promise<void> {
  const projectId = process.env["FIREBASE_PROJECT_ID"]?.trim();
  const clientEmail = process.env["FIREBASE_CLIENT_EMAIL"]?.trim();
  const privateKey = process.env["FIREBASE_PRIVATE_KEY"]?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    console.error("Missing Firebase Admin credentials in env.");
    process.exit(1);
  }

  const app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  const db = getFirestore(app);

  const snap = await db.collection("levels").orderBy("level", "asc").get();
  if (snap.empty) {
    console.log("No levels found in /levels.");
    return;
  }

  console.log(`\nFound ${snap.size} level${snap.size === 1 ? "" : "s"}:\n`);
  for (const d of snap.docs) {
    const data = d.data() as Record<string, unknown>;
    const lvl = String(data["level"]).padStart(2, " ");
    const name = String(data["name"] ?? "");
    const minPts = data["minPoints"] ?? data["pointsRequired"] ?? "—";
    console.log(`  L${lvl}  ${name.padEnd(24)}  min points: ${minPts}`);
    if (data["description"]) console.log(`        ${String(data["description"])}`);
  }
  console.log();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
