"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import { JMSimpleButton } from "@/JMKit";
import {
  GameGamertagBadge,
  GamePrimaryButton,
  recordGameStats,
  useEngineDeadline,
} from "@/app/games/_gamecore";
import { PointsManager, Activity } from "@/lib/points";
import type { JMContent } from "@/lib/content-types";
import type { GameEndResult } from "@/app/games/_gamecore/registry/types";
import { useLineupSession } from "./useLineupSession";
import { submitFact, submitVote } from "./lineupApi";
import SubmitFactScreen from "./screens/SubmitFactScreen";
import VoteScreen from "./screens/VoteScreen";
import ResultsScreen from "./screens/ResultsScreen";

// Phase timer durations for the progress bar — keep in sync with the lineup
// reducer (COLLECT_MS / VOTE_MS).
const LU_COLLECT_MS = 90_000;
const LU_VOTE_MS = 40_000;

interface LineupGameProps {
  sessionId: string;
  splashBgURL?: string;
  gameLogoURL?: string;
  /** When provided (via composeGame), the game hands off to the shared GC4
   *  result screen instead of rendering its own winner screen. */
  gameData?: JMContent;
  onGameEnd?: (result: GameEndResult) => void;
}

export default function LineupGame({
  sessionId,
  splashBgURL,
  gameLogoURL,
  onGameEnd,
}: LineupGameProps) {
  const { user } = useAuth();
  const router = useRouter();
  const userId = user?.uid ?? "";
  const { state } = useLineupSession(sessionId, userId);

  const {
    session,
    luPhase,
    luSubmitted,
    luCurrentIndex,
    luCurrentFact,
    luTotalRounds,
    luVotes,
    luScores,
    luReveal,
    luWinners,
    luWinnerPoints,
    phaseDeadlineAt,
    myFact,
    isHost,
  } = state;

  const players = useMemo(() => session?.players ?? [], [session?.players]);
  const playerUids = players.map((p) => p.uid);
  const kicked = session?.kickedUids?.includes(userId) ?? false;

  // Nudge the engine the instant a timed phase deadline passes, so it advances
  // without waiting for the 1-minute sweep.
  useEngineDeadline(sessionId, phaseDeadlineAt);

  // ─── Derived values ────────────────────────────────────────

  const submissionCount = Object.keys(luSubmitted).length;
  const hasSubmitted = luSubmitted[userId] === true;

  const hasVoted = luVotes[userId] != null;
  const voteCount = Object.keys(luVotes).length;
  // Everyone but the fact's author guesses, so one fewer than the room.
  const eligibleVoters = Math.max(0, players.length - 1);
  // The author sits out their own round — detected by matching the on-screen
  // fact to this player's own (owner-readable) submission, never via authorship
  // on the public doc.
  const isMyFact =
    myFact != null && luCurrentFact.trim().length > 0 && myFact.trim() === luCurrentFact.trim();

  // ─── Player actions (via API; engine owns all transitions) ──

  const handleSubmitFact = useCallback(
    async (fact: string) => {
      const result = await submitFact(sessionId, fact);
      if (!result.ok) throw new Error(result.error);
    },
    [sessionId],
  );

  const handleVote = useCallback(
    async (votedForUid: string) => {
      const result = await submitVote(sessionId, votedForUid);
      if (!result.ok) throw new Error(result.error);
    },
    [sessionId],
  );

  // ─── Delegate to the composeGame result screen on final ─────
  const gameEndFiredRef = useRef(false);
  useEffect(() => {
    if (luPhase === "final" && onGameEnd && !gameEndFiredRef.current) {
      gameEndFiredRef.current = true;
      const ps = session?.players ?? [];
      onGameEnd({
        winners: ps.filter((p) => luWinners.includes(p.uid)),
        winnerPoints: luWinnerPoints,
        allPlayers: ps,
        scores: luScores,
      });

      // Each client awards its own points; the host records stats once.
      PointsManager.award(Activity.PLAY_GAME);
      if (isHost) PointsManager.award(Activity.HOST_GAME);
      if (luWinners.includes(userId)) PointsManager.award(Activity.WIN_GAME);
      if (isHost) recordGameStats(playerUids, luWinners, session?.ownerId ?? "");
    }
    if (luPhase !== "final") {
      gameEndFiredRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires once on transition to final
  }, [luPhase, luWinners, luWinnerPoints, luScores, onGameEnd, session?.players, isHost, userId]);

  // ─── Render ───────────────────────────────────────────────

  if (!session) return null;

  return (
    <div className="fixed inset-0 flex flex-col bg-black">
      {/* Background */}
      {splashBgURL && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${splashBgURL})` }}
        />
      )}

      {/* Collecting phase — everyone writes a fact */}
      {luPhase === "collecting" && (
        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          <SubmitFactScreen
            deadline={phaseDeadlineAt}
            timerDurationMs={LU_COLLECT_MS}
            hasSubmitted={hasSubmitted}
            submissionCount={submissionCount}
            totalPlayers={players.length}
            onSubmit={handleSubmitFact}
          />
        </div>
      )}

      {/* Voting phase — guess whose fact */}
      {luPhase === "voting" && (
        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          <VoteScreen
            fact={luCurrentFact}
            factNumber={luCurrentIndex + 1}
            totalFacts={luTotalRounds}
            players={players}
            currentUserId={userId}
            isMyFact={isMyFact}
            deadline={phaseDeadlineAt}
            timerDurationMs={LU_VOTE_MS}
            hasVoted={hasVoted}
            voteCount={voteCount}
            totalVoters={eligibleVoters}
            onVote={handleVote}
          />
        </div>
      )}

      {/* Results phase — reveal + leaderboard */}
      {luPhase === "results" && luReveal && (
        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          <ResultsScreen
            reveal={luReveal}
            factNumber={luCurrentIndex + 1}
            totalFacts={luTotalRounds}
            votes={luVotes}
            players={players}
            scores={luScores}
          />
        </div>
      )}

      {/* Final — handed to the shared GC4 result screen via onGameEnd. */}
      {luPhase === "final" && (
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
          <p className="text-sm font-bold uppercase tracking-wider text-white/70">
            Tallying the winner&hellip;
          </p>
        </div>
      )}

      {/* HUD: gamertag + logo */}
      <GameGamertagBadge />
      {(luPhase === "collecting" || luPhase === "final") && (
        <Link href="/" className="absolute left-3 top-3 z-60">
          <JMSimpleButton
            title="EXIT"
            size="sm"
            variant="ghost"
            titleColor="#ffffff"
            className="gap-1.5 rounded-lg bg-black/50 backdrop-blur-sm"
          >
            <span className="text-sm leading-none">&#9664;</span> EXIT
          </JMSimpleButton>
        </Link>
      )}
      {gameLogoURL && luPhase !== "final" && (
        <div className="pointer-events-none absolute right-[-8px] top-2 z-20 animate-[wk-slide-in-tr_0.6s_ease-out_both]">
          <Image
            src={gameLogoURL}
            alt=""
            width={300}
            height={120}
            className="h-25 w-auto object-contain drop-shadow-lg select-none sm:h-30 animate-[rock_3s_ease-in-out_0.6s_infinite]"
          />
        </div>
      )}

      {/* Kicked overlay */}
      {kicked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
          <div className="flex w-full max-w-sm flex-col items-center gap-6 px-6">
            <p className="text-center text-xl font-bold text-white">
              You have been uninvited to the game.
            </p>
            <GamePrimaryButton onClick={() => router.push("/")} variant="white">
              Okay
            </GamePrimaryButton>
          </div>
        </div>
      )}
    </div>
  );
}
