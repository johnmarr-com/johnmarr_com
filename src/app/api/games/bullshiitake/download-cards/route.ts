import { NextRequest, NextResponse } from "next/server";
import { PassThrough, Readable } from "node:stream";
import { ZipArchive } from "archiver";
import { getAdminFirestore } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

/**
 * Download every rendered print card in a pack as one zip.
 * GET /api/games/bullshiitake/download-cards?packId=…
 *
 * Streams the archive (same shape as /api/music/download-album): each PNG is
 * fetched from Storage and appended store-only, so memory stays ~one card.
 * Public by design — the card PNGs live under `cards/{packId}/` which is
 * world-readable in storage.rules; this route adds no new exposure.
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

  // Store-only: PNGs are already compressed.
  const archive = new ZipArchive({ zlib: { level: 0 } });
  const out = new PassThrough();
  archive.pipe(out);
  archive.on("error", (err: Error) => out.destroy(err));

  void (async () => {
    try {
      for (const card of cards) {
        const res = await fetch(String(card["cardImageURL"]));
        if (!res.ok) {
          console.error(`[download-cards] ${packId}: fetch failed for ${cardName(card)} (${res.status})`);
          continue;
        }
        archive.append(Buffer.from(await res.arrayBuffer()), { name: cardName(card) });
      }
      await archive.finalize();
    } catch (err) {
      console.error(`[download-cards] ${packId}:`, err);
      out.destroy(err instanceof Error ? err : new Error(String(err)));
    }
  })();

  return new NextResponse(Readable.toWeb(out) as ReadableStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zipName}"`,
      "Cache-Control": "no-store",
    },
  });
}
