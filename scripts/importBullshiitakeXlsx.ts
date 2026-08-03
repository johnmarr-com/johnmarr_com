/**
 * Import Bull Shiitake story elements from an Excel workbook into a pack.
 *
 *   node --env-file=.env.local --import tsx scripts/importBullshiitakeXlsx.ts [--dry-run] [file] [packName]
 *
 * Workbook shape (no header rows):
 *   "TRUE"          → col A story, col B citation URLs
 *   "PARTLY TRUE"   → col A story, col B citations, col C correction
 *   "BULL SHIITAKE" → col A story only
 *
 * Finds (or creates) the pack by name, dedupes on exact storyText so re-runs
 * are safe, derives a short title from each story's opening words (rename in
 * the pack editor anytime), and leaves image/video fields empty.
 */
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import Anthropic from "@anthropic-ai/sdk";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "../src/lib/firebase-admin";
import type { BSType } from "../src/lib/bullshiitake-packs";

const args = process.argv.slice(2).filter((a) => a !== "--dry-run");
const DRY_RUN = process.argv.includes("--dry-run");
const FILE = args[0] ?? "docs/BS-Basic.xlsx";
const PACK_NAME = args[1] ?? "BS-Basic";

/** Sheet-name (lowercased, squashed) → bsType. */
const SHEET_TYPES: Record<string, BSType> = {
  true: "true",
  partlytrue: "partlytrue",
  bullshiitake: "bullshiitake",
};

interface ParsedItem {
  title: string;
  bsType: BSType;
  storyText: string;
  citations?: string[];
  correction?: string;
}

/** Fallback title when the LLM pass fails: story's opening words. */
function deriveTitle(story: string): string {
  const firstLine = story.split("\n")[0] ?? story;
  const words = firstLine.trim().split(/\s+/);
  const head = words.slice(0, 8).join(" ").replace(/[.,;:!?'"”]+$/, "");
  return words.length > 8 ? `${head}…` : head;
}

/**
 * Title every story with Haiku: one-or-two-word, distinctive, Title Case
 * (e.g. "Molasses Flood", "Emu War"). Batched; per-item fallback to the
 * opening-words truncation on any failure.
 */
async function titleWithLLM(items: ParsedItem[]): Promise<void> {
  const client = new Anthropic({ apiKey: process.env["ANTHROPIC_API_KEY"] ?? "" });
  const BATCH = 40;

  for (let start = 0; start < items.length; start += BATCH) {
    const slice = items.slice(start, start + BATCH);
    const numbered = slice
      .map((item, i) => `${i}: ${item.storyText.slice(0, 400).replace(/\s+/g, " ")}`)
      .join("\n\n");
    try {
      const res = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        temperature: 0.4,
        messages: [
          {
            role: "user",
            content: `For each numbered story below, produce a punchy display title of ONE or TWO words (three only if truly unavoidable), Title Case, no punctuation, distinctive to that story (e.g. "Molasses Flood", "Emu War", "Headless Mike"). Respond with ONLY a JSON array of strings, index-aligned to the story numbers, no prose.\n\n${numbered}`,
          },
        ],
      });
      const text = res.content[0]?.type === "text" ? res.content[0].text : "";
      // Model may wrap the array in ```json fences — take [first "[", last "]"].
      const titles = JSON.parse(
        text.slice(text.indexOf("["), text.lastIndexOf("]") + 1),
      ) as string[];
      slice.forEach((item, i) => {
        const t = typeof titles[i] === "string" ? titles[i]!.trim() : "";
        item.title = t || deriveTitle(item.storyText);
      });
      console.log(`Titled ${Math.min(start + BATCH, items.length)}/${items.length}`);
    } catch (err) {
      console.warn(`Title batch at ${start} failed — using fallback titles:`, err);
      slice.forEach((item) => {
        item.title = deriveTitle(item.storyText);
      });
    }
  }
}

/** Pull URL tokens out of a cell (newline / space / comma separated). */
function parseCitations(cell: string): string[] {
  return cell
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter((t) => /^https?:\/\//i.test(t));
}

function parseWorkbook(path: string): ParsedItem[] {
  const wb = XLSX.read(readFileSync(path));
  const items: ParsedItem[] = [];

  for (const sheetName of wb.SheetNames) {
    const key = sheetName.toLowerCase().replace(/[^a-z]/g, "");
    const bsType = SHEET_TYPES[key];
    if (!bsType) {
      console.warn(`Skipping unrecognized sheet "${sheetName}"`);
      continue;
    }
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: "" });

    for (const row of rows) {
      const storyText = String(row[0] ?? "").trim();
      if (!storyText) continue; // empty padding row

      const item: ParsedItem = {
        title: deriveTitle(storyText),
        bsType,
        storyText,
      };
      const citations = parseCitations(String(row[1] ?? ""));
      if (citations.length > 0) item.citations = citations;
      const correction = String(row[2] ?? "").trim();
      if (bsType === "partlytrue" && correction) item.correction = correction;
      items.push(item);
    }
  }
  return items;
}

/** --retitle: re-run the LLM titling over every item already in the pack. */
async function retitle(): Promise<void> {
  const db = getAdminFirestore();
  const packSnap = await db
    .collection("bullshiitakePacks")
    .where("name", "==", PACK_NAME)
    .limit(1)
    .get();
  const packId = packSnap.docs[0]?.id;
  if (!packId) throw new Error(`Pack "${PACK_NAME}" not found`);

  const itemsSnap = await db.collection("bullshiitake").where("packId", "==", packId).get();
  const rows = itemsSnap.docs.map((doc) => ({
    ref: doc.ref,
    item: {
      title: String(doc.data()["title"] ?? ""),
      bsType: doc.data()["bsType"] as BSType,
      storyText: String(doc.data()["storyText"] ?? ""),
    } as ParsedItem,
  }));
  console.log(`Retitling ${rows.length} items in "${PACK_NAME}"…`);
  await titleWithLLM(rows.map((r) => r.item));

  const batch = db.batch();
  rows.forEach(({ ref, item }) =>
    batch.update(ref, { title: item.title, updatedAt: FieldValue.serverTimestamp() }),
  );
  await batch.commit();
  console.log("Sample titles:", rows.slice(0, 8).map((r) => r.item.title));
  console.log(`Done: ${rows.length} titles updated.`);
}

async function main(): Promise<void> {
  if (process.argv.includes("--retitle")) return retitle();
  const db = getAdminFirestore();
  const items = parseWorkbook(FILE);

  const byType = items.reduce<Record<string, number>>((acc, i) => {
    acc[i.bsType] = (acc[i.bsType] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`Parsed ${items.length} items from ${FILE}:`, byType);
  console.log(`Sample titles:`, items.slice(0, 3).map((i) => i.title));

  // Find or create the pack.
  const packSnap = await db
    .collection("bullshiitakePacks")
    .where("name", "==", PACK_NAME)
    .limit(1)
    .get();
  let packId: string;
  if (packSnap.docs[0]) {
    packId = packSnap.docs[0].id;
    console.log(`Pack "${PACK_NAME}" found: ${packId}`);
  } else {
    // Owner uid: reuse the CMS game doc's creator (the admin).
    const game = await db
      .collection("content")
      .where("contentType", "==", "game")
      .where("slug", "==", "bullshiitake")
      .limit(1)
      .get();
    const creatorId = String(game.docs[0]?.data()["creatorId"] ?? "");
    if (!creatorId) throw new Error("No creatorId found (bullshiitake game doc missing?)");
    if (DRY_RUN) {
      console.log(`[dry-run] would create pack "${PACK_NAME}" (creator ${creatorId})`);
      packId = "dry-run-pack";
    } else {
      const ref = await db.collection("bullshiitakePacks").add({
        name: PACK_NAME,
        creatorId,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      packId = ref.id;
      console.log(`Pack "${PACK_NAME}" created: ${packId}`);
    }
  }

  // Dedup against existing items (exact storyText) so re-runs are safe.
  const existing = DRY_RUN && packId === "dry-run-pack"
    ? { docs: [] as { data: () => Record<string, unknown> }[] }
    : await db.collection("bullshiitake").where("packId", "==", packId).get();
  const seen = new Set(existing.docs.map((d) => String(d.data()["storyText"] ?? "")));
  const fresh = items.filter((i) => !seen.has(i.storyText));
  console.log(`${items.length - fresh.length} already in pack; ${fresh.length} to write`);

  if (fresh.length > 0 && !DRY_RUN) {
    await titleWithLLM(fresh);
    console.log("Sample LLM titles:", fresh.slice(0, 6).map((i) => i.title));
  }

  if (DRY_RUN) {
    console.log("[dry-run] no writes. Example item:", JSON.stringify(fresh[0], null, 2)?.slice(0, 600));
    return;
  }

  // Owner uid for items = pack creator.
  const pack = await db.doc(`bullshiitakePacks/${packId}`).get();
  const creatorId = String(pack.data()?.["creatorId"] ?? "");

  let written = 0;
  for (let i = 0; i < fresh.length; i += 400) {
    const batch = db.batch();
    for (const item of fresh.slice(i, i + 400)) {
      const ref = db.collection("bullshiitake").doc();
      batch.set(ref, {
        packId,
        title: item.title,
        bsType: item.bsType,
        storyText: item.storyText,
        ...(item.citations ? { citations: item.citations } : {}),
        ...(item.correction ? { correction: item.correction } : {}),
        creatorId,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    written += Math.min(400, fresh.length - i);
    console.log(`…${written}/${fresh.length}`);
  }
  console.log(`Done: ${written} items written to pack "${PACK_NAME}" (${packId}).`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
