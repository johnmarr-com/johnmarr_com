/**
 * FYVE — server-authoritative reducer (engineKey "fyve").
 *
 * Heist-themed Codenames (2 syndicates, each with a boss + operatives). The
 * engine owns the LIVE GAME — board + secret-key generation, clue intake, the
 * card-reveal loop, turn switching, and win/loss — so an operative's tap no
 * longer depends on the host's client being awake (the old single point of
 * failure). SETUP (heist pick, briefing, team formation) stays host-driven via
 * the /api/games/fyve route, since the host is present and configuring.
 *
 *   …host setup… → boss-select → boss-clue → operative-guess → … → game-over
 *
 * Hidden info: `fyveKeys/{sessionId}` (Admin-only) holds the secret key
 * (key[i] = type of board[i]), civilian position map, bomb index, and the
 * revealed-card set. Generated here at boss-select → boss-clue; read here on
 * each reveal. Operative clients never see colors; bosses read the color map
 * via the route's get-boss-view.
 *
 * Player moves arrive as inbox events (written by the route): `inbox.clue` (the
 * active boss's clue), `inbox.tap` (an active operative's card tap), `inbox.pass`
 * (pass the turn), and `inbox.startHeist` (host launches after picking bosses).
 *
 * Liveness: every active phase carries a generous `phaseDeadlineAt` (self-armed
 * for sessions/phases that lack one). Expiry auto-passes the turn to the other
 * syndicate; `MAX_TIMEOUT_STREAK` consecutive timeouts ends the game for the
 * score leader (setup abandonment just closes the session). Without this, one
 * AFK boss/operative wedged the match forever (SYSTEM-REVIEW item 9).
 */

import { FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { registerEngine } from "../../engine/registry";
import type { EngineSession, Reducer, ReduceContext, StateUpdate } from "../../engine/types";
import {
  applyReveal,
  coinFlipTeam,
  generateBoard,
  otherTeam,
  resolveCard,
  type BoardCard,
  type CardType,
  type FyveTeam,
  type HeistAsset,
  type HeistCivilian,
  type HeistWordPool,
} from "./logic";

const ENGINE_KEY = "fyve";

// Only the live-game phases run the engine; the setup phases are route-driven.
const ACTIVE_PHASES = new Set(["boss-select", "boss-clue", "operative-guess"]);

// Turn deadlines. Generous — FYVE is a talk-it-out party game; these exist to
// unwedge abandoned turns, not to pressure players. Expiry fires via the
// clients' engine-tick nudge or the 1-minute sweepDeadlines pass.
const BOSS_SELECT_MS = 30 * 60_000; // setup abandonment
const TURN_MS = 4 * 60_000;         // boss-clue / operative-guess
const MAX_TIMEOUT_STREAK = 4;       // consecutive timeouts → end for the leader

const keyPath = (sid: string): string => `fyveKeys/${sid}`;
const heistPath = (heistId: string): string => `fyveHeists/${heistId}`;

interface TeamRoster {
  members?: string[];
  bossUid?: string | null;
}
type Teams = Record<FyveTeam, TeamRoster>;

interface KeyDoc {
  key: CardType[];
  civilianAssignments: Record<number, number>;
  bombIndex: number;
  revealedCards?: number[];
}

interface HeistDoc {
  words: HeistWordPool;
  assets: HeistAsset[];
  civilians: HeistCivilian[];
}

/** First key of an inbox channel whose holder passes `ok`, else undefined. */
function firstInboxFrom(
  channel: Record<string, unknown> | undefined,
  ok: (uid: string, ev: Record<string, unknown>) => boolean,
): string | undefined {
  if (!channel) return undefined;
  for (const uid of Object.keys(channel)) {
    const ev = (channel[uid] ?? {}) as Record<string, unknown>;
    if (ok(uid, ev)) return uid;
  }
  return undefined;
}

const fyveReducer: Reducer = {
  shouldRun(s) {
    if (s.status !== "playing") return false;
    return ACTIVE_PHASES.has((s["svPhase"] as string) ?? "");
  },

  secretRefs(s, sessionId) {
    const refs = [keyPath(sessionId)];
    const heistId = s["selectedHeistId"] as string | null;
    if (heistId) refs.push(heistPath(heistId));
    return refs;
  },

  reduce(ctx: ReduceContext): StateUpdate | null {
    const s: EngineSession = ctx.session;
    const sid = ctx.sessionId;
    const phase = (s["svPhase"] as string) ?? "";
    const teams = s["teams"] as Teams | null;
    const heistId = s["selectedHeistId"] as string | null;
    const inbox = s.inbox ?? {};

    // ── Liveness: self-arm a deadline for any active phase missing one
    // (route-driven phase entries + sessions predating turn deadlines). ──
    const deadline = (s["phaseDeadlineAt"] as number | undefined) ?? 0;
    if (!deadline) {
      const ms = phase === "boss-select" ? BOSS_SELECT_MS : TURN_MS;
      return { fields: { phaseDeadlineAt: ctx.now + ms } };
    }

    // ── Deadline expired: auto-advance so an AFK player can't wedge the game. ──
    if (ctx.now >= deadline) {
      if (phase === "boss-select") {
        // Abandoned during setup — close the session quietly (no winner).
        logger.info(`[fyve] ${sid}: boss-select timed out → closing session`);
        return {
          fields: {
            svPhase: "game-over",
            winningTeam: null,
            phaseDeadlineAt: FieldValue.delete(),
          },
          gameOver: true,
          winner: null,
          winnerUids: [],
        };
      }
      const activeTeam = (s["activeTeam"] as FyveTeam | null) ?? "syndicate1";
      const streak = ((s["svTimeoutStreak"] as number | undefined) ?? 0) + 1;
      if (streak >= MAX_TIMEOUT_STREAK) {
        // Both sides have gone quiet — end it for the score leader (tie goes
        // to the team that did NOT just time out, so there's always a winner
        // and the client's game-over flow runs).
        const t1 = (s["t1Score"] as number | undefined) ?? 0;
        const t2 = (s["t2Score"] as number | undefined) ?? 0;
        const leader: FyveTeam =
          t1 > t2 ? "syndicate1" : t2 > t1 ? "syndicate2" : otherTeam(activeTeam);
        logger.info(`[fyve] ${sid}: ${streak} consecutive timeouts → game-over (winner=${leader})`);
        return {
          fields: {
            svPhase: "game-over",
            winningTeam: leader,
            loseByBomb: false,
            currentClue: null,
            svTimeoutStreak: streak,
            phaseDeadlineAt: FieldValue.delete(),
          },
          gameOver: true,
          winner: leader,
          winnerUids: teams?.[leader]?.members ?? [],
        };
      }
      logger.info(`[fyve] ${sid}: ${phase} timed out → auto-pass (streak=${streak})`);
      return {
        fields: {
          activeTeam: otherTeam(activeTeam),
          currentClue: null,
          guessesRemaining: 0,
          guessesUsedThisTurn: 0,
          svPhase: "boss-clue",
          svTimeoutStreak: streak,
          phaseDeadlineAt: ctx.now + TURN_MS,
        },
      };
    }

    // ── boss-select → boss-clue: host launches (startHeist) once both bosses
    // are set. Generate the board + secret key, coin-flip the first team. ──
    if (phase === "boss-select") {
      const start = inbox["startHeist"];
      if (!start || Object.keys(start).length === 0) return null;
      const s1Boss = teams?.syndicate1?.bossUid;
      const s2Boss = teams?.syndicate2?.bossUid;
      if (!s1Boss || !s2Boss || !heistId) {
        // Not ready — drop the stray start request.
        return { fields: { "inbox.startHeist": FieldValue.delete() } };
      }
      const heist = ctx.secrets[heistPath(heistId)] as unknown as HeistDoc | null;
      if (!heist?.words) return null; // await heist read

      const gen = generateBoard(heist.words);
      const firstTeam = coinFlipTeam();
      logger.info(`[fyve] ${sid}: boss-select → boss-clue (first=${firstTeam})`);
      return {
        fields: {
          board: gen.board,
          keyDocId: sid,
          activeTeam: firstTeam,
          currentClue: null,
          guessesRemaining: 0,
          guessesUsedThisTurn: 0,
          t1Score: 0,
          t2Score: 0,
          t1RevealCount: 0,
          t2RevealCount: 0,
          t1RevealedAssets: [],
          t2RevealedAssets: [],
          winningTeam: null,
          loseByBomb: false,
          bombRevealedBy: null,
          svPhase: "boss-clue",
          svTimeoutStreak: 0,
          phaseDeadlineAt: ctx.now + TURN_MS,
          "inbox.startHeist": FieldValue.delete(),
        },
        docWrites: [
          {
            path: keyPath(sid),
            fields: {
              sessionId: sid,
              key: gen.key,
              civilianAssignments: gen.civilianAssignments,
              bombIndex: gen.bombIndex,
              t1RevealCount: 0,
              t2RevealCount: 0,
              revealedCards: [],
              createdAt: FieldValue.serverTimestamp(),
            },
            merge: false,
          },
        ],
      };
    }

    // ── boss-clue → operative-guess: the active boss submits a clue. ──
    if (phase === "boss-clue") {
      const clueChannel = inbox["clue"] as Record<string, Record<string, unknown>> | undefined;
      if (!clueChannel) return null;
      const activeTeam = s["activeTeam"] as FyveTeam | null;
      const activeBoss = activeTeam ? teams?.[activeTeam]?.bossUid ?? null : null;
      const ev = activeBoss ? clueChannel[activeBoss] : undefined;
      const word = ev?.["word"] as string | undefined;
      const number = ev?.["number"] as number | undefined;
      if (!activeBoss || !word || !number) {
        // Stray/invalid clue (wrong boss, malformed) — clear the channel.
        return { fields: { "inbox.clue": FieldValue.delete() } };
      }
      logger.info(`[fyve] ${sid}: boss-clue → operative-guess (${word}:${number})`);
      return {
        fields: {
          currentClue: { word, number, givenBy: activeBoss },
          guessesRemaining: number,
          guessesUsedThisTurn: 0,
          svPhase: "operative-guess",
          svTimeoutStreak: 0,
          phaseDeadlineAt: ctx.now + TURN_MS,
          "inbox.clue": FieldValue.delete(),
        },
      };
    }

    // ── operative-guess: resolve a tap (reveal) or a pass. ──
    if (phase === "operative-guess") {
      const activeTeam = s["activeTeam"] as FyveTeam | null;
      if (!activeTeam) return null;
      const roster = teams?.[activeTeam];
      const members = roster?.members ?? [];
      const boss = roster?.bossUid ?? null;
      const isActiveOperative = (uid: string): boolean => members.includes(uid) && uid !== boss;
      const board = (s["board"] as BoardCard[] | null) ?? [];

      // --- Tap → reveal ---
      const tapChannel = inbox["tap"] as Record<string, Record<string, unknown>> | undefined;
      const tapperUid = firstInboxFrom(
        tapChannel,
        (uid, ev) => isActiveOperative(uid) && typeof ev["cardIndex"] === "number",
      );
      if (tapperUid && tapChannel) {
        const cardIndex = tapChannel[tapperUid]!["cardIndex"] as number;
        // Idempotency: ignore a tap on an already-revealed card.
        if (board[cardIndex]?.revealed) {
          return { fields: { [`inbox.tap.${tapperUid}`]: FieldValue.delete() } };
        }
        const keyDoc = ctx.secrets[keyPath(sid)] as unknown as KeyDoc | null;
        const heist = heistId ? (ctx.secrets[heistPath(heistId)] as unknown as HeistDoc | null) : null;
        if (!keyDoc?.key || !heist) return null; // await secret reads

        const t1RevealCount = (s["t1RevealCount"] as number) ?? 0;
        const t2RevealCount = (s["t2RevealCount"] as number) ?? 0;
        const guessesRemaining = (s["guessesRemaining"] as number) ?? 0;
        const guessesUsedThisTurn = (s["guessesUsedThisTurn"] as number) ?? 0;

        const result = resolveCard({
          key: keyDoc.key,
          cardIndex,
          assets: heist.assets ?? [],
          civilians: heist.civilians ?? [],
          civilianAssignments: keyDoc.civilianAssignments ?? {},
          t1RevealCount,
          t2RevealCount,
          activeTeam,
        });
        const outcome = applyReveal({
          cardType: result.cardType,
          activeTeam,
          t1RevealCount,
          t2RevealCount,
          guessesRemaining,
          guessesUsedThisTurn,
        });

        const updatedBoard = [...board];
        const prior = updatedBoard[cardIndex]!;
        updatedBoard[cardIndex] = {
          ...prior,
          revealed: true,
          revealedType: result.cardType,
          revealedName: result.name,
          revealedDescription: result.description,
          revealedImageUrl: result.imageUrl,
          revealedByTeam: activeTeam,
          ...(result.assetNumber != null ? { revealedAssetNumber: result.assetNumber } : {}),
          ...(result.bombSoundEffect ? { revealedSoundEffect: result.bombSoundEffect } : {}),
        };

        const fields: Record<string, unknown> = {
          board: updatedBoard,
          t1Score: outcome.t1Score,
          t2Score: outcome.t2Score,
          t1RevealCount: outcome.t1RevealCount,
          t2RevealCount: outcome.t2RevealCount,
          activeTeam: outcome.activeTeam,
          guessesRemaining: outcome.guessesRemaining,
          guessesUsedThisTurn: outcome.guessesUsedThisTurn,
          svPhase: outcome.nextPhase,
          svTimeoutStreak: 0,
          phaseDeadlineAt:
            outcome.nextPhase === "game-over" ? FieldValue.delete() : ctx.now + TURN_MS,
          [`inbox.tap.${tapperUid}`]: FieldValue.delete(),
        };
        if (outcome.clearClue) fields["currentClue"] = null;
        if (outcome.winningTeam) {
          fields["winningTeam"] = outcome.winningTeam;
          fields["loseByBomb"] = outcome.loseByBomb;
          if (outcome.loseByBomb) fields["bombRevealedBy"] = tapperUid;
        }

        const update: StateUpdate = {
          fields,
          docWrites: [
            {
              path: keyPath(sid),
              fields: {
                revealedCards: FieldValue.arrayUnion(cardIndex),
                t1RevealCount: outcome.t1RevealCount,
                t2RevealCount: outcome.t2RevealCount,
              },
              merge: true,
            },
          ],
        };
        if (outcome.winningTeam) {
          logger.info(`[fyve] ${sid}: reveal ${result.cardType} → game-over (winner=${outcome.winningTeam})`);
          update.gameOver = true;
          update.winner = outcome.winningTeam;
          // winner is a team name — record the member uids canonically.
          update.winnerUids = teams?.[outcome.winningTeam]?.members ?? [];
        } else {
          logger.info(`[fyve] ${sid}: reveal ${result.cardType} → ${outcome.nextPhase} (active=${outcome.activeTeam})`);
        }
        return update;
      }

      // --- Pass turn ---
      const passChannel = inbox["pass"] as Record<string, Record<string, unknown>> | undefined;
      const passerUid = firstInboxFrom(passChannel, (uid) => isActiveOperative(uid));
      if (passerUid) {
        logger.info(`[fyve] ${sid}: operative-guess → boss-clue (pass)`);
        return {
          fields: {
            activeTeam: otherTeam(activeTeam),
            currentClue: null,
            guessesRemaining: 0,
            guessesUsedThisTurn: 0,
            svPhase: "boss-clue",
            svTimeoutStreak: 0,
            phaseDeadlineAt: ctx.now + TURN_MS,
            "inbox.pass": FieldValue.delete(),
          },
        };
      }

      return null;
    }

    return null;
  },
};

registerEngine(ENGINE_KEY, fyveReducer);
