import { NextRequest, NextResponse } from "next/server";
import { PassThrough, Readable } from "node:stream";
import { ZipArchive } from "archiver";
import { getAdminFirestore } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

/**
 * Download an album's songs as a zip (albums flagged `downloadable` only).
 * GET /api/music/download-album?albumId=…
 *
 * Streams the archive: songs are fetched from Storage one at a time and
 * appended uncompressed (MP3s don't compress), so memory stays ~one track.
 * A LICENSE.txt travels inside the zip so the usage grant follows the files.
 * Public today by design ("free for personal and commercial use"); if this
 * ever moves behind sign-in or Pro, add the token/tier check here.
 */
export async function GET(request: NextRequest) {
  const albumId = request.nextUrl.searchParams.get("albumId");
  if (!albumId) {
    return NextResponse.json({ error: "Missing albumId" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const albumSnap = await db.doc(`albums/${albumId}`).get();
  const album = albumSnap.data();
  if (!albumSnap.exists || !album || album["isPublished"] !== true) {
    return NextResponse.json({ error: "Album not found" }, { status: 404 });
  }
  if (album["downloadable"] !== true) {
    return NextResponse.json({ error: "Album is not downloadable" }, { status: 403 });
  }

  const artistSnap = await db.doc(`artists/${String(album["artistId"])}`).get();
  const artistName = String(artistSnap.data()?.["name"] ?? "Unknown Artist");
  const albumName = String(album["name"] ?? "Album");

  const songsSnap = await db
    .collection("songs")
    .where("isPublished", "==", true)
    .where("albumId", "==", albumId)
    .orderBy("trackNumber", "asc")
    .get();
  const songs = songsSnap.docs
    .map((doc) => doc.data())
    .filter((s) => s["tease"] !== true && typeof s["audioURL"] === "string");
  if (songs.length === 0) {
    return NextResponse.json({ error: "No downloadable songs" }, { status: 404 });
  }

  /** "01 - Title.mp3" (extension from the storage path when present). */
  const fileName = (s: Record<string, unknown>): string => {
    const n = String(s["trackNumber"] ?? 0).padStart(2, "0");
    const title = String(s["title"] ?? "Track").replace(/[/\\:*?"<>|]/g, "-");
    let ext = ".mp3";
    try {
      const path = decodeURIComponent(new URL(String(s["audioURL"])).pathname);
      const match = /\.([a-z0-9]{2,5})$/i.exec(path);
      if (match) ext = `.${match[1]!.toLowerCase()}`;
    } catch {
      /* keep default */
    }
    return `${n} - ${title}${ext}`;
  };

  const safe = (v: string): string => v.replace(/[/\\:*?"<>|]/g, "-");
  const zipName = `${safe(artistName)} - ${safe(albumName)}.zip`;

  // store-only zip (level 0): audio is already compressed.
  const archive = new ZipArchive({ zlib: { level: 0 } });
  const out = new PassThrough();
  archive.pipe(out);
  archive.on("error", (err: Error) => out.destroy(err));

  archive.append(
    [
      `${artistName} — ${albumName}`,
      "",
      "This music is free for personal and commercial use.",
      "Reselling or redistributing the files themselves is not permitted.",
      "",
      `From johnmarr.com/artist — enjoy!`,
    ].join("\n"),
    { name: "LICENSE.txt" },
  );

  // Append tracks sequentially in the background while the response streams.
  void (async () => {
    try {
      for (const s of songs) {
        const res = await fetch(String(s["audioURL"]));
        if (!res.ok) {
          console.error(`[download-album] ${albumId}: fetch failed for "${s["title"]}" (${res.status})`);
          continue;
        }
        archive.append(Buffer.from(await res.arrayBuffer()), { name: fileName(s) });
      }
      await archive.finalize();
    } catch (err) {
      console.error(`[download-album] ${albumId}:`, err);
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
