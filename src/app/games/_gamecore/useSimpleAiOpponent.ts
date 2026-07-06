"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { submitMove, type GameSession } from "@/lib/game-sessions";
import { simpleMove, postGameComment } from "./AIPlayerManager";
import { isAiPlayer, getPersona } from "./aiPersonas";
import { updateSessionFields } from "./sessionHelpers";

/** One resolved round from the AI's perspective. */
export interface AiMoveRecord<M extends string> {
  player: M;
  opponent: M;
  winner: "player" | "opponent" | "tie";
}

/** Context handed to the game's prompt builders (game-specific bits). */
export interface AiPromptContext {
  /** The AI's session side (e.g. "p1" / "red"), if assigned. */
  aiSide: string | undefined;
  /** The persona's skill level (drives history-slicing tiers). */
  skillLevel: number | undefined;
}

interface UseSimpleAiOpponentOptions<M extends string> {
  session: GameSession | null;
  isHost: boolean;
  sessionId: string;
  /** True while the local round is open for moves (phase === "ready"). */
  roundOpen: boolean;
  /** True once the match has ended (phase === "finished"). */
  finished: boolean;
  /** Move assumed when a round record is missing one (defensive default). */
  defaultHistoryMove: M;
  /** Moves to pick from at random when the AI's reply doesn't parse. */
  fallbackMoves: readonly M[];
  /** Map the AI's free-text ACTION line to a move. */
  parseAction: (action: string) => M | null;
  /** Build the per-round move prompt (game-specific; stays in the game file). */
  buildMovePrompt: (history: AiMoveRecord<M>[], ctx: AiPromptContext) => string;
  /** Build the post-game comment prompt (game-specific). */
  buildPostGamePrompt: (history: AiMoveRecord<M>[], aiWon: boolean, ctx: AiPromptContext) => string;
  /** Decide whether the AI won the finished match (game reads its score refs). */
  computeAiWon: (ctx: { session: GameSession; aiUid: string; aiSide: string }) => boolean;
}

/**
 * AI opponent driver for the simultaneous-move 1v1 games (SweepTheLeg,
 * TapSmashArena). The AI is a session player; the HOST's client drives it:
 * reconstruct the AI's move history from the server-written rounds, fetch a
 * move whenever a round opens and submit it, and on match end generate the
 * persona's post-game comment + record its W/L. Prompt building stays in the
 * game file — this hook only orchestrates.
 */
export function useSimpleAiOpponent<M extends string>({
  session,
  isHost,
  sessionId,
  roundOpen,
  finished,
  defaultHistoryMove,
  fallbackMoves,
  parseAction,
  buildMovePrompt,
  buildPostGamePrompt,
  computeAiWon,
}: UseSimpleAiOpponentOptions<M>) {
  const aiUid = useMemo(
    () => session?.players.find((p) => isAiPlayer(p.uid))?.uid ?? null,
    [session?.players],
  );
  const aiSide = useMemo(
    () => (aiUid ? session?.playerSides?.[aiUid] : undefined),
    [aiUid, session?.playerSides],
  );
  const aiPersona = useMemo(() => (aiUid ? getPersona(aiUid) : undefined), [aiUid]);
  const personaPrompt = aiPersona?.prompt || undefined;
  const personaVoice = aiPersona?.voice || undefined;
  const personaSkillLevel = aiPersona?.skillLevel;
  const aiName = aiPersona?.name || "AI";
  const vsAI = !!aiUid;

  // Reconstruct the AI's move history (from its perspective) for prompt context.
  const aiHistory = useMemo<AiMoveRecord<M>[]>(() => {
    if (!aiUid || !aiSide || !session?.rounds) return [];
    const humanUid = session.players.find((p) => p.uid !== aiUid)?.uid ?? "";
    return session.rounds.map((r) => {
      const res = r.result as { winner: string | null };
      const aiMove = (r.moves[aiUid] ?? defaultHistoryMove) as M;
      const humanMove = (r.moves[humanUid] ?? defaultHistoryMove) as M;
      const winner: AiMoveRecord<M>["winner"] =
        res.winner === null ? "tie" : res.winner === aiSide ? "opponent" : "player";
      return { player: humanMove, opponent: aiMove, winner };
    });
  }, [aiUid, aiSide, session?.rounds, session?.players, defaultHistoryMove]);

  const fetchAiMove = useCallback((): Promise<{ attack: M; reasoning: string }> => {
    const prompt = buildMovePrompt(aiHistory, { aiSide, skillLevel: personaSkillLevel });
    return simpleMove(prompt, personaPrompt, personaVoice)
      .then(({ action, reason }) => {
        const attack = parseAction(action);
        if (attack) return { attack, reasoning: reason };
        return { attack: fallbackMoves[Math.floor(Math.random() * fallbackMoves.length)]!, reasoning: reason };
      })
      .catch(() => ({
        attack: fallbackMoves[Math.floor(Math.random() * fallbackMoves.length)]!,
        reasoning: "",
      }));
  }, [buildMovePrompt, aiHistory, aiSide, personaSkillLevel, personaPrompt, personaVoice, parseAction, fallbackMoves]);

  // ─── Host drives the AI opponent's move when a round opens ───
  // The in-flight request is intentionally NOT cancelled on re-render: a
  // snapshot or phase change (e.g. the human submitting their move flips the
  // phase to "animating") must not abort the AI's pending request, or the AI
  // would never submit and the round stalls on "waiting for opponent" forever.
  // The round guard prevents duplicate requests; a failed submit resets it so a
  // later snapshot retries.
  const aiMoveRoundRef = useRef(-1);
  useEffect(() => {
    if (!isHost || !aiUid || !session || session.status !== "playing") return;
    if (!roundOpen) return;
    const round = session.currentRound ?? 0;
    if (session.pendingMoves?.[aiUid] != null) return; // AI already moved this round
    if (aiMoveRoundRef.current >= round) return; // already generating for this round
    aiMoveRoundRef.current = round;

    void fetchAiMove().then(({ attack }) => {
      void submitMove(sessionId, aiUid, attack).catch(() => {
        // Submit failed — allow a later snapshot to retry this round.
        if (aiMoveRoundRef.current === round) aiMoveRoundRef.current = round - 1;
      });
    });
  }, [isHost, aiUid, session, roundOpen, sessionId, fetchAiMove]);

  // ─── On match end: host generates the AI post-game comment + records W/L ───
  const finishedFiredRef = useRef(false);
  useEffect(() => {
    if (!finished || !session || finishedFiredRef.current) return;
    finishedFiredRef.current = true;
    if (!isHost || !aiUid || !aiSide) return;

    const aiWon = computeAiWon({ session, aiUid, aiSide });

    const prompt = buildPostGamePrompt(aiHistory, aiWon, { aiSide, skillLevel: personaSkillLevel });
    postGameComment(prompt, personaPrompt, personaVoice)
      .then(({ comment }) => {
        if (comment) {
          void updateSessionFields(sessionId, { [`aiPostGameComments.${aiUid}`]: comment });
        }
      })
      .catch(() => {});

    const docId = aiUid.replace(/^ai-/, "");
    import("@/lib/ai-personas").then(({ recordAIGameResult }) => {
      recordAIGameResult(docId, aiWon).catch(() => {});
    });
  }, [finished, session, isHost, aiUid, aiSide, aiHistory, computeAiWon, buildPostGamePrompt, personaSkillLevel, personaPrompt, personaVoice, sessionId]);

  return { aiUid, aiName, vsAI };
}
