/**
 * Apply hand-written shortText drafts to every story in a pack, keyed by searchID.
 *
 *   node --env-file=.env.local --import tsx scripts/bullshiitakeApplyShorts.ts <shorts1.json> [shorts2.json ...]
 *
 * Each JSON file is an array of { searchID: number, shortText: string }.
 * Unlike bullshiitakeShorten.ts this OVERWRITES any existing shortText —
 * these drafts supersede everything previously stored. Word counts are
 * validated (≤75, matching the editor's counter) before any write happens.
 */
import { readFileSync } from "node:fs";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "../src/lib/firebase-admin";

const PACK_NAME = "BS-Basic";
const MAX_WORDS = 75;

interface ShortDraft {
  searchID: number;
  shortText: string;
}

const countWords = (t: string): number =>
  t.trim() ? t.trim().split(/\s+/).length : 0;

async function main(): Promise<void> {
  const files = process.argv.slice(2);
  if (files.length === 0) throw new Error("Usage: bullshiitakeApplyShorts.ts <shorts.json> [...]");

  const drafts = new Map<number, string>();
  for (const file of files) {
    const rows = JSON.parse(readFileSync(file, "utf8")) as ShortDraft[];
    for (const row of rows) {
      if (drafts.has(row.searchID)) throw new Error(`Duplicate searchID ${row.searchID} (${file})`);
      const words = countWords(row.shortText);
      if (words === 0 || words > MAX_WORDS) {
        throw new Error(`#${row.searchID} is ${words} words (max ${MAX_WORDS})`);
      }
      drafts.set(row.searchID, row.shortText.trim());
    }
  }
  console.log(`Loaded ${drafts.size} drafts from ${files.length} files`);

  const db = getAdminFirestore();
  const packSnap = await db
    .collection("bullshiitakePacks")
    .where("name", "==", PACK_NAME)
    .limit(1)
    .get();
  const packId = packSnap.docs[0]?.id;
  if (!packId) throw new Error(`Pack "${PACK_NAME}" not found`);

  const itemsSnap = await db.collection("bullshiitake").where("packId", "==", packId).get();
  console.log(`Pack "${PACK_NAME}": ${itemsSnap.size} stories in Firestore`);

  let written = 0;
  const unmatched: number[] = [];
  for (const doc of itemsSnap.docs) {
    const searchID = doc.data()["searchID"] as number | undefined;
    const short = searchID != null ? drafts.get(searchID) : undefined;
    if (short == null) {
      if (searchID != null) unmatched.push(searchID);
      continue;
    }
    await doc.ref.update({ shortText: short, updatedAt: FieldValue.serverTimestamp() });
    written++;
    drafts.delete(searchID as number);
  }

  console.log(`Wrote shortText on ${written} stories`);
  if (unmatched.length) console.warn(`No draft for searchIDs: ${unmatched.sort((a, b) => a - b).join(", ")}`);
  if (drafts.size) console.warn(`Drafts with no matching story: ${[...drafts.keys()].sort((a, b) => a - b).join(", ")}`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
