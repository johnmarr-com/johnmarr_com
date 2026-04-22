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
  avatarName?: string;
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
  playerUids?: string[];
  pendingInviteUids?: string[];
  kickedUids?: string[];
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

  replayCount?: number;
  retentionDays?: number;
  expiresAt?: Timestamp;
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
  retentionDays?: number;
}

/**
 * Create a game session + invite code atomically.
 */
export async function createGameSession(
  input: CreateSessionInput,
  userId: string,
  gamertag: string,
  avatarName?: string,
): Promise<GameSession> {
  const {
    doc,
    collection,
    writeBatch,
    serverTimestamp,
    Timestamp: FBTimestamp,
  } = await import("firebase/firestore");
  const db = await getDb();

  const inviteCode = await generateUniqueInviteCode();
  const sessionRef = doc(collection(db, "gameSessions"));

  const retentionDays = input.retentionDays ?? 1;
  const expiresAt = FBTimestamp.fromDate(
    new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000),
  );

  const sessionData = {
    ownerId: userId,
    ownerGamertag: gamertag,
    gameId: input.gameId,
    gameName: input.gameName,
    gameSlug: input.gameSlug,
    gameLogoURL: input.gameLogoURL,
    inviteCode,
    maxPlayers: input.maxPlayers,
    players: [{ uid: userId, gamertag, ...(avatarName ? { avatarName } : {}) }],
    playerUids: [userId],
    status: "lobby" as const,
    retentionDays,
    expiresAt,
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
 * Uses a transaction to safely check capacity and add the player.
 * Cleans up any pending invite for this user.
 * Known-player tracking is handled by the host's client via GameMultiplayerFlow.
 */
export async function joinGameSession(
  code: string,
  userId: string,
  gamertag: string,
  avatarName?: string,
): Promise<JoinResult> {
  const { doc, runTransaction, serverTimestamp, collection, query, where, getDocs, deleteDoc } =
    await import("firebase/firestore");
  const db = await getDb();

  try {
    const entry = await getInviteCodeEntry(code);
    if (!entry) return { ok: false, reason: "not_found" };

    const result = await runTransaction(db, async (txn) => {
      const ref = doc(db, "gameSessions", entry.gameSessionId);
      const snap = await txn.get(ref);
      if (!snap.exists()) return { ok: false as const, reason: "not_found" as const };

      const data = snap.data();
      const players = (data["players"] ?? []) as GameSessionPlayer[];
      const playerUids = (data["playerUids"] ?? []) as string[];
      const pendingInviteUids = (data["pendingInviteUids"] ?? []) as string[];
      const maxPlayers = data["maxPlayers"] as number;

      if (players.some((p) => p.uid === userId)) {
        const session: GameSession = { id: snap.id, ...(data as Omit<GameSession, "id">) };
        return { ok: true as const, session, wasAlreadyJoined: true };
      }

      const playerEntry: GameSessionPlayer = { uid: userId, gamertag, ...(avatarName ? { avatarName } : {}) };
      let newPlayers: GameSessionPlayer[];
      let newPlayerUids: string[];

      if (players.length >= maxPlayers) {
        const aiPlayer = [...players].reverse().find((p) => p.uid.startsWith("ai-"));
        if (!aiPlayer) return { ok: false as const, reason: "full" as const };

        newPlayers = players.filter((p) => p.uid !== aiPlayer.uid);
        newPlayers.push(playerEntry);
        newPlayerUids = playerUids.filter((uid) => uid !== aiPlayer.uid);
        if (!newPlayerUids.includes(userId)) newPlayerUids.push(userId);
      } else {
        newPlayers = [...players, playerEntry];
        newPlayerUids = playerUids.includes(userId) ? playerUids : [...playerUids, userId];
      }

      txn.update(ref, {
        players: newPlayers,
        playerUids: newPlayerUids,
        pendingInviteUids: pendingInviteUids.filter((uid) => uid !== userId),
        updatedAt: serverTimestamp(),
      });

      const session: GameSession = {
        id: snap.id,
        ...(data as Omit<GameSession, "id">),
        players: newPlayers,
        playerUids: newPlayerUids,
      };
      return { ok: true as const, session, wasAlreadyJoined: false };
    });

    // Always clean up invite docs when the player acts on a game link,
    // regardless of join outcome.
    const invQ = query(
      collection(db, "gameInvites"),
      where("sessionId", "==", entry.gameSessionId),
      where("toUid", "==", userId),
    );
    getDocs(invQ).then((snap) => {
      snap.docs.forEach((d) => deleteDoc(d.ref));
    }).catch(() => {});

    if (!result.ok) return { ok: false, reason: result.reason };

    return { ok: true, session: result.session };
  } catch {
    return { ok: false, reason: "error" };
  }
}

/**
 * Join a game session directly by session ID (for invite-based joins).
 * Uses a transaction to safely check capacity and add the player.
 */
export async function joinGameSessionById(
  sessionId: string,
  userId: string,
  gamertag: string,
  avatarName?: string,
): Promise<JoinResult> {
  const { doc, runTransaction, serverTimestamp, collection, query, where, getDocs, deleteDoc } =
    await import("firebase/firestore");
  const db = await getDb();

  try {
    const result = await runTransaction(db, async (txn) => {
      const ref = doc(db, "gameSessions", sessionId);
      const snap = await txn.get(ref);
      if (!snap.exists()) return { ok: false as const, reason: "not_found" as const };

      const data = snap.data();
      const players = (data["players"] ?? []) as GameSessionPlayer[];
      const playerUids = (data["playerUids"] ?? []) as string[];
      const pendingInviteUids = (data["pendingInviteUids"] ?? []) as string[];
      const maxPlayers = data["maxPlayers"] as number;
      const status = data["status"] as string;

      // Allow returning players to rejoin in-progress games
      if (players.some((p) => p.uid === userId)) {
        const session: GameSession = { id: snap.id, ...(data as Omit<GameSession, "id">) };
        return { ok: true as const, session, wasAlreadyJoined: true };
      }

      if (status !== "lobby") return { ok: false as const, reason: "full" as const };

      const playerEntry: GameSessionPlayer = { uid: userId, gamertag, ...(avatarName ? { avatarName } : {}) };
      let newPlayers: GameSessionPlayer[];
      let newPlayerUids: string[];

      if (players.length >= maxPlayers) {
        const aiPlayer = [...players].reverse().find((p) => p.uid.startsWith("ai-"));
        if (!aiPlayer) return { ok: false as const, reason: "full" as const };

        newPlayers = players.filter((p) => p.uid !== aiPlayer.uid);
        newPlayers.push(playerEntry);
        newPlayerUids = playerUids.filter((uid) => uid !== aiPlayer.uid);
        if (!newPlayerUids.includes(userId)) newPlayerUids.push(userId);
      } else {
        newPlayers = [...players, playerEntry];
        newPlayerUids = playerUids.includes(userId) ? playerUids : [...playerUids, userId];
      }

      txn.update(ref, {
        players: newPlayers,
        playerUids: newPlayerUids,
        pendingInviteUids: pendingInviteUids.filter((uid) => uid !== userId),
        updatedAt: serverTimestamp(),
      });

      const session: GameSession = {
        id: snap.id,
        ...(data as Omit<GameSession, "id">),
        players: newPlayers,
        playerUids: newPlayerUids,
      };
      return { ok: true as const, session, wasAlreadyJoined: false };
    });

    // Always clean up invite docs when the player acts on a game link,
    // regardless of whether the join succeeded, failed, or was redundant.
    const invQ = query(
      collection(db, "gameInvites"),
      where("sessionId", "==", sessionId),
      where("toUid", "==", userId),
    );
    getDocs(invQ).then((snap) => {
      snap.docs.forEach((d) => deleteDoc(d.ref));
    }).catch(() => {});

    if (!result.ok) return { ok: false, reason: result.reason };

    return { ok: true, session: result.session };
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
 * Cleans up any remaining pending invites for this session.
 */
export async function startGame(
  sessionId: string,
  playerSides: Record<string, string>,
): Promise<void> {
  const { doc, updateDoc, serverTimestamp, collection, query, where, getDocs, deleteDoc } =
    await import("firebase/firestore");
  const db = await getDb();

  await updateDoc(doc(db, "gameSessions", sessionId), {
    status: "playing",
    currentRound: 0,
    pendingMoves: {},
    rounds: [],
    transcript: [],
    playerSides,
    pendingInviteUids: [],
    winner: null,
    updatedAt: serverTimestamp(),
  });

  // Clean up all remaining invite docs (fire-and-forget)
  const invQ = query(collection(db, "gameInvites"), where("sessionId", "==", sessionId));
  getDocs(invQ).then((snap) => {
    snap.docs.forEach((d) => deleteDoc(d.ref));
  }).catch(() => {});
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

/**
 * Remove a player from a session and mark them as kicked.
 * Uses a transaction to safely update the players array.
 */
export async function removePlayerFromSession(
  sessionId: string,
  uidToRemove: string,
): Promise<void> {
  const { doc, runTransaction, arrayUnion, arrayRemove, serverTimestamp } =
    await import("firebase/firestore");
  const db = await getDb();

  await runTransaction(db, async (txn) => {
    const ref = doc(db, "gameSessions", sessionId);
    const snap = await txn.get(ref);
    if (!snap.exists()) return;

    const data = snap.data();
    const players = (data["players"] ?? []) as GameSessionPlayer[];
    const newPlayers = players.filter((p) => p.uid !== uidToRemove);

    txn.update(ref, {
      players: newPlayers,
      playerUids: arrayRemove(uidToRemove),
      kickedUids: arrayUnion(uidToRemove),
      updatedAt: serverTimestamp(),
    });
  });
}

/**
 * Get all active (lobby or playing) game sessions for a given user.
 * Requires a composite index on playerUids (array-contains) + status.
 *
 * Filters out stale sessions: "playing" not updated in 2 h, "lobby" in 4 h.
 * Abandoned games naturally drop off without waiting for the daily cleanup.
 */
export async function getActiveSessionsForUser(
  userId: string,
): Promise<GameSession[]> {
  const { collection, query, where, getDocs } =
    await import("firebase/firestore");
  const db = await getDb();

  const lobbyQ = query(
    collection(db, "gameSessions"),
    where("playerUids", "array-contains", userId),
    where("status", "==", "lobby"),
  );
  const playingQ = query(
    collection(db, "gameSessions"),
    where("playerUids", "array-contains", userId),
    where("status", "==", "playing"),
  );

  const [lobbySnap, playingSnap] = await Promise.all([
    getDocs(lobbyQ),
    getDocs(playingQ),
  ]);

  const sessions: GameSession[] = [];
  for (const snap of [lobbySnap, playingSnap]) {
    snap.docs.forEach((d) => {
      sessions.push({ id: d.id, ...(d.data() as Omit<GameSession, "id">) });
    });
  }

  // Drop stale sessions — abandoned games that never got set to "finished"
  const now = Date.now();
  const STALE_PLAYING_MS = 2 * 60 * 60 * 1000; // 2 hours
  const STALE_LOBBY_MS = 4 * 60 * 60 * 1000;   // 4 hours
  const fresh = sessions.filter((s) => {
    const updatedMs = s.updatedAt?.toMillis?.() ?? 0;
    const age = now - updatedMs;
    return s.status === "playing" ? age < STALE_PLAYING_MS : age < STALE_LOBBY_MS;
  });

  // Most recently updated first
  fresh.sort((a, b) => {
    const aMs = a.updatedAt?.toMillis?.() ?? 0;
    const bMs = b.updatedAt?.toMillis?.() ?? 0;
    return bMs - aMs;
  });

  return fresh;
}

// ─────────────────────────────────────────────────────────────
// AI PLAYER MANAGEMENT
// ─────────────────────────────────────────────────────────────

/**
 * Add an AI player to a session's players list.
 * Uses a transaction to safely check capacity.
 */
export async function addAIPlayerToSession(
  sessionId: string,
  aiId: string,
  aiName: string,
  avatarName?: string,
): Promise<void> {
  const { doc, runTransaction, serverTimestamp } =
    await import("firebase/firestore");
  const db = await getDb();

  await runTransaction(db, async (txn) => {
    const ref = doc(db, "gameSessions", sessionId);
    const snap = await txn.get(ref);
    if (!snap.exists()) return;

    const data = snap.data();
    const players = (data["players"] ?? []) as GameSessionPlayer[];

    if (players.some((p) => p.uid === aiId)) return;
    if (players.length >= (data["maxPlayers"] as number)) return;

    const newPlayer: GameSessionPlayer = { uid: aiId, gamertag: aiName };
    if (avatarName) newPlayer.avatarName = avatarName;

    txn.update(ref, {
      players: [...players, newPlayer],
      playerUids: [...((data["playerUids"] ?? []) as string[]), aiId],
      updatedAt: serverTimestamp(),
    });
  });
}

/**
 * Remove an AI player from a session (no kicked list, just silent removal).
 */
export async function removeAIPlayerFromSession(
  sessionId: string,
  aiId: string,
): Promise<void> {
  const { doc, runTransaction, arrayRemove, serverTimestamp } =
    await import("firebase/firestore");
  const db = await getDb();

  await runTransaction(db, async (txn) => {
    const ref = doc(db, "gameSessions", sessionId);
    const snap = await txn.get(ref);
    if (!snap.exists()) return;

    const data = snap.data();
    const players = (data["players"] ?? []) as GameSessionPlayer[];
    const newPlayers = players.filter((p) => p.uid !== aiId);

    txn.update(ref, {
      players: newPlayers,
      playerUids: arrayRemove(aiId),
      updatedAt: serverTimestamp(),
    });
  });
}
