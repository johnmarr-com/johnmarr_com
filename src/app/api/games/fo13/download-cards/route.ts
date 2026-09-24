import { NextRequest, NextResponse } from "next/server";
import { ZipArchive } from "archiver";
import { getAdminFirestore, getAdminStorage } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Build a zip of every rendered card in a Field Office 13 pack, return its URL.
 * GET /api/games/fo13/download-cards?packId=…  →  { url, cards }
 *
 * The zip is assembled INTO Cloud Storage (cards/{packId}/_deck.zip) rather
 * than streamed through this route: Cloud Run truncates streamed responses
 * around 32MiB, which ships corrupt zips. Public by design — the card PNGs
 * (and thus the zip) live under world-readable cards/.
 */

const TYPE_ORDER = ["Rank", "Subject", "Research", "Footnote"];

export async function GET(request: NextRequest) {
  const packId = request.nextUrl.searchParams.get("packId");
  if (!packId) {
    return NextResponse.json({ error: "Missing packId" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const packSnap = await db.doc(`fo13Packs/${packId}`).get();
  const pack = packSnap.data();
  if (!packSnap.exists || !pack) {
    return NextResponse.json({ error: "Pack not found" }, { status: 404 });
  }

  const cardsSnap = await db.collection("fo13").where("packId", "==", packId).get();
  const cards = cardsSnap.docs
    .map((d) => d.data())
    .filter((c) => typeof c["cardImageURL"] === "string" && c["cardImageURL"])
    .sort((a, b) => {
      const byType =
        TYPE_ORDER.indexOf(String(a["cardType"])) - TYPE_ORDER.indexOf(String(b["cardType"]));
      return byType !== 0 ? byType : Number(a["order"] ?? 0) - Number(b["order"] ?? 0);
    });
  if (cards.length === 0) {
    return NextResponse.json({ error: "No rendered cards in this pack" }, { status: 404 });
  }

  const safe = (v: string): string => v.replace(/[/\\:*?"<>|]/g, "-");
  const zipName = `${safe(String(pack["name"] ?? "Pack"))} Cards.zip`;

  // Name each file by type + position, so a printer sees the deck in order.
  const seen = new Map<string, number>();
  const cardName = (c: Record<string, unknown>): string => {
    const type = String(c["cardType"] ?? "Card");
    const n = (seen.get(type) ?? 0) + 1;
    seen.set(type, n);
    return `${safe(type)}-${String(n).padStart(2, "0")}.png`;
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
            console.error(`[fo13/download-cards] ${packId}: fetch failed (${res.status})`);
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

    await archive.finalize();
    await done;

    const url =
      `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/` +
      `${encodeURIComponent(zipPath)}?alt=media&t=${Date.now()}`;
    return NextResponse.json({ url, cards: cards.length });
  } catch (err) {
    console.error(`[fo13/download-cards] ${packId}:`, err);
    return NextResponse.json({ error: "Failed to build zip" }, { status: 500 });
  }
}
