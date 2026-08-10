import { NextRequest, NextResponse } from "next/server";
import { ZipArchive } from "archiver";
import { getAdminFirestore, getAdminStorage } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Build a zip of every rendered print card in a pack and return its URL.
 * GET /api/games/bullshiitake/download-cards?packId=…  →  { url, cards }
 *
 * The zip is assembled INTO Cloud Storage (cards/{packId}/_deck.zip) rather
 * than streamed through this route: full decks run hundreds of MB, and
 * Cloud Run truncates streamed responses around 32MiB — which shipped
 * corrupt zips. Storage downloads have no such limit. Public by design —
 * the card PNGs (and thus the zip) live under world-readable cards/.
 */
export async function GET(request: NextRequest) {
  const packId = request.nextUrl.searchParams.get("packId");
  if (!packId) {
    return NextResponse.json({ error: "Missing packId" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const packSnap = await db.doc(`bullshiitakePacks/${packId}`).get();
  const pack = packSnap.data();
  if (!packSnap.exists || !pack) {
    return NextResponse.json({ error: "Pack not found" }, { status: 404 });
  }

  const itemsSnap = await db
    .collection("bullshiitake")
    .where("packId", "==", packId)
    .get();
  const cards = itemsSnap.docs
    .map((d) => d.data())
    .filter((i) => typeof i["cardImageURL"] === "string" && i["cardImageURL"])
    .sort((a, b) => Number(a["searchID"] ?? 0) - Number(b["searchID"] ?? 0));
  if (cards.length === 0) {
    return NextResponse.json({ error: "No rendered cards in this pack" }, { status: 404 });
  }

  const safe = (v: string): string => v.replace(/[/\\:*?"<>|]/g, "-");
  const zipName = `${safe(String(pack["name"] ?? "Pack"))} Cards.zip`;
  const cardName = (i: Record<string, unknown>): string => {
    const prefix = String(i["searchPrefix"] ?? "").trim();
    const id = Number(i["searchID"] ?? 0);
    return prefix ? `${prefix}-${id}.png` : `card-${id}.png`;
  };

  try {
    const bucket = getAdminStorage();
    const zipPath = `cards/${packId}/_deck.zip`;
    const zipFile = bucket.file(zipPath);
    const writeStream = zipFile.createWriteStream({
      resumable: false,
      metadata: {
        contentType: "application/zip",
        contentDisposition: `attachment; filename="${zipName}"`,
      },
    });

    // Store-only: PNGs are already compressed.
    const archive = new ZipArchive({ zlib: { level: 0 } });
    const done = new Promise<void>((resolve, reject) => {
      writeStream.on("finish", () => resolve());
      writeStream.on("error", reject);
      archive.on("error", reject);
    });
    archive.pipe(writeStream);

    // Prefetch in small batches (memory ~batch × card size), append in order.
    const BATCH = 10;
    for (let i = 0; i < cards.length; i += BATCH) {
      const batch = cards.slice(i, i + BATCH);
      const buffers = await Promise.all(
        batch.map(async (card) => {
          const res = await fetch(String(card["cardImageURL"]));
          if (!res.ok) {
            console.error(
              `[download-cards] ${packId}: fetch failed for ${cardName(card)} (${res.status})`,
            );
            return null;
          }
          return Buffer.from(await res.arrayBuffer());
        }),
      );
      batch.forEach((card, j) => {
        const buf = buffers[j];
        if (buf) archive.append(buf, { name: cardName(card) });
      });
    }

    // Answer cards (one per 20-card block) ride along at the end.
    const prefix = String(pack["searchPrefix"] ?? "").trim();
    const answerCards = Array.isArray(pack["answerCards"]) ? pack["answerCards"] : [];
    for (const ac of answerCards as { start?: number; end?: number; imageURL?: string }[]) {
      if (typeof ac.imageURL !== "string" || !ac.imageURL) continue;
      const res = await fetch(ac.imageURL);
      if (!res.ok) {
        console.error(
          `[download-cards] ${packId}: fetch failed for answers ${ac.start}-${ac.end} (${res.status})`,
        );
        continue;
      }
      const label = prefix
        ? `Answers ${prefix}-${ac.start} to ${prefix}-${ac.end}.png`
        : `Answers ${ac.start} to ${ac.end}.png`;
      archive.append(Buffer.from(await res.arrayBuffer()), { name: label });
    }
    await archive.finalize();
    await done;

    const url =
      `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/` +
      `${encodeURIComponent(zipPath)}?alt=media&t=${Date.now()}`;
    return NextResponse.json({ url, cards: cards.length });
  } catch (err) {
    console.error(`[download-cards] ${packId}:`, err);
    return NextResponse.json({ error: "Failed to build zip" }, { status: 500 });
  }
}
