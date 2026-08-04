/**
 * Set a pack's physical-card prefix and stamp it onto every item in the pack.
 *
 *   node --env-file=.env.local --import tsx scripts/bullshiitakeSetPrefix.ts <packName> <prefix>
 *   e.g. … bullshiitakeSetPrefix.ts BS-Basic B
 *
 * Cards then resolve as <prefix>-<searchID> (B-1 … B-120) for physical-deck
 * lookup in the app. Prefix is normalized: trimmed, uppercased, max 2 chars.
 */
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "../src/lib/firebase-admin";

const packName = process.argv[2];
const rawPrefix = process.argv[3];

async function main(): Promise<void> {
  if (!packName || !rawPrefix) {
    throw new Error("Usage: bullshiitakeSetPrefix.ts <packName> <prefix>");
  }
  const prefix = rawPrefix.trim().toUpperCase().slice(0, 2);
  if (!prefix) throw new Error("Prefix is empty after normalization");

  const db = getAdminFirestore();
  const packSnap = await db
    .collection("bullshiitakePacks")
    .where("name", "==", packName)
    .limit(1)
    .get();
  const packDoc = packSnap.docs[0];
  if (!packDoc) throw new Error(`Pack "${packName}" not found`);

  await packDoc.ref.update({ searchPrefix: prefix, updatedAt: FieldValue.serverTimestamp() });
  console.log(`Pack "${packName}": searchPrefix = "${prefix}"`);

  const itemsSnap = await db.collection("bullshiitake").where("packId", "==", packDoc.id).get();
  let batch = db.batch();
  let inBatch = 0;
  let written = 0;
  for (const item of itemsSnap.docs) {
    batch.update(item.ref, { searchPrefix: prefix, updatedAt: FieldValue.serverTimestamp() });
    written++;
    if (++inBatch === 450) {
      await batch.commit();
      batch = db.batch();
      inBatch = 0;
    }
  }
  if (inBatch > 0) await batch.commit();
  console.log(`Stamped "${prefix}" onto ${written} items`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
