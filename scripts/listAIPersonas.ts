 
// List the AI personas stored in Firestore (both active and inactive).
// Usage:
//   npm run setup:admin   # first time — to ensure env is wired
//   node --env-file=.env.local --import tsx scripts/listAIPersonas.ts

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

  const snap = await db.collection("aiPersonas").orderBy("order", "asc").get();

  if (snap.empty) {
    console.log("No personas found in /aiPersonas.");
    return;
  }

  console.log(`\nFound ${snap.size} persona${snap.size === 1 ? "" : "s"} in /aiPersonas:\n`);
  for (const doc of snap.docs) {
    const d = doc.data() as Record<string, unknown>;
    const stats = (d["stats"] ?? {}) as Record<string, number>;
    console.log(
      `— ${String(d["name"]).padEnd(20)}` +
        `  style=${String(d["playStyle"]).padEnd(12)}` +
        `  active=${String(d["isActive"] ?? true).padEnd(5)}` +
        `  games=${stats["gamesPlayed"] ?? 0}  w/l=${stats["wins"] ?? 0}/${stats["losses"] ?? 0}`,
    );
    if (d["description"]) console.log(`    "${d["description"]}"`);
    if (d["prompt"]) {
      const pstr = String(d["prompt"]);
      const short = pstr.length > 180 ? `${pstr.slice(0, 180)}…` : pstr;
      console.log(`    prompt: ${short}`);
    }
    console.log();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
