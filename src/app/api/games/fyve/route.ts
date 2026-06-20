import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken, getAdminFirestore } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { CardType, FyveBossView } from "@/app/games/fyve/fyveTypes";

/**
 * FYVE — intent-writer route (engineKey "fyve").
 *
 * The gameEngine reducer owns the LIVE GAME (board + secret-key generation, the
 * reveal loop, turn switching, win/loss). This route only:
 *  - writes host SETUP state (heist pick → briefing → team formation → bosses),
 *  - writes player MOVE intents into the inbox (clue / tap / pass / startHeist)
 *    which the engine then resolves,
 *  - serves a boss their color map (get-boss-view) — a per-boss read, never stored,
 *  - resets for a rematch (play-again).
 *
 * Setup/reset writes bump `seq` (no engine advance follows them, so the client's
 * poll fallback needs a higher seq to apply them). Move intents don't — the
 * engine's resulting advance bumps seq and carries the new state.
 */

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

// ─── Helpers ────────────────────────────────────────────────

interface BoardCardLite {
  word: string;
  revealed: boolean;
}
interface TeamRoster {
  members?: string[];
  bossUid?: string | null;
}

function eventId(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

/** Single-word clue legality vs the (unrevealed) board words. */
function clueValidity(clueWord: string, boardWords: string[]): { valid: boolean; reason?: string } {
  const word = clueWord.trim().toUpperCase();
  if (word.length === 0 || word.includes(" ")) return { valid: false, reason: "Clue must be a single word" };
  const boardUpper = boardWords.map((w) => w.toUpperCase());
  if (boardUpper.includes(word)) return { valid: false, reason: "Clue cannot be a word on the board" };
  for (const bw of boardUpper) {
    if (bw.length >= 4 && (word.startsWith(bw) || bw.startsWith(word))) {
      return { valid: false, reason: `Clue appears to be a derivative of "${bw}"` };
    }
  }
  return { valid: true };
}

// ─── Route ──────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing or invalid authorization header" }, { status: 401 });
  }
  let uid: string;
  try {
    uid = (await verifyIdToken(authHeader.substring(7))).uid;
  } catch {
    return NextResponse.json({ error: "Invalid auth token" }, { status: 401 });
  }
  if (isRateLimited(uid)) {
    return NextResponse.json({ error: "Too many requests — try again shortly" }, { status: 429 });
  }

  try {
    const body = await request.json();
    const action = body?.action as string | undefined;
    const sessionId = body?.sessionId as string | undefined;
    if (!action || !sessionId) {
      return NextResponse.json({ error: "Missing action or sessionId" }, { status: 400 });
    }

    const db = getAdminFirestore();
    const sessionRef = db.doc(`gameSessions/${sessionId}`);
    const sessionSnap = await sessionRef.get();
    if (!sessionSnap.exists) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    const data = sessionSnap.data()!;
    if (data["engineKey"] !== "fyve") {
      return NextResponse.json({ error: "Not a FYVE engine session" }, { status: 400 });
    }

    const isHost = data["ownerId"] === uid;
    const phase = (data["svPhase"] as string) ?? "heist-select";
    const teams = data["teams"] as Record<string, TeamRoster> | undefined;
    const activeTeam = data["activeTeam"] as "syndicate1" | "syndicate2" | null;
    const playerUids = (data["playerUids"] ?? []) as string[];

    const bumpSeq = { seq: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() };

    // ── get-boss-view (read; a boss's color map, never stored) ──
    if (action === "get-boss-view") {
      if (!playerUids.includes(uid)) {
        return NextResponse.json({ error: "Not a player in this session" }, { status: 403 });
      }
      const isBoss = teams?.["syndicate1"]?.bossUid === uid || teams?.["syndicate2"]?.bossUid === uid;
      if (!isBoss) return NextResponse.json({ error: "Only bosses can view the key" }, { status: 403 });
      const keySnap = await db.doc(`fyveKeys/${sessionId}`).get();
      if (!keySnap.exists) return NextResponse.json({ error: "Key not ready" }, { status: 404 });
      const view: FyveBossView = { colorMap: keySnap.data()!["key"] as CardType[] };
      return NextResponse.json(view);
    }

    // ── select-heist (host) → briefing ──
    if (action === "select-heist") {
      if (!isHost) return NextResponse.json({ error: "Only the host can pick the heist" }, { status: 403 });
      if (phase !== "heist-select") return NextResponse.json({ error: "Heist already chosen" }, { status: 409 });
      const heistId = body?.heistId as string | undefined;
      if (!heistId) return NextResponse.json({ error: "Missing heistId" }, { status: 400 });
      const heistSnap = await db.doc(`fyveHeists/${heistId}`).get();
      if (!heistSnap.exists) return NextResponse.json({ error: "Heist not found" }, { status: 404 });
      const h = heistSnap.data()!;
      await sessionRef.update({
        selectedHeistId: heistId,
        selectedHeistTitle: (h["title"] as string) ?? null,
        selectedHeistBgUrl: (h["backgroundImageUrl"] as string) ?? null,
        selectedHeistTargetUrl: (h["targetObjectImageUrl"] as string) ?? null,
        heistBriefing: (h["briefing"] as string) ?? null,
        heistSetting: (h["setting"] as Record<string, unknown>) ?? null,
        svPhase: "briefing",
        ...bumpSeq,
      });
      return NextResponse.json({ ok: true });
    }

    // ── continue-briefing (host) → team-formation ──
    if (action === "continue-briefing") {
      if (!isHost) return NextResponse.json({ error: "Only the host can continue" }, { status: 403 });
      if (phase !== "briefing") return NextResponse.json({ error: "Not in briefing" }, { status: 409 });
      await sessionRef.update({ svPhase: "team-formation", ...bumpSeq });
      return NextResponse.json({ ok: true });
    }

    // ── update-draft (host) — live team-formation preview ──
    if (action === "update-draft") {
      if (!isHost) return NextResponse.json({ error: "Only the host can edit teams" }, { status: 403 });
      if (phase !== "team-formation") return NextResponse.json({ error: "Not forming teams" }, { status: 409 });
      await sessionRef.update({
        draftTeam1: (body?.draftTeam1 as string[]) ?? [],
        draftTeam2: (body?.draftTeam2 as string[]) ?? [],
        draftT1Logo: (body?.draftT1Logo as string) ?? null,
        draftT2Logo: (body?.draftT2Logo as string) ?? null,
        ...bumpSeq,
      });
      return NextResponse.json({ ok: true });
    }

    // ── confirm-teams (host) → boss-select ──
    if (action === "confirm-teams") {
      if (!isHost) return NextResponse.json({ error: "Only the host can confirm teams" }, { status: 403 });
      if (phase !== "team-formation") return NextResponse.json({ error: "Not forming teams" }, { status: 409 });
      const team1 = (body?.team1 as string[]) ?? [];
      const team2 = (body?.team2 as string[]) ?? [];
      if (team1.length === 0 || team2.length === 0) {
        return NextResponse.json({ error: "Each team needs at least one player" }, { status: 400 });
      }
      await sessionRef.update({
        teams: {
          syndicate1: { members: team1, bossUid: null },
          syndicate2: { members: team2, bossUid: null },
        },
        t1Name: (body?.t1Name as string) ?? null,
        t2Name: (body?.t2Name as string) ?? null,
        draftT1Logo: (body?.t1Logo as string) ?? (data["draftT1Logo"] ?? null),
        draftT2Logo: (body?.t2Logo as string) ?? (data["draftT2Logo"] ?? null),
        svPhase: "boss-select",
        ...bumpSeq,
      });
      return NextResponse.json({ ok: true });
    }

    // ── back-to-teams (host) — re-edit teams from boss-select ──
    if (action === "back-to-teams") {
      if (!isHost) return NextResponse.json({ error: "Only the host can edit teams" }, { status: 403 });
      if (phase !== "boss-select") return NextResponse.json({ error: "Not in boss select" }, { status: 409 });
      await sessionRef.update({ svPhase: "team-formation", ...bumpSeq });
      return NextResponse.json({ ok: true });
    }

    // ── select-bosses (host) — writes bosses + startHeist intent → engine ──
    if (action === "select-bosses") {
      if (!isHost) return NextResponse.json({ error: "Only the host can select bosses" }, { status: 403 });
      if (phase !== "boss-select") return NextResponse.json({ error: "Not in boss select" }, { status: 409 });
      const s1Boss = body?.s1Boss as string | undefined;
      const s2Boss = body?.s2Boss as string | undefined;
      if (!s1Boss || !s2Boss) return NextResponse.json({ error: "Both bosses required" }, { status: 400 });
      if (!teams?.["syndicate1"]?.members?.includes(s1Boss) || !teams?.["syndicate2"]?.members?.includes(s2Boss)) {
        return NextResponse.json({ error: "Boss must be a member of their team" }, { status: 400 });
      }
      await sessionRef.update({
        "teams.syndicate1.bossUid": s1Boss,
        "teams.syndicate2.bossUid": s2Boss,
        [`inbox.startHeist.${uid}`]: { eventId: eventId() },
      });
      return NextResponse.json({ ok: true });
    }

    // ── submit-clue (active boss) — validate, then write clue intent ──
    if (action === "submit-clue") {
      if (phase !== "boss-clue") return NextResponse.json({ error: "Not awaiting a clue" }, { status: 409 });
      const activeBoss = activeTeam ? teams?.[activeTeam]?.bossUid : null;
      if (uid !== activeBoss) return NextResponse.json({ error: "Only the active boss can give a clue" }, { status: 403 });
      const clueWord = (body?.clueWord as string | undefined)?.trim() ?? "";
      const number = body?.number as number | undefined;
      if (!clueWord || number == null || number < 1 || number > 5) {
        return NextResponse.json({ error: "Clue word + a number 1–5 required" }, { status: 400 });
      }
      const board = (data["board"] as BoardCardLite[] | undefined) ?? [];
      const boardWords = board.filter((c) => !c.revealed).map((c) => c.word);
      const v = clueValidity(clueWord, boardWords);
      if (!v.valid) return NextResponse.json({ error: v.reason ?? "Invalid clue" }, { status: 400 });
      await sessionRef.update({
        [`inbox.clue.${uid}`]: { word: clueWord.toUpperCase(), number, eventId: eventId() },
      });
      return NextResponse.json({ ok: true });
    }

    // ── tap-card (active operative) — write tap intent → engine reveals ──
    if (action === "tap-card") {
      if (phase !== "operative-guess") return NextResponse.json({ error: "Not guessing" }, { status: 409 });
      const roster = activeTeam ? teams?.[activeTeam] : undefined;
      const isActiveOperative = !!roster?.members?.includes(uid) && roster.bossUid !== uid;
      if (!isActiveOperative) return NextResponse.json({ error: "Only an operative on the active team can tap" }, { status: 403 });
      const cardIndex = body?.cardIndex as number | undefined;
      if (cardIndex == null || cardIndex < 0 || cardIndex > 15) {
        return NextResponse.json({ error: "Invalid card index" }, { status: 400 });
      }
      const board = (data["board"] as BoardCardLite[] | undefined) ?? [];
      if (board[cardIndex]?.revealed) return NextResponse.json({ error: "Card already revealed" }, { status: 409 });
      await sessionRef.update({
        [`inbox.tap.${uid}`]: { cardIndex, eventId: eventId() },
      });
      return NextResponse.json({ ok: true });
    }

    // ── pass-turn (active operative) — write pass intent → engine switches ──
    if (action === "pass-turn") {
      if (phase !== "operative-guess") return NextResponse.json({ error: "Not guessing" }, { status: 409 });
      const roster = activeTeam ? teams?.[activeTeam] : undefined;
      const isActiveOperative = !!roster?.members?.includes(uid) && roster.bossUid !== uid;
      if (!isActiveOperative) return NextResponse.json({ error: "Only an operative on the active team can pass" }, { status: 403 });
      await sessionRef.update({
        [`inbox.pass.${uid}`]: { eventId: eventId() },
      });
      return NextResponse.json({ ok: true });
    }

    // ── play-again (host) — reset to boss-select (teams + heist preserved) ──
    if (action === "play-again") {
      if (!isHost) return NextResponse.json({ error: "Only the host can restart" }, { status: 403 });
      await sessionRef.update({
        board: null,
        keyDocId: null,
        activeTeam: null,
        currentClue: null,
        guessesRemaining: 0,
        guessesUsedThisTurn: 0,
        winningTeam: null,
        loseByBomb: false,
        bombRevealedBy: null,
        t1Score: 0,
        t2Score: 0,
        t1RevealCount: 0,
        t2RevealCount: 0,
        t1RevealedAssets: [],
        t2RevealedAssets: [],
        status: "playing",
        svPhase: "boss-select",
        inbox: {},
        ...bumpSeq,
      });
      return NextResponse.json({ ok: true });
    }

    // ── validate-clue (read-only) — used by the boss UI for live feedback ──
    if (action === "validate-clue") {
      const clueWord = (body?.clueWord as string | undefined) ?? "";
      const boardWords = (body?.boardWords as string[] | undefined) ?? [];
      return NextResponse.json(clueValidity(clueWord, boardWords));
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error(`[FYVE] Error for uid=${uid}:`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
