import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/firebase-admin";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import {
  HEIST_ELEMENT_LABELS,
  type CardType,
  type SevynKeyDoc,
  type SevynBossView,
  type SevynRevealResult,
} from "@/app/games/sevyn/sevynTypes";

// ─── Per-UID rate limiting ──────────────────────────────────
const RATE_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 60;

const requestLog = new Map<string, number[]>();

function isRateLimited(uid: string): boolean {
  const now = Date.now();
  const timestamps = requestLog.get(uid) ?? [];
  const recent = timestamps.filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= MAX_REQUESTS_PER_WINDOW) return true;
  recent.push(now);
  requestLog.set(uid, recent);
  return false;
}

setInterval(() => {
  const now = Date.now();
  for (const [uid, timestamps] of requestLog) {
    const recent = timestamps.filter((t) => now - t < RATE_WINDOW_MS);
    if (recent.length === 0) requestLog.delete(uid);
    else requestLog.set(uid, recent);
  }
}, RATE_WINDOW_MS);

// ─── Helpers ────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

// ─── Route ──────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // ─── Authenticate ─────────────────────────────────────────
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Missing or invalid authorization header" },
      { status: 401 },
    );
  }

  let uid: string;
  try {
    const decoded = await verifyIdToken(authHeader.substring(7));
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: "Invalid auth token" }, { status: 401 });
  }

  if (isRateLimited(uid)) {
    return NextResponse.json(
      { error: "Too many requests — try again shortly" },
      { status: 429 },
    );
  }

  try {
    const body = await request.json();
    const { action } = body as { action: string };

    // ─── GENERATE KEY ─────────────────────────────────────
    // Called by host when game starts. Creates the secret key
    // and stores it in sevynKeys (admin-only collection).
    if (action === "generate-key") {
      return handleGenerateKey(body, uid);
    }

    // ─── GET BOSS VIEW ─────────────────────────────────────
    // Returns the color-coded map for a boss.
    if (action === "get-boss-view") {
      return handleGetBossView(body, uid);
    }

    // ─── REVEAL CARD ──────────────────────────────────────
    // Called by host when operative's tap is confirmed.
    // Checks the key and returns what the card is.
    if (action === "reveal-card") {
      return handleRevealCard(body, uid);
    }

    // ─── VALIDATE CLUE ────────────────────────────────────
    // Server-side clue validation to prevent board-word clues.
    if (action === "validate-clue") {
      return handleValidateClue(body);
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error(`[SEVYN] Error for uid=${uid}:`, err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// ─── GENERATE KEY ───────────────────────────────────────────

interface GenerateKeyBody {
  action: "generate-key";
  sessionId: string;
  heistId: string;
}

async function handleGenerateKey(
  body: unknown,
  uid: string,
): Promise<NextResponse> {
  const { sessionId, heistId } = body as GenerateKeyBody;
  if (!sessionId || !heistId) {
    return NextResponse.json({ error: "Missing sessionId or heistId" }, { status: 400 });
  }

  const db = getAdminFirestore();

  // Verify the caller is the session host
  const sessionSnap = await db.doc(`gameSessions/${sessionId}`).get();
  if (!sessionSnap.exists) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  const sessionData = sessionSnap.data()!;
  if (sessionData["ownerId"] !== uid) {
    return NextResponse.json({ error: "Only the host can generate the key" }, { status: 403 });
  }

  // Load the heist
  const heistSnap = await db.doc(`sevynHeists/${heistId}`).get();
  if (!heistSnap.exists) {
    return NextResponse.json({ error: "Heist not found" }, { status: 404 });
  }
  const heist = heistSnap.data()!;
  const words = heist["words"] as { tier1: string[]; tier2: string[]; tier3: string[] };
  const civilians = heist["civilians"] as { name: string; description: string; imageUrl: string }[];

  // Build the 20-card board — ALL words come from the pool (no character names)
  const fullPool = [...words.tier1, ...words.tier2, ...words.tier3];
  console.log(`[SEVYN DEBUG] Full word pool (${fullPool.length} words):`, fullPool);
  const boardWords = shuffle(fullPool).slice(0, 20);
  console.log(`[SEVYN DEBUG] Selected 20 board words:`, boardWords);

  // Generate the key template and shuffle it
  const keyTemplate: CardType[] = [
    "T1", "T1", "T1", "T1", "T1", "T1", "T1", // 7 syndicate one
    "T2", "T2", "T2", "T2", "T2", "T2", "T2", // 7 syndicate two
    "N", "N", "N", "N", "N",                   // 5 neutral civilians
    "BOMB",                                      // 1 bomb
  ];
  const key = shuffle(keyTemplate);

  // Assets are NOT pre-assigned to card positions — they reveal in story order.
  // Only civilians need specific board-position assignments.

  // Civilian assignments: assign each neutral position to a civilian index
  const civilianAssignments: Record<number, number> = {};
  const neutralPositions = key.map((k, i) => (k === "N" ? i : -1)).filter((i) => i >= 0);
  const shuffledCivIndices = shuffle([0, 1, 2, 3, 4]);
  neutralPositions.forEach((boardIdx, i) => {
    civilianAssignments[boardIdx] = shuffledCivIndices[i]!;
  });

  // Bomb position
  const bombIndex = key.indexOf("BOMB");

  // Store the key document (admin-only)
  const keyRef = db.collection("sevynKeys").doc();
  const keyDoc: Omit<SevynKeyDoc, "createdAt"> & { createdAt: FieldValue } = {
    sessionId,
    key,
    t1RevealCount: 0,
    t2RevealCount: 0,
    civilianAssignments,
    bombIndex,
    createdAt: FieldValue.serverTimestamp(),
  };
  await keyRef.set(keyDoc);

  // Build the public board (no color info)
  const board = boardWords.map((word, i) => ({
    index: i,
    word,
    revealed: false,
  }));

  // ─── DEBUG: log full board layout ───────────────────────
  console.log("[SEVYN DEBUG] ═══ BOARD LAYOUT ═══");
  board.forEach((card, i) => {
    const type = key[i]!;
    let detail = "";
    if (type === "T1" || type === "T2") {
      detail = "(asset revealed in story order at game time)";
    } else if (type === "N") {
      const cIdx = civilianAssignments[i];
      const civ = cIdx != null ? civilians[cIdx] : undefined;
      detail = `civilian="${civ?.name ?? "?"}"`;
    } else {
      detail = "BOMB";
    }
    const typeLabel = type === "T1" ? "Syndicate 1" : type === "T2" ? "Syndicate 2" : type === "N" ? "Civilian" : "BOMB";
    console.log(`[SEVYN DEBUG] Card ${i + 1}: word="${card.word}" | type=${typeLabel} | ${detail}`);
  });
  console.log("[SEVYN DEBUG] ═══════════════════");

  return NextResponse.json({
    keyDocId: keyRef.id,
    board,
  });
}

// ─── GET BOSS VIEW ──────────────────────────────────────────

interface GetBossViewBody {
  action: "get-boss-view";
  sessionId: string;
  keyDocId: string;
}

async function handleGetBossView(
  body: unknown,
  uid: string,
): Promise<NextResponse> {
  const { sessionId, keyDocId } = body as GetBossViewBody;
  if (!sessionId || !keyDocId) {
    return NextResponse.json({ error: "Missing sessionId or keyDocId" }, { status: 400 });
  }

  const db = getAdminFirestore();

  // Verify the session exists and the caller is in it
  const sessionSnap = await db.doc(`gameSessions/${sessionId}`).get();
  if (!sessionSnap.exists) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  const sessionData = sessionSnap.data()!;
  const playerUids = (sessionData["playerUids"] ?? []) as string[];
  if (!playerUids.includes(uid)) {
    return NextResponse.json({ error: "Not a player in this session" }, { status: 403 });
  }

  // Verify the caller is a boss for one of the teams
  const teams = sessionData["teams"] as Record<string, { members: string[]; bossUid: string | null }> | undefined;
  if (!teams) {
    return NextResponse.json({ error: "Teams not yet formed" }, { status: 400 });
  }

  const isBoss =
    teams["syndicate1"]?.bossUid === uid ||
    teams["syndicate2"]?.bossUid === uid;

  if (!isBoss) {
    return NextResponse.json({ error: "Only bosses can view the key" }, { status: 403 });
  }

  // Load the key
  const keySnap = await db.doc(`sevynKeys/${keyDocId}`).get();
  if (!keySnap.exists) {
    return NextResponse.json({ error: "Key not found" }, { status: 404 });
  }
  const keyData = keySnap.data() as SevynKeyDoc;
  if (keyData.sessionId !== sessionId) {
    return NextResponse.json({ error: "Key/session mismatch" }, { status: 403 });
  }

  const view: SevynBossView = {
    colorMap: keyData.key,
  };

  return NextResponse.json(view);
}

// ─── REVEAL CARD ────────────────────────────────────────────

interface RevealCardBody {
  action: "reveal-card";
  sessionId: string;
  keyDocId: string;
  cardIndex: number;
  heistId: string;
}

async function handleRevealCard(
  body: unknown,
  uid: string,
): Promise<NextResponse> {
  const { sessionId, keyDocId, cardIndex, heistId } = body as RevealCardBody;
  if (!sessionId || !keyDocId || cardIndex == null || !heistId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (cardIndex < 0 || cardIndex > 19) {
    return NextResponse.json({ error: "Invalid card index" }, { status: 400 });
  }

  const db = getAdminFirestore();

  // Verify the caller is the host
  const sessionSnap = await db.doc(`gameSessions/${sessionId}`).get();
  if (!sessionSnap.exists) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (sessionSnap.data()!["ownerId"] !== uid) {
    return NextResponse.json({ error: "Only the host can reveal cards" }, { status: 403 });
  }

  // Load the key
  const keySnap = await db.doc(`sevynKeys/${keyDocId}`).get();
  if (!keySnap.exists) {
    return NextResponse.json({ error: "Key not found" }, { status: 404 });
  }
  const keyData = keySnap.data() as SevynKeyDoc;
  if (keyData.sessionId !== sessionId) {
    return NextResponse.json({ error: "Key/session mismatch" }, { status: 403 });
  }

  const cardType = keyData.key[cardIndex]!;

  // Load the heist for asset/civilian/bomb metadata
  const heistSnap = await db.doc(`sevynHeists/${heistId}`).get();
  if (!heistSnap.exists) {
    return NextResponse.json({ error: "Heist not found" }, { status: 404 });
  }
  const heist = heistSnap.data()!;
  const assets = heist["assets"] as {
    name: string; description: string; imageUrl: string;
    bombDescription?: string; bombImageUrl?: string; bombSoundEffect?: string;
  }[];
  const civilians = heist["civilians"] as { name: string; description: string; imageUrl: string }[];

  let result: SevynRevealResult;

  if (cardType === "T1" || cardType === "T2") {
    // Assets reveal in story order: the Nth reveal for this team shows asset #N
    const countField = cardType === "T1" ? "t1RevealCount" : "t2RevealCount";
    const currentCount = (keyData[countField] as number) ?? 0;
    const asset = assets[currentCount];

    // Increment the counter in the key doc
    const keyRef = db.doc(`sevynKeys/${keyDocId}`);
    await keyRef.update({ [countField]: currentCount + 1 });

    result = {
      cardIndex,
      cardType,
      name: asset?.name ?? "ASSET",
      description: asset?.description ?? "",
      imageUrl: asset?.imageUrl ?? "",
    };
  } else if (cardType === "N") {
    const civIdx = keyData.civilianAssignments[cardIndex];
    const civ = civIdx != null ? civilians[civIdx] : undefined;
    result = {
      cardIndex,
      cardType,
      name: civ?.name ?? "CIVILIAN",
      description: civ?.description ?? "",
      imageUrl: civ?.imageUrl ?? "",
    };
  } else {
    // BOMB — use per-element bomb based on which element the active team is on
    const sessionData = sessionSnap.data()!;
    const activeTeam = sessionData["activeTeam"] as string;
    const countField = activeTeam === "syndicate1" ? "t1RevealCount" : "t2RevealCount";
    const elementIndex = (keyData[countField] as number) ?? 0;
    const elementAsset = assets[elementIndex];

    result = {
      cardIndex,
      cardType,
      name: HEIST_ELEMENT_LABELS[elementIndex] ?? "THE BOMB",
      description: elementAsset?.bombDescription || "",
      imageUrl: elementAsset?.bombImageUrl || "",
      bombSoundEffect: elementAsset?.bombSoundEffect || "",
    };
  }

  return NextResponse.json(result);
}

// ─── VALIDATE CLUE ──────────────────────────────────────────

interface ValidateClueBody {
  action: "validate-clue";
  clueWord: string;
  boardWords: string[];
}

async function handleValidateClue(
  body: unknown,
): Promise<NextResponse> {
  const { clueWord, boardWords } = body as ValidateClueBody;

  if (!clueWord || !boardWords) {
    return NextResponse.json({ error: "Missing clueWord or boardWords" }, { status: 400 });
  }

  const word = clueWord.trim().toUpperCase();

  // Must be a single word (no spaces)
  if (word.length === 0 || word.includes(" ")) {
    return NextResponse.json({ valid: false, reason: "Clue must be a single word" });
  }

  // Must not match any board word
  const boardUpper = boardWords.map((w) => w.toUpperCase());
  if (boardUpper.includes(word)) {
    return NextResponse.json({ valid: false, reason: "Clue cannot be a word on the board" });
  }

  // Basic stemming check — clue should not be a prefix/suffix derivative
  for (const bw of boardUpper) {
    if (bw.length >= 4 && (word.startsWith(bw) || bw.startsWith(word))) {
      return NextResponse.json({
        valid: false,
        reason: `Clue appears to be a derivative of "${bw}"`,
      });
    }
  }

  return NextResponse.json({ valid: true });
}
