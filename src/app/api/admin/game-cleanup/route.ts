import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken, getAdminFirestore } from "@/lib/firebase-admin";
import { getStorage } from "firebase-admin/storage";
import { FieldValue } from "firebase-admin/firestore";

const LEGACY_RETENTION_MS = 24 * 60 * 60 * 1000; // 1 day for sessions without expiresAt
const CRON_SECRET = process.env["CRON_SECRET"];

/**
 * Shared cleanup logic used by both POST (manual admin) and GET (cron).
 * Returns a summary object and writes a cleanupLogs doc.
 */
async function runCleanup(trigger: "manual" | "scheduled") {
  const db = getAdminFirestore();
  const now = new Date();

  // 1) Sessions with an expiresAt field that has passed
  const expiredByField = await db
    .collection("gameSessions")
    .where("expiresAt", "<=", now)
    .get();

  // 2) Legacy sessions (no expiresAt) older than 24 h
  const legacyCutoff = new Date(Date.now() - LEGACY_RETENTION_MS);
  const allSessions = await db
    .collection("gameSessions")
    .where("createdAt", "<=", legacyCutoff)
    .get();
  const legacyExpired = allSessions.docs.filter(
    (d) => d.data()["expiresAt"] == null,
  );

  // Deduplicate by doc id
  const sessionMap = new Map<string, FirebaseFirestore.DocumentSnapshot>();
  for (const d of expiredByField.docs) sessionMap.set(d.id, d);
  for (const d of legacyExpired) sessionMap.set(d.id, d);

  if (sessionMap.size === 0) {
    await db.collection("cleanupLogs").add({
      trigger,
      sessionsDeleted: 0,
      inviteCodesDeleted: 0,
      gameInvitesDeleted: 0,
      sketchesDeleted: 0,
      errors: [],
      createdAt: FieldValue.serverTimestamp(),
    });
    return { deleted: 0, sketches: 0, message: "No expired sessions found." };
  }

  const projectId = process.env["FIREBASE_PROJECT_ID"]?.trim();
  const bucket = getStorage().bucket(`${projectId}.firebasestorage.app`);
  let sessionsDeleted = 0;
  let inviteCodesDeleted = 0;
  let gameInvitesDeleted = 0;
  let sketchesDeleted = 0;
  const errors: string[] = [];

  for (const [sessionId, snap] of sessionMap) {
    try {
      const data = snap.data() ?? {};

      // 1. Storage: delete game-sketches/{sessionId}/
      try {
        const [files] = await bucket.getFiles({
          prefix: `game-sketches/${sessionId}/`,
        });
        if (files.length > 0) {
          await bucket.deleteFiles({
            prefix: `game-sketches/${sessionId}/`,
          });
          sketchesDeleted += files.length;
        }
      } catch {
        // No files or bucket issue — non-fatal
      }

      // 2. gameInvites referencing this session
      const invites = await db
        .collection("gameInvites")
        .where("sessionId", "==", sessionId)
        .get();
      if (invites.size > 0) {
        const inviteBatch = db.batch();
        invites.docs.forEach((d) => inviteBatch.delete(d.ref));
        await inviteBatch.commit();
        gameInvitesDeleted += invites.size;
      }

      // 3. inviteCodes doc (normalized)
      const inviteCode = data["inviteCode"] as string | undefined;
      if (inviteCode) {
        const codeDocId = inviteCode.toLowerCase();
        await db.doc(`inviteCodes/${codeDocId}`).delete();
        inviteCodesDeleted++;
      }

      // 4. The session itself
      await db.doc(`gameSessions/${sessionId}`).delete();
      sessionsDeleted++;
    } catch (err) {
      errors.push(`${sessionId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Write cleanup log
  await db.collection("cleanupLogs").add({
    trigger,
    sessionsDeleted,
    inviteCodesDeleted,
    gameInvitesDeleted,
    sketchesDeleted,
    errors,
    createdAt: FieldValue.serverTimestamp(),
  });

  return {
    deleted: sessionsDeleted,
    inviteCodes: inviteCodesDeleted,
    gameInvites: gameInvitesDeleted,
    sketches: sketchesDeleted,
    total: sessionMap.size,
    ...(errors.length > 0 ? { errors } : {}),
  };
}

/**
 * POST /api/admin/game-cleanup
 * Manual trigger — requires admin Bearer token.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Missing authorization header" },
      { status: 401 },
    );
  }

  let decodedToken;
  try {
    decodedToken = await verifyIdToken(authHeader.substring(7));
  } catch {
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 401 },
    );
  }

  if (decodedToken["admin"] !== true) {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 },
    );
  }

  const result = await runCleanup("manual");
  return NextResponse.json(result);
}

/**
 * GET /api/admin/game-cleanup
 * Cron trigger — requires CRON_SECRET query param or header.
 * Call from Vercel Cron, Cloud Scheduler, or any external scheduler.
 */
export async function GET(request: NextRequest) {
  const secret =
    request.nextUrl.searchParams.get("secret") ??
    request.headers.get("x-cron-secret");

  if (!CRON_SECRET || secret !== CRON_SECRET) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  const result = await runCleanup("scheduled");
  return NextResponse.json(result);
}
