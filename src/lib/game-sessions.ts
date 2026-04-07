"use client";

/**
 * Multiplayer Game Sessions
 *
 * Firestore Collections:
 * - /gameSessions/{sessionId}  — lobby + game state
 * - /inviteCodes/{normalizedCode} — fast lookup by colored invite code
 */

import type { Timestamp } from "firebase/firestore";

// ─────────────────────────────────────────────────────────────
// INVITE CODE COLORS
// ─────────────────────────────────────────────────────────────

export const INVITE_COLORS = [
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "brown",
  "gray",
] as const;

export type InviteColor = (typeof INVITE_COLORS)[number];

export const INVITE_COLOR_HEX: Record<InviteColor, string> = {
  red: "#ef4444",
  orange: "#f97316",
  yellow: "#eab308",
  green: "#22c55e",
  blue: "#3b82f6",
  purple: "#a855f7",
  pink: "#ec4899",
  brown: "#92400e",
  gray: "#9ca3af",
};

export interface InviteCodeSegment {
  color: InviteColor;
  char: string;
}

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface GameSessionPlayer {
  uid: string;
  gamertag: string;
}

export interface RoundResult {
  round: number;
  moves: Record<string, string>;
  result: Record<string, unknown>;
}

export interface GameSession {
  id: string;
  ownerId: string;
  ownerGamertag: string;
  gameId: string;
  gameName: string;
  gameSlug: string;
  gameLogoURL: string;
  inviteCode: string;
  maxPlayers: number;
  players: GameSessionPlayer[];
  status: "lobby" | "playing" | "finished";
  createdAt: Timestamp;
  updatedAt: Timestamp;

  // Multiplayer round state (present once game starts)
  currentRound?: number;
  pendingMoves?: Record<string, string>;
  rounds?: RoundResult[];
  transcript?: string[];
  playerSides?: Record<string, string>;
  winner?: string | null;
}

export interface InviteCodeEntry {
  gameSessionId: string;
  ownerGamertag: string;
  gameName: string;
  gameSlug: string;
  gameLogoURL: string;
  createdAt: Timestamp;
}

// ─────────────────────────────────────────────────────────────
// INVITE CODE HELPERS
// ─────────────────────────────────────────────────────────────

const ALPHANUMERIC = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function randomChar(): string {
  return ALPHANUMERIC[Math.floor(Math.random() * ALPHANUMERIC.length)]!;
}

function randomColor(): InviteColor {
  return INVITE_COLORS[Math.floor(Math.random() * INVITE_COLORS.length)]!;
}

function buildCode(segments: InviteCodeSegment[]): string {
  return segments.map((s) => `${s.color}-${s.char.toUpperCase()}`).join("~");
}

/** Normalize a code string for Firestore doc ID (lowercase chars). */
export function normalizeCode(code: string): string {
  return code.toLowerCase();
}

/** Parse a code string like "red-Y~yellow-3~pink-X" into segments. */
export function parseInviteCode(code: string): InviteCodeSegment[] {
  return code.split("~").map((part) => {
    const dash = part.lastIndexOf("-");
    const color = part.slice(0, dash) as InviteColor;
    const char = part.slice(dash + 1).toUpperCase();
    return { color, char };
  });
}

// ─────────────────────────────────────────────────────────────
// FIRESTORE OPERATIONS
// ─────────────────────────────────────────────────────────────

async function getDb() {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore } = await import("firebase/firestore");
  const { app } = await initializeFirebase();
  return getFirestore(app);
}

/**
 * Generate a unique 3-segment invite code, retrying on collision.
 */
export async function generateUniqueInviteCode(): Promise<string> {
  const { doc, getDoc } = await import("firebase/firestore");
  const db = await getDb();

  for (let attempt = 0; attempt < 10; attempt++) {
    const segments: InviteCodeSegment[] = Array.from({ length: 3 }, () => ({
      color: randomColor(),
      char: randomChar(),
    }));
    const code = buildCode(segments);
    const normalized = normalizeCode(code);

    const snap = await getDoc(doc(db, "inviteCodes", normalized));
    if (!snap.exists()) return code;
  }
  throw new Error("Could not generate a unique invite code after 10 attempts");
}

export interface CreateSessionInput {
  gameId: string;
  gameName: string;
  gameSlug: string;
  gameLogoURL: string;
  maxPlayers: number;
}

/**
 * Create a game session + invite code atomically.
 */
export async function createGameSession(
  input: CreateSessionInput,
  userId: string,
  gamertag: string,
): Promise<GameSession> {
  const {
    doc,
    collection,
    writeBatch,
    serverTimestamp,
  } = await import("firebase/firestore");
  const db = await getDb();

  const inviteCode = await generateUniqueInviteCode();
  const sessionRef = doc(collection(db, "gameSessions"));

  const sessionData = {
    ownerId: userId,
    ownerGamertag: gamertag,
    gameId: input.gameId,
    gameName: input.gameName,
    gameSlug: input.gameSlug,
    gameLogoURL: input.gameLogoURL,
    inviteCode,
    maxPlayers: input.maxPlayers,
    players: [{ uid: userId, gamertag }],
    status: "lobby" as const,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const codeData = {
    gameSessionId: sessionRef.id,
    ownerGamertag: gamertag,
    gameName: input.gameName,
    gameSlug: input.gameSlug,
    gameLogoURL: input.gameLogoURL,
    createdAt: serverTimestamp(),
  };

  const batch = writeBatch(db);
  batch.set(sessionRef, sessionData);
  batch.set(doc(db, "inviteCodes", normalizeCode(inviteCode)), codeData);
  await batch.commit();

  return {
    id: sessionRef.id,
    ...sessionData,
    createdAt: sessionData.createdAt as unknown as Timestamp,
    updatedAt: sessionData.updatedAt as unknown as Timestamp,
  };
}

/**
 * Look up an invite code and return its entry (or null).
 */
export async function getInviteCodeEntry(
  code: string,
): Promise<(InviteCodeEntry & { id: string }) | null> {
  const { doc, getDoc } = await import("firebase/firestore");
  const db = await getDb();

  const snap = await getDoc(doc(db, "inviteCodes", normalizeCode(code)));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as InviteCodeEntry) };
}

/**
 * Get a game session by ID.
 */
export async function getGameSession(
  sessionId: string,
): Promise<GameSession | null> {
  const { doc, getDoc } = await import("firebase/firestore");
  const db = await getDb();

  const snap = await getDoc(doc(db, "gameSessions", sessionId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<GameSession, "id">) };
}

export type JoinResult =
  | { ok: true; session: GameSession }
  | { ok: false; reason: "not_found" | "full" | "already_joined" | "error" };

/**
 * Join a game session via invite code.
 */
export async function joinGameSession(
  code: string,
  userId: string,
  gamertag: string,
): Promise<JoinResult> {
  const { doc, getDoc, updateDoc, arrayUnion, serverTimestamp } =
    await import("firebase/firestore");
  const db = await getDb();

  try {
    const entry = await getInviteCodeEntry(code);
    if (!entry) return { ok: false, reason: "not_found" };

    const sessionSnap = await getDoc(
      doc(db, "gameSessions", entry.gameSessionId),
    );
    if (!sessionSnap.exists()) return { ok: false, reason: "not_found" };

    const session = {
      id: sessionSnap.id,
      ...(sessionSnap.data() as Omit<GameSession, "id">),
    };

    if (session.players.some((p) => p.uid === userId)) {
      return { ok: true, session };
    }

    if (session.players.length >= session.maxPlayers) {
      return { ok: false, reason: "full" };
    }

    await updateDoc(doc(db, "gameSessions", session.id), {
      players: arrayUnion({ uid: userId, gamertag }),
      updatedAt: serverTimestamp(),
    });

    session.players.push({ uid: userId, gamertag });
    return { ok: true, session };
  } catch {
    return { ok: false, reason: "error" };
  }
}

/**
 * Subscribe to real-time updates on a game session.
 * Returns an unsubscribe function.
 */
export async function subscribeToSession(
  sessionId: string,
  callback: (session: GameSession | null) => void,
): Promise<() => void> {
  const { doc, onSnapshot } = await import("firebase/firestore");
  const db = await getDb();

  return onSnapshot(doc(db, "gameSessions", sessionId), (snap) => {
    if (!snap.exists()) {
      callback(null);
      return;
    }
    callback({ id: snap.id, ...(snap.data() as Omit<GameSession, "id">) });
  });
}

// ─────────────────────────────────────────────────────────────
// MULTIPLAYER ROUND OPERATIONS
// ─────────────────────────────────────────────────────────────

/**
 * Transition a session from lobby to playing.
 * Assigns sides and initialises round state.
 */
export async function startGame(
  sessionId: string,
  playerSides: Record<string, string>,
): Promise<void> {
  const { doc, updateDoc, serverTimestamp } =
    await import("firebase/firestore");
  const db = await getDb();

  await updateDoc(doc(db, "gameSessions", sessionId), {
    status: "playing",
    currentRound: 0,
    pendingMoves: {},
    rounds: [],
    transcript: [],
    playerSides,
    winner: null,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Submit a move for the current round.
 * Uses dot-notation to write only this player's entry.
 */
export async function submitMove(
  sessionId: string,
  uid: string,
  move: string,
): Promise<void> {
  const { doc, updateDoc } = await import("firebase/firestore");
  const db = await getDb();

  await updateDoc(doc(db, "gameSessions", sessionId), {
    [`pendingMoves.${uid}`]: move,
  });
}

export interface WriteRoundInput {
  roundEntry: RoundResult;
  transcriptLines: string[];
  nextRound: number;
  gameOver: boolean;
  winner?: string | null;
  /** Arbitrary game-specific fields to merge (e.g. scores) */
  extras?: Record<string, unknown>;
}

/**
 * Atomically write the round result, advance the round counter,
 * clear pending moves, and optionally finish the game.
 * Only the host should call this.
 */
export async function writeRoundResult(
  sessionId: string,
  input: WriteRoundInput,
): Promise<void> {
  const { doc, updateDoc, arrayUnion, serverTimestamp } =
    await import("firebase/firestore");
  const db = await getDb();

  const updates: Record<string, unknown> = {
    rounds: arrayUnion(input.roundEntry),
    transcript: arrayUnion(...input.transcriptLines),
    currentRound: input.nextRound,
    pendingMoves: {},
    updatedAt: serverTimestamp(),
  };

  if (input.gameOver) {
    updates["status"] = "finished";
    updates["winner"] = input.winner ?? null;
  }

  if (input.extras) {
    Object.assign(updates, input.extras);
  }

  await updateDoc(doc(db, "gameSessions", sessionId), updates);
}
