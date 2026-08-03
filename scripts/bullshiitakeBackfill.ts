/**
 * Backfill Bull Shiitake pack items with searchIDs, image prompts, and
 * AI-generated 2:1 banners.
 *
 *   node --env-file=.env.local --import tsx scripts/bullshiitakeBackfill.ts [packName] [--ids|--prompts|--images]
 *
 * Phases (all run when no flag given; each is idempotent/resumable):
 *   --ids      assign searchID 1..N in RANDOM order (items already numbered
 *              keep their number; the rest fill in from max+1)
 *   --prompts  write imagePrompt for items missing one (Haiku, batched)
 *   --images   sequentially generate a 2:1 Ideogram banner per item missing
 *              an imageURL (direct API — the app route's hourly caps would
 *              throttle 120 images), resize to 1200×600 JPEG, upload to
 *              Storage, link on the doc. Skips items that already have one,
 *              so re-runs never re-bill finished images.
 */
import Anthropic from "@anthropic-ai/sdk";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore, getAdminStorage } from "../src/lib/firebase-admin";
import type { BSType } from "../src/lib/bullshiitake-packs";

const flags = process.argv.slice(2).filter((a) => a.startsWith("--"));
const PACK_NAME = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "BS-Basic";
const runAll = flags.length === 0;
const run = (f: string): boolean => runAll || flags.includes(f);

interface Row {
  id: string;
  title: string;
  bsType: BSType;
  storyText: string;
  searchID?: number;
  imagePrompt?: string;
  imageURL?: string;
}

/** Mirrors the editor's buildBannerPrompt, with a banner-tuned format tail
 * (the app's default tail says "square format" — wrong for 2:1). */
function bannerPrompt(subject: string): string {
  return (
    `Wide 2:1 banner illustration: ${subject.trim()}. ` +
    "Subject shot with minimal background, minimal clutter, excellent lighting, " +
    "vibrant colors, cinematic composition, wide banner format."
  );
}

async function loadRows(db: FirebaseFirestore.Firestore): Promise<{ packId: string; rows: Row[] }> {
  const packSnap = await db
    .collection("bullshiitakePacks")
    .where("name", "==", PACK_NAME)
    .limit(1)
    .get();
  const packId = packSnap.docs[0]?.id;
  if (!packId) throw new Error(`Pack "${PACK_NAME}" not found`);
  const snap = await db.collection("bullshiitake").where("packId", "==", packId).get();
  const rows: Row[] = snap.docs.map((d) => {
    const x = d.data();
    const row: Row = {
      id: d.id,
      title: String(x["title"] ?? ""),
      bsType: x["bsType"] as BSType,
      storyText: String(x["storyText"] ?? ""),
    };
    if (typeof x["searchID"] === "number") row.searchID = x["searchID"];
    if (typeof x["imagePrompt"] === "string") row.imagePrompt = x["imagePrompt"];
    if (typeof x["imageURL"] === "string") row.imageURL = x["imageURL"];
    return row;
  });
  return { packId, rows };
}

/** Fisher–Yates. */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

async function phaseIds(db: FirebaseFirestore.Firestore, rows: Row[]): Promise<void> {
  const have = rows.filter((r) => r.searchID != null);
  const need = shuffle(rows.filter((r) => r.searchID == null));
  let next = have.reduce((m, r) => Math.max(m, r.searchID ?? 0), 0) + 1;
  console.log(`[ids] ${have.length} already numbered; assigning ${need.length} from #${next} (random order)`);
  if (need.length === 0) return;
  const batch = db.batch();
  for (const row of need) {
    row.searchID = next;
    batch.update(db.doc(`bullshiitake/${row.id}`), {
      searchID: next,
      updatedAt: FieldValue.serverTimestamp(),
    });
    next++;
  }
  await batch.commit();
  console.log(`[ids] done — pack now numbered 1..${next - 1}`);
}

async function phasePrompts(db: FirebaseFirestore.Firestore, rows: Row[]): Promise<void> {
  const need = rows.filter((r) => !r.imagePrompt?.trim());
  console.log(`[prompts] ${rows.length - need.length} have prompts; writing ${need.length}`);
  if (need.length === 0) return;

  const client = new Anthropic({ apiKey: process.env["ANTHROPIC_API_KEY"] ?? "" });
  const BATCH = 20;
  for (let start = 0; start < need.length; start += BATCH) {
    const slice = need.slice(start, start + BATCH);
    const numbered = slice
      .map((r, i) => `${i}: [${r.title}] ${r.storyText.slice(0, 400).replace(/\s+/g, " ")}`)
      .join("\n\n");
    const res = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      temperature: 0.5,
      messages: [
        {
          role: "user",
          content: `For each numbered story, write ONE image-generation prompt (a single sentence, max 30 words) depicting its most striking visual moment: concrete scene, subjects, setting, era. No words/text/lettering in the image. Respond with ONLY a JSON array of strings, index-aligned. No prose, no code fences.\n\n${numbered}`,
        },
      ],
    });
    const text = res.content[0]?.type === "text" ? res.content[0].text : "";
    const prompts = JSON.parse(
      text.slice(text.indexOf("["), text.lastIndexOf("]") + 1),
    ) as string[];
    const batch = db.batch();
    slice.forEach((row, i) => {
      const p = typeof prompts[i] === "string" ? prompts[i]!.trim() : "";
      if (!p) return;
      row.imagePrompt = p;
      batch.update(db.doc(`bullshiitake/${row.id}`), {
        imagePrompt: p,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
    console.log(`[prompts] ${Math.min(start + BATCH, need.length)}/${need.length}`);
  }
}

/** Direct Ideogram v3 generate (QUALITY, REALISTIC — the app's defaults), 2:1. */
async function ideogramGenerate(prompt: string): Promise<string | null> {
  const key = process.env["IDEOGRAM_API_KEY"];
  if (!key) throw new Error("IDEOGRAM_API_KEY missing from env");
  const form = new FormData();
  form.append("prompt", prompt);
  form.append("aspect_ratio", "2x1");
  form.append("rendering_speed", "QUALITY");
  form.append("style_type", "REALISTIC");
  form.append("magic_prompt", "ON");
  form.append("num_images", "1");
  const res = await fetch("https://api.ideogram.ai/v1/ideogram-v3/generate", {
    method: "POST",
    headers: { "Api-Key": key },
    body: form,
  });
  if (!res.ok) {
    console.error(`[images] Ideogram ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return null;
  }
  const data = (await res.json()) as { data?: { url?: string }[] };
  return data.data?.[0]?.url ?? null;
}

async function phaseImages(db: FirebaseFirestore.Firestore, rows: Row[]): Promise<void> {
  const need = rows.filter((r) => !r.imageURL && r.imagePrompt?.trim());
  const skippedNoPrompt = rows.filter((r) => !r.imageURL && !r.imagePrompt?.trim()).length;
  console.log(
    `[images] ${rows.length - need.length - skippedNoPrompt} have banners; generating ${need.length}` +
      (skippedNoPrompt ? `; ${skippedNoPrompt} skipped (no prompt)` : ""),
  );
  if (need.length === 0) return;

  const sharp = (await import("sharp")).default;
  const bucket = getAdminStorage();

  let done = 0;
  let failed = 0;
  for (const row of need) {
    try {
      const ephemeralUrl = await ideogramGenerate(bannerPrompt(row.imagePrompt!));
      if (!ephemeralUrl) throw new Error("generation returned no URL");

      const imgRes = await fetch(ephemeralUrl);
      if (!imgRes.ok) throw new Error(`download ${imgRes.status}`);
      const buffer = await sharp(Buffer.from(await imgRes.arrayBuffer()))
        .resize(1200, 600, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 40 })
        .toBuffer();

      const storagePath = `bullshiitake/items/${row.id}/banner.jpg`;
      await bucket.file(storagePath).save(buffer, {
        metadata: { contentType: "image/jpeg", cacheControl: "public, max-age=31536000" },
      });
      const imageURL = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media`;

      await db.doc(`bullshiitake/${row.id}`).update({
        imageURL,
        updatedAt: FieldValue.serverTimestamp(),
      });
      done++;
      console.log(`[images] ${done + failed}/${need.length} ✓ #${row.searchID} ${row.title}`);
    } catch (err) {
      failed++;
      console.error(
        `[images] ${done + failed}/${need.length} ✗ #${row.searchID} ${row.title}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
  console.log(`[images] done — ${done} generated, ${failed} failed (re-run to retry failures)`);
}

async function main(): Promise<void> {
  const db = getAdminFirestore();
  const { rows } = await loadRows(db);
  console.log(`Pack "${PACK_NAME}": ${rows.length} items`);
  if (run("--ids")) await phaseIds(db, rows);
  if (run("--prompts")) await phasePrompts(db, rows);
  if (run("--images")) await phaseImages(db, rows);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
