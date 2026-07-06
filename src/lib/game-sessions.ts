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
  /** When set, rejoin URL is `/games/{engineSlug}?game={gameSlug}&sessionId=…` */
  engineSlug?: string;
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
  /** When set, rounds are resolved server-side by a Cloud Function keyed by this value. */
  resolverKey?: string;
  /** Monotonic sync counter; incremented by the server on each round resolution. */
  seq?: number;
  /** When set, the session is driven by the generic server-authority engine
   *  (`gameEngine` Cloud Function) under this key. */
  engineKey?: string;
  /** Namespaced client→server event inbox: channel → uid → event. */
  inbox?: Record<string, Record<string, Record<string, unknown>>>;

  replayCount?: number;
  retentionDays?: number;
  expiresAt?: Timestamp;
}

export interface InviteCodeEntry {
  gameSessionId: string;
  ownerGamertag: string;
  gameName: string;
  gameSlug: string;
  engineSlug?: string;
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
  engineSlug?: string;
  /** Opt in to server-authoritative round resolution; selects the server resolver. */
  resolverKey?: string;
  /** Opt in to the generic server-authority engine; selects the game reducer. */
  engineKey?: string;
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
    ...(input.engineSlug != null && input.engineSlug !== ""
      ? { engineSlug: input.engineSlug }
      : {}),
    ...(input.resolverKey ? { resolverKey: input.resolverKey } : {}),
    ...(input.engineKey ? { engineKey: input.engineKey } : {}),
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
    ...(input.engineSlug != null && input.engineSlug !== ""
      ? { engineSlug: input.engineSlug }
      : {}),
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
/**
 * Subscribe to a session with self-healing state reconciliation.
 *
 * Multiplayer netcode best-practice, three layers:
 *  1. PUSH (primary): Firestore `onSnapshot` is the websocket fast-path —
 *     sub-second when the link is healthy.
 *  2. MONOTONIC APPLY-GATE: the engine stamps a monotonic `seq` on every
 *     authoritative advance. We track the highest `seq` shown and DROP any
 *     snapshot older than it — this rejects the stale/out-of-order payload
 *     Firestore's offline cache can serve after a socket flap (which would
 *     otherwise clobber newer state). A `seq` of 0 is treated as a reset
 *     (Play-Again / startGame) and always passes, re-arming the watermark.
 *  3. HEARTBEAT (backstop): on flaky links the push stream can silently stall
 *     and strand a client on stale state — the "both players waiting" freeze.
 *     Every few seconds we force a SERVER read; if it is newer than what we've
 *     shown, the push was missed, so we apply it AND resubscribe the (wedged)
 *     listener so the fast-path recovers. As long as the server advanced
 *     `seq`, no client can stay stuck longer than one beat. After `finished`
 *     the beat slows (instead of stopping) and treats a polled `seq === 0` as
 *     the Play-Again reset — otherwise a wedged client could never learn the
 *     host restarted (SYSTEM-REVIEW item 10).
 */
export async function subscribeToSession(
  sessionId: string,
  callback: (session: GameSession | null) => void,
): Promise<() => void> {
  const { doc, onSnapshot } = await import("firebase/firestore");
  const { kickFirestoreConnection } = await import("./firebase");
  const db = await getDb();
  const ref = doc(db, "gameSessions", sessionId);

  const HEARTBEAT_MS = 3000;
  const PROBE_TIMEOUT_MS = 4000;
  let cancelled = false;
  let appliedSeq = 0; // highest seq delivered to the consumer
  let lastStatus: GameSession["status"] | null = null;
  let unsub: () => void = () => {};

  // Deliver a payload unless it is a genuinely stale mid-game snapshot.
  const apply = (data: GameSession | null, seq: number): void => {
    if (cancelled) return;
    if (data === null) {
      callback(null);
      return;
    }
    // Drop only strictly-older mid-game snapshots; always allow resets (seq 0).
    if (appliedSeq > 0 && seq > 0 && seq < appliedSeq) return;
    appliedSeq = seq;
    lastStatus = data.status;
    callback(data);
  };

  const subscribe = (): void => {
    unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        apply(null, 0);
        return;
      }
      const data = { id: snap.id, ...(snap.data() as Omit<GameSession, "id">) };
      apply(data, data.seq ?? 0);
    });
  };
  subscribe();

  // Auth header for the HTTPS poll fallback (token is SDK-cached).
  const authHeader = async (): Promise<Record<string, string>> => {
    try {
      const { getAuth } = await import("./auth");
      const auth = await getAuth();
      const u = auth.currentUser;
      if (!u) return {};
      return { Authorization: `Bearer ${await u.getIdToken()}` };
    } catch {
      return {};
    }
  };

  // Heartbeat watchdog. Polls the session over PLAIN HTTPS — a transport that
  // (unlike the Firestore Watch stream) iOS Safari can't wedge on
  // backgrounding/idle. Renders from whichever channel has the newest seq, so
  // the game keeps advancing even when the realtime listener is dead, and
  // best-effort kicks the SDK to revive its fast path. This is the hard
  // guarantee against the "frozen for 30+ seconds" stall.
  let probing = false;
  let beat = 0;
  const tick = async (): Promise<void> => {
    beat++;
    // Finished games still need the beat (a Play-Again reset must reach a
    // wedged client) — just much slower: every 5th beat (~15s).
    if (cancelled || probing) return;
    if (lastStatus === "finished" && beat % 5 !== 0) return;
    probing = true;
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
    try {
      const headers = await authHeader();
      if (!headers["Authorization"] || cancelled) return;
      const res = await fetch(
        `/api/games/session-state?sessionId=${encodeURIComponent(sessionId)}`,
        { headers, cache: "no-store", signal: ctrl.signal },
      );
      if (cancelled || !res.ok) return;
      const body = (await res.json()) as { session: (GameSession & { seq?: number }) | null };
      const data = body.session;
      if (!data) {
        apply(null, 0);
        return;
      }
      const seq = data.seq ?? 0;
      // Newer state, or a reset (seq re-armed to 0 by startGame / Play Again)
      // that the wedged realtime path never delivered — mirror the realtime
      // apply-gate here so the poll can carry a restart too.
      if (seq > appliedSeq || (seq === 0 && appliedSeq > 0)) {
        apply(data, seq);
        void kickFirestoreConnection();
      }
    } catch {
      // Timeout / network blip — try to revive the stream; next beat retries.
      void kickFirestoreConnection();
    } finally {
      clearTimeout(to);
      probing = false;
    }
  };
  const timer = setInterval(() => void tick(), HEARTBEAT_MS);

  return () => {
    cancelled = true;
    clearInterval(timer);
    unsub();
  };
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
    inbox: {},
    rounds: [],
    transcript: [],
    playerSides,
    pendingInviteUids: [],
    winner: null,
    seq: 0,
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
/** Lightweight, JSON-safe shape for the "My Games" list (from /api/games/active-sessions). */
export interface ActiveSession {
  id: string;
  gameSlug: string;
  engineSlug: string | null;
  gameLogoURL: string | null;
  gameName: string;
  ownerId: string;
  playerCount: number;
  status: string;
  /** Epoch ms (updatedAt) — JSON-safe; format client-side. */
  updatedAtMs: number;
}

/**
 * The signed-in user's active sessions, over plain HTTPS (Admin SDK on the
 * server) — NOT a client getDocs on the Firestore realtime stream, which wedges
 * on iOS. Identity comes from the auth token; the param is ignored.
 */
export async function getActiveSessionsForUser(): Promise<ActiveSession[]> {
  try {
    const { getAuth } = await import("./auth");
    const auth = await getAuth();
    const u = auth.currentUser;
    if (!u) return [];
    const res = await fetch("/api/games/active-sessions", {
      headers: { Authorization: `Bearer ${await u.getIdToken()}` },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const { sessions } = (await res.json()) as { sessions: ActiveSession[] };
    return sessions ?? [];
  } catch {
    return [];
  }
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
