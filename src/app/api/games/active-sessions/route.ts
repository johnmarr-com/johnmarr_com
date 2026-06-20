import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken, getAdminFirestore } from "@/lib/firebase-admin";

/**
 * The signed-in user's active game sessions (lobby + playing), over plain HTTPS.
 *
 * Read via the Admin SDK on a stateless request — NOT the Firestore realtime
 * stream, which iOS Safari wedges (the old client getDocs here hung for 30s+).
 * Returns a lightweight, JSON-safe shape (updatedAt as epoch ms) for the
 * "My Games" modal.
 */
const STALE_PLAYING_MS = 2 * 60 * 60 * 1000; // 2h
const STALE_LOBBY_MS = 4 * 60 * 60 * 1000; // 4h

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing authorization header" }, { status: 401 });
  }
  let uid: string;
  try {
    uid = (await verifyIdToken(authHeader.substring(7))).uid;
  } catch {
    return NextResponse.json({ error: "Invalid auth token" }, { status: 401 });
  }

  const db = getAdminFirestore();
  const base = db.collection("gameSessions").where("playerUids", "array-contains", uid);
  const [lobbySnap, playingSnap] = await Promise.all([
    base.where("status", "==", "lobby").get(),
    base.where("status", "==", "playing").get(),
  ]);

  const now = Date.now();
  type Row = {
    id: string;
    gameSlug: string;
    engineSlug: string | null;
    gameLogoURL: string | null;
    gameName: string;
    ownerId: string;
    playerCount: number;
    status: string;
    updatedAtMs: number;
  };
  const rows: Row[] = [];
  for (const snap of [lobbySnap, playingSnap]) {
    snap.docs.forEach((d) => {
      const data = d.data();
      const updatedAtMs =
        (data["updatedAt"] as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0;
      const status = (data["status"] as string) ?? "lobby";
      const age = now - updatedAtMs;
      const fresh = status === "playing" ? age < STALE_PLAYING_MS : age < STALE_LOBBY_MS;
      if (!fresh) return;
      rows.push({
        id: d.id,
        gameSlug: (data["gameSlug"] as string) ?? "",
        engineSlug: (data["engineSlug"] as string | undefined) ?? null,
        gameLogoURL: (data["gameLogoURL"] as string | undefined) ?? null,
        gameName: (data["gameName"] as string) ?? "Game",
        ownerId: (data["ownerId"] as string) ?? "",
        playerCount: Array.isArray(data["players"]) ? (data["players"] as unknown[]).length : 0,
        status,
        updatedAtMs,
      });
    });
  }
  rows.sort((a, b) => b.updatedAtMs - a.updatedAtMs);

  return NextResponse.json({ sessions: rows }, { headers: { "Cache-Control": "no-store" } });
}
