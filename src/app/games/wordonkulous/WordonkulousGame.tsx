"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useAuth } from "@/lib/AuthProvider";
import { useWordonkulousSession } from "./useWordonkulousSession";
import { getCurrentDefinition, scoreRound } from "./wordonkulousTypes";
import type { RoundScoreResult } from "./wordonkulousTypes";
import { recordGameStats, GameGamertagBadge, useGameColors, useEngineDeadline } from "@/app/games/_gamecore";
import { selectPack, submitWord, submitVote } from "./wordonkulousApi";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap, Zap, Timer, SportShoe } from "lucide-react";
import { PointsManager, Activity } from "@/lib/points";
import { JMConfettiOverlay, JMSimpleButton } from "@/JMKit";
import { GamePrimaryButton } from "@/app/games/_gamecore";
import type { GameLengthPreset } from "@/app/games/_gamecore/gameLengthPresets";

const WK_LENGTH_PRESETS_BASE: Omit<GameLengthPreset, "iconColor">[] = [
  { key: "learn", label: "Learn", rounds: 1, estimatedMinutes: 3, icon: GraduationCap },
  { key: "quick", label: "Quick", rounds: 3, estimatedMinutes: 8, icon: Zap },
  { key: "standard", label: "Standard", rounds: 5, estimatedMinutes: 12, icon: Timer },
  { key: "marathon", label: "Marathon", rounds: 7, estimatedMinutes: 17, icon: SportShoe },
];
import type { WordonkulousPack } from "@/lib/wordonkulous-packs";
import type { JMContent } from "@/lib/content-types";
import type { GameEndResult } from "@/app/games/_gamecore/registry/types";

import RoundIntroScreen from "./screens/RoundIntroScreen";
import SubmitWordScreen from "./screens/SubmitWordScreen";
import VotingScreen from "./screens/VotingScreen";
import RoundResultsScreen from "./screens/RoundResultsScreen";
import WinnerScreen from "./screens/WinnerScreen";
import WordonkulousPackPicker from "./WordonkulousPackPicker";

// Phase timer durations for the progress bar — keep in sync with the
// wordonkulous reducer (SUBMIT_MS / VOTE_MS).
const WK_SUBMIT_MS = 75_000;
const WK_VOTE_MS = 45_000;

interface WordonkulousGameProps {
  sessionId: string;
  splashBgURL?: string;
  gameLogoURL?: string;
  splashIconURL?: string;
  /** When provided (via composeGame), the game calls this instead of rendering its own WinnerScreen. */
  gameData?: JMContent;
  onGameEnd?: (result: GameEndResult) => void;
}

export default function WordonkulousGame({
  sessionId,
  splashBgURL,
  gameLogoURL,
  onGameEnd,
}: WordonkulousGameProps) {
  const { user } = useAuth();
  const router = useRouter();
  const { primary, secondary, danger } = useGameColors();
  const userId = user?.uid ?? "";
  const { state, updateFields } = useWordonkulousSession(sessionId, userId);
  const [showRoundIntro, setShowRoundIntro] = useState(false);
  const [lastRoundResult, setLastRoundResult] = useState<RoundScoreResult | null>(null);
  const [pickerLengthKey, setPickerLengthKey] = useState("standard");

  const WK_LENGTH_PRESETS: GameLengthPreset[] = useMemo(() => {
    const colorMap: Record<string, string> = {
      learn: "#ffffff",
      quick: primary,
      standard: danger,
      marathon: secondary,
    };
    return WK_LENGTH_PRESETS_BASE.map((p) => ({
      ...p,
      iconColor: colorMap[p.key] ?? "#ffffff",
    }));
  }, [primary, secondary, danger]);

  const {
    session,
    wkPhase,
    wkDefinitions,
    wkCurrentRound,
    wkTotalRounds,
    wkSubmissions,
    wkVotes,
    wkScores,
    wkWinners,
    wkWinnerPoints,
    wkSubmitDeadline,
    wkVoteDeadline,
    wkShuffledAuthors,
    wkPackCoverURL,
    isHost,
  } = state;

  const players = useMemo(() => session?.players ?? [], [session?.players]);
  const playerUids = players.map((p) => p.uid);
  const kicked = session?.kickedUids?.includes(userId) ?? false;
  const definition = getCurrentDefinition(wkDefinitions, wkCurrentRound);

  // Nudge the engine the instant a timed phase deadline passes (round intro /
  // submit / vote / results), so it advances without waiting for the sweep.
  const phaseDeadlineAt =
    ((session as unknown as Record<string, unknown>)?.["phaseDeadlineAt"] as number | undefined) ?? 0;
  useEngineDeadline(sessionId, phaseDeadlineAt);

  // ─── Derived values ────────────────────────────────────────

  const submissionCount = Object.keys(wkSubmissions).length;
  const expectedSubmissions = players.length;

  // Voters = all players who submitted (you can only vote if you submitted)
  const voterUids = Object.keys(wkSubmissions);
  const voteCount = Object.keys(wkVotes).length;
  const expectedVotes = voterUids.length; // everyone votes (can't vote for self, but still expected)

  const hasSubmitted = wkSubmissions[userId] != null;
  const hasVoted = wkVotes[userId] != null;

  // Build word list for voting (in shuffled author order)
  const votingWords = wkShuffledAuthors
    .filter((uid) => wkSubmissions[uid] != null)
    .map((uid) => ({ authorId: uid, word: wkSubmissions[uid]! }));

  // ─── Host: Pack + length chosen in the pack-select phase ──
  // (Lobby is invite/Start only; the host configures the game here, after Start,
  // using the same picker as Play Again — single source of pack/length choice.)

  const handlePackSelected = useCallback(
    async (pack: WordonkulousPack) => {
      // The SERVER does the shuffle-select + score init + the pack-select→round-intro
      // transition; the client only forwards the host's chosen pack + round count.
      const preset = WK_LENGTH_PRESETS.find((p) => p.key === pickerLengthKey);
      const rounds = preset?.rounds ?? 5;
      const result = await selectPack(
        sessionId,
        { id: pack.id, name: pack.name, coverURL: pack.coverImageURL || null, definitions: pack.definitions },
        rounds,
      );
      if (!result.ok) throw new Error(result.error);
    },
    [sessionId, pickerLengthKey, WK_LENGTH_PRESETS],
  );

  // ─── Round intro lifecycle ────────────────────────────────

  useEffect(() => {
    if (wkPhase === "round-intro") setShowRoundIntro(true);
  }, [wkPhase]);

  // ─── Player actions (via API; engine owns all phase transitions) ──

  const handleSubmitWord = useCallback(
    async (word: string) => {
      const result = await submitWord(sessionId, word);
      if (!result.ok) throw new Error(result.error);
    },
    [sessionId],
  );

  const handleVote = useCallback(
    async (authorId: string) => {
      const result = await submitVote(sessionId, authorId);
      if (!result.ok) throw new Error(result.error);
    },
    [sessionId],
  );

  // ─── Play Again ───────────────────────────────────────────

  const handlePlayAgain = useCallback(async () => {
    await updateFields({
      wkPhase: "pack-select",
      wkPackId: null,
      wkPackName: null,
      wkPackCoverURL: null,
      wkDefinitions: [],
      wkCurrentRound: 1,
      wkTotalRounds: 1,
      wkSubmissions: {},
      wkVotes: {},
      wkScores: {},
      wkWinners: [],
      wkWinnerPoints: 0,
      wkSubmitDeadline: 0,
      wkVoteDeadline: 0,
      wkShuffledAuthors: [],
      wkLobbyRounds: null,
    });
  }, [updateFields]);

  // ─── Delegate to composeGame result screen when available ──
  const gameEndFiredRef = useRef(false);
  useEffect(() => {
    if (wkPhase === "final" && wkWinners.length > 0 && onGameEnd && !gameEndFiredRef.current) {
      gameEndFiredRef.current = true;
      const players = session?.players ?? [];
      onGameEnd({
        winners: players.filter((p) => wkWinners.includes(p.uid)),
        winnerPoints: wkWinnerPoints,
        allPlayers: players,
        scores: wkScores,
      });

      // Gamification (was the host's advanceFromResults; engine now owns the
      // transition, so each client awards its own points; host records stats once).
      PointsManager.award(Activity.PLAY_GAME);
      if (isHost) PointsManager.award(Activity.HOST_GAME);
      if (wkWinners.includes(userId)) PointsManager.award(Activity.WIN_GAME);
      if (isHost) recordGameStats(playerUids, wkWinners, session?.ownerId ?? "");
    }
    if (wkPhase !== "final") {
      gameEndFiredRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires once on transition to final
  }, [wkPhase, wkWinners, wkWinnerPoints, wkScores, onGameEnd, session?.players, isHost, userId]);

  // ─── Non-host: store round result locally when phase changes to results ─

  useEffect(() => {
    if (wkPhase === "results" && !lastRoundResult) {
      // Recompute for non-host clients
      const result = scoreRound(wkVotes, wkSubmissions);
      setLastRoundResult(result);
    }
    if (wkPhase !== "results") {
      setLastRoundResult(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wkPhase]);

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

      {/* Pack + length: the host configures here (after Start); others wait. */}
      {wkPhase === "pack-select" && isHost && (
        <WordonkulousPackPicker
          onSelect={handlePackSelected}
          lengthPresets={WK_LENGTH_PRESETS}
          selectedLengthKey={pickerLengthKey}
          onLengthChange={(preset) => setPickerLengthKey(preset.key)}
        />
      )}
      {wkPhase === "pack-select" && !isHost && (
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-6 px-6">
          {gameLogoURL != null && gameLogoURL.length > 0 && (
            <div className="motion-reduce:animate-none animate-[float_3s_ease-in-out_infinite]">
              <Image
                src={gameLogoURL}
                alt=""
                width={400}
                height={200}
                className="h-36 w-auto max-w-[min(400px,85vw)] object-contain drop-shadow-lg select-none sm:h-48"
                priority={false}
              />
            </div>
          )}
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent drop-shadow-lg" />
          <p className="text-sm font-bold uppercase tracking-wider text-white drop-shadow-lg">
            Host is setting up the game&hellip;
          </p>
        </div>
      )}

      {/* Round intro overlay */}
      {showRoundIntro && (
        <RoundIntroScreen
          roundNumber={wkCurrentRound}
          onComplete={() => {}}
          onAnimationDone={() => setShowRoundIntro(false)}
        />
      )}

      {/* Submission phase */}
      {wkPhase === "submitting" && (
        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          <SubmitWordScreen
            definition={definition}
            roundNumber={wkCurrentRound}
            totalRounds={wkTotalRounds}
            deadline={wkSubmitDeadline}
            timerDurationMs={WK_SUBMIT_MS}
            hasSubmitted={hasSubmitted}
            submissionCount={submissionCount}
            totalPlayers={expectedSubmissions}
            onSubmit={handleSubmitWord}
          />
        </div>
      )}

      {/* Voting phase */}
      {wkPhase === "voting" && (
        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          <VotingScreen
            definition={definition}
            roundNumber={wkCurrentRound}
            totalRounds={wkTotalRounds}
            words={votingWords}
            currentUserId={userId}
            deadline={wkVoteDeadline}
            timerDurationMs={WK_VOTE_MS}
            hasVoted={hasVoted}
            voteCount={voteCount}
            totalVoters={expectedVotes}
            onVote={handleVote}
          />
        </div>
      )}

      {/* Results phase */}
      {wkPhase === "results" && lastRoundResult && (
        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          <RoundResultsScreen
            definition={definition}
            roundNumber={wkCurrentRound}
            totalRounds={wkTotalRounds}
            submissions={wkSubmissions}
            votes={wkVotes}
            players={players}
            roundDeltas={lastRoundResult.deltas}
            voteCounts={lastRoundResult.voteCounts}
            firstPlace={lastRoundResult.firstPlace}
            scores={wkScores}
          />
        </div>
      )}

      {/* Final winner screen — skipped when composeGame handles result via onGameEnd */}
      {wkPhase === "final" && wkWinners.length > 0 && !onGameEnd && (
        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          <JMConfettiOverlay loop />
          <WinnerScreen
            winners={players.filter((p) => wkWinners.includes(p.uid))}
            winnerPoints={wkWinnerPoints}
            allPlayers={players}
            scores={wkScores}
            isHost={isHost}
            onPlayAgain={handlePlayAgain}
          />
        </div>
      )}

      {/* HUD: gamertag + pack cover + logo */}
      <GameGamertagBadge />
      {(wkPhase === "pack-select" || wkPhase === "final") && (
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
      {wkPackCoverURL && wkPhase !== "pack-select" && wkPhase !== "final" && wkPhase !== "round-intro" && (
        <div className="pointer-events-none absolute left-3 top-2 z-20 animate-[wk-slide-in-tl_0.6s_ease-out_both]">
          <div
            className="h-25 w-25 rounded-xl bg-cover bg-center shadow-lg sm:h-30 sm:w-30"
            style={{ backgroundImage: `url(${wkPackCoverURL})` }}
          />
        </div>
      )}
      {gameLogoURL && wkPhase !== "pack-select" && wkPhase !== "round-intro" && (
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
