import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken, getAdminFirestore } from "@/lib/firebase-admin";
import {
  GRID_SIZE,
  isValidPlacement,
  buildOccupiedSet,
  posKey,
} from "@/app/games/boaty/boatyLogic";
import type { PlayerBoard, RaftDef, Position } from "@/app/games/boaty/boatyTypes";

// ─── Per-UID rate limiting ──────────────────────────────────
const RATE_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 120;
const requestLog = new Map<string, number[]>();

function isRateLimited(uid: string): boolean {
  const now = Date.now();
  const recent = (requestLog.get(uid) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= MAX_REQUESTS_PER_WINDOW) return true;
  recent.push(now);
  requestLog.set(uid, recent);
  return false;
}
setInterval(() => {
  const now = Date.now();
  for (const [uid, ts] of requestLog) {
    const recent = ts.filter((t) => now - t < RATE_WINDOW_MS);
    if (recent.length === 0) requestLog.delete(uid);
    else requestLog.set(uid, recent);
  }
}, RATE_WINDOW_MS);

// ─── Validation ─────────────────────────────────────────────
const REQUIRED_RAFTS = new Set(["square", "lshape", "shorty"]);

/** Server-side board validation: exactly the 3 raft types, all in bounds, no
 *  overlaps, gator on a free in-bounds cell. Prevents board tampering. */
function validateBoard(board: unknown): board is PlayerBoard {
  if (!board || typeof board !== "object") return false;
  const b = board as Partial<PlayerBoard>;
  if (!Array.isArray(b.rafts) || b.rafts.length !== 3) return false;
  const types = new Set(b.rafts.map((r) => r?.type));
  if (types.size !== 3 || ![...REQUIRED_RAFTS].every((t) => types.has(t as RaftDef["type"]))) {
    return false;
  }
  const placed: RaftDef[] = [];
  for (const raft of b.rafts) {
    if (!raft || typeof raft !== "object") return false;
    const occupied = buildOccupiedSet(placed);
    if (!isValidPlacement(raft, occupied)) return false;
    placed.push(raft);
  }
  const g = b.gator as Position | undefined;
  if (!g || typeof g.row !== "number" || typeof g.col !== "number") return false;
  if (g.row < 0 || g.row >= GRID_SIZE || g.col < 0 || g.col >= GRID_SIZE) return false;
  const occupied = buildOccupiedSet(placed);
  if (occupied.has(posKey(g))) return false;
  return true;
}

export async function POST(request: NextRequest) {
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
  if (isRateLimited(uid)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const action = body?.action as string | undefined;
  const sessionId = body?.sessionId as string | undefined;
  if (!action || !sessionId) {
    return NextResponse.json({ error: "Missing action or sessionId" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const sessionRef = db.doc(`gameSessions/${sessionId}`);
  const snap = await sessionRef.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  const session = snap.data() as {
    playerUids?: string[];
    status?: string;
    engineKey?: string;
    btCurrentTurn?: string | null;
  };

  if (session.engineKey !== "boaty") {
    return NextResponse.json({ error: "Not a Boaty engine session" }, { status: 400 });
  }
  if (!(session.playerUids ?? []).includes(uid)) {
    return NextResponse.json({ error: "Not a participant" }, { status: 403 });
  }

  // ─── submit-board: write the SECRET board, then flip btReady ───
  if (action === "submit-board") {
    const board = body?.board;
    if (!validateBoard(board)) {
      return NextResponse.json({ error: "Invalid board" }, { status: 400 });
    }
    // Board first (secret per-player doc), so it exists before btReady fires
    // the engine. Owner-readable for reconnect; opponent can never read it.
    await db.doc(`boatyBoards/${sessionId}/boards/${uid}`).set(board);
    await sessionRef.update({ [`btReady.${uid}`]: true });
    return NextResponse.json({ ok: true });
  }

  // ─── submit-attack: deposit the event into the inbox ───
  if (action === "submit-attack") {
    if (session.status !== "playing") {
      return NextResponse.json({ error: "Game not in play" }, { status: 409 });
    }
    if (session.btCurrentTurn !== uid) {
      return NextResponse.json({ error: "Not your turn" }, { status: 409 });
    }
    const targetUid = body?.targetUid as string | undefined;
    const row = body?.row;
    const col = body?.col;
    if (
      typeof targetUid !== "string" ||
      typeof row !== "number" ||
      typeof col !== "number" ||
      row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE
    ) {
      return NextResponse.json({ error: "Invalid attack" }, { status: 400 });
    }
    await sessionRef.update({
      [`inbox.attacks.${uid}`]: {
        eventId: `${uid}-${Date.now()}`,
        targetUid,
        row,
        col,
      },
    });
    return NextResponse.json({ ok: true });
  }

  // ─── set-ai-comment: persist a post-game AI comment (server-write) ───
  if (action === "set-ai-comment") {
    const aiUid = body?.aiUid as string | undefined;
    const comment = body?.comment as string | undefined;
    if (typeof aiUid !== "string" || typeof comment !== "string" || !comment.trim()) {
      return NextResponse.json({ error: "Invalid comment" }, { status: 400 });
    }
    if (!(session.playerUids ?? []).includes(aiUid)) {
      return NextResponse.json({ error: "Target not in session" }, { status: 400 });
    }
    await sessionRef.update({ [`aiPostGameComments.${aiUid}`]: comment.slice(0, 500) });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
