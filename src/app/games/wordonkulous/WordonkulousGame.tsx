"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useAuth } from "@/lib/AuthProvider";
import { useWordonkulousSession } from "./useWordonkulousSession";
import {
  initScores,
  selectDefinitions,
  shuffleArray,
  getCurrentDefinition,
  scoreRound,
  applyScoreDeltas,
  determineWinners,
} from "./wordonkulousTypes";
import type { RoundScoreResult } from "./wordonkulousTypes";
import { isAiPlayer, getPersona, recordGameStats, GameGamertagBadge, useGameColors } from "@/app/games/_gamecore";
import { aiSubmitWord, aiVote } from "./aiWordonkulousPlayer";
import { submitWord, submitVote } from "./wordonkulousApi";
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

const SUBMIT_TIMER_MS = 0; // timers disabled for dev
const VOTE_TIMER_MS = 0;   // timers disabled for dev

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
  const aiProcessingRef = useRef(false);
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
    wkLobbyPackId,
    wkLobbyRounds,
    isHost,
  } = state;

  const players = useMemo(() => session?.players ?? [], [session?.players]);
  const playerUids = players.map((p) => p.uid);
  const kicked = session?.kickedUids?.includes(userId) ?? false;
  const definition = getCurrentDefinition(wkDefinitions, wkCurrentRound);

  // ─── Derived values ────────────────────────────────────────

  const submissionCount = Object.keys(wkSubmissions).length;
  const expectedSubmissions = players.length;
  const allSubmissionsIn = submissionCount >= expectedSubmissions && expectedSubmissions > 0;

  // Voters = all players who submitted (you can only vote if you submitted)
  const voterUids = Object.keys(wkSubmissions);
  const voteCount = Object.keys(wkVotes).length;
  const expectedVotes = voterUids.length; // everyone votes (can't vote for self, but still expected)
  const allVotesIn = voteCount >= expectedVotes && expectedVotes > 0;

  const hasSubmitted = wkSubmissions[userId] != null;
  const hasVoted = wkVotes[userId] != null;

  // Build word list for voting (in shuffled author order)
  const votingWords = wkShuffledAuthors
    .filter((uid) => wkSubmissions[uid] != null)
    .map((uid) => ({ authorId: uid, word: wkSubmissions[uid]! }));

  // Sync pickerLengthKey from lobby rounds (first game from lobby)
  useEffect(() => {
    if (wkLobbyRounds != null) {
      const match = WK_LENGTH_PRESETS.find((p) => p.rounds === wkLobbyRounds);
      if (match) setPickerLengthKey(match.key);
    }
  }, [wkLobbyRounds, WK_LENGTH_PRESETS]);

  // ─── Host: Auto-apply lobby pack ──────────────────────────

  const [lobbyAutoApplyFailed, setLobbyAutoApplyFailed] = useState(false);

  useEffect(() => {
    if (wkPhase !== "pack-select") {
      setLobbyAutoApplyFailed(false);
      return;
    }
    if (!wkLobbyPackId || !isHost || lobbyAutoApplyFailed) return;

    let cancelled = false;
    (async () => {
      const { getPack } = await import("@/lib/wordonkulous-packs");
      const pack = await getPack(wkLobbyPackId);
      if (cancelled) return;
      if (!pack?.definitions.length) {
        setLobbyAutoApplyFailed(true);
        return;
      }
      await handlePackSelected(pack);
    })().catch(() => {
      if (!cancelled) setLobbyAutoApplyFailed(true);
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, wkPhase, wkLobbyPackId, lobbyAutoApplyFailed]);

  // ─── Host: Pack selected ──────────────────────────────────

  const handlePackSelected = useCallback(
    async (pack: WordonkulousPack) => {
      // Resolve rounds from lobby field (first game) or local picker state (play again)
      const preset = WK_LENGTH_PRESETS.find((p) => p.key === pickerLengthKey);
      const lobbyOrPresetRounds = wkLobbyRounds ?? preset?.rounds ?? 5;
      const count = Math.min(lobbyOrPresetRounds, pack.definitions.length);
      const defs = selectDefinitions(pack.definitions, count);
      const scores = initScores(playerUids);
      const { deleteField } = await import("firebase/firestore");
      await updateFields({
        wkPackId: pack.id,
        wkPackName: pack.name,
        wkPackCoverURL: pack.coverImageURL || null,
        wkDefinitions: defs,
        wkCurrentRound: 1,
        wkTotalRounds: count,
        wkSubmissions: {},
        wkVotes: {},
        wkScores: scores,
        wkWinners: [],
        wkWinnerPoints: 0,
        wkSubmitDeadline: 0,
        wkVoteDeadline: 0,
        wkShuffledAuthors: [],
        wkPhase: "round-intro",
        wkLobbyPackId: deleteField(),
        wkLobbyPackName: deleteField(),
        wkLobbyPackCoverURL: deleteField(),
        wkLobbyRounds: deleteField(),
      });
    },
    [playerUids, wkLobbyRounds, pickerLengthKey, updateFields, WK_LENGTH_PRESETS],
  );

  // ─── Round intro lifecycle ────────────────────────────────

  useEffect(() => {
    if (wkPhase === "round-intro") setShowRoundIntro(true);
  }, [wkPhase]);

  const handleRoundIntroComplete = useCallback(async () => {
    if (!isHost) return;
    await updateFields({
      wkSubmissions: {},
      wkVotes: {},
      wkShuffledAuthors: [],
      wkSubmitDeadline: SUBMIT_TIMER_MS > 0 ? Date.now() + SUBMIT_TIMER_MS : 0,
      wkPhase: "submitting",
    });
  }, [isHost, updateFields]);

  // ─── Player: Submit word (via API) ────────────────────────

  const handleSubmitWord = useCallback(
    async (word: string) => {
      const result = await submitWord(sessionId, word);
      if (!result.ok) throw new Error(result.error);
    },
    [sessionId],
  );

  // ─── Host: AI submit words ────────────────────────────────

  useEffect(() => {
    if (!isHost || wkPhase !== "submitting" || aiProcessingRef.current) return;

    const aiPlayers = players.filter(
      (p) => isAiPlayer(p.uid) && wkSubmissions[p.uid] == null,
    );
    if (aiPlayers.length === 0) return;

    aiProcessingRef.current = true;
    (async () => {
      try {
        for (const ai of aiPlayers) {
          const persona = getPersona(ai.uid);
          const word = await aiSubmitWord(definition, {
            prompt: persona?.prompt ?? "",
            voice: persona?.voice ?? "",
          });
          await updateFields({ [`wkSubmissions.${ai.uid}`]: word });
        }
      } finally {
        aiProcessingRef.current = false;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, wkPhase, definition, players, wkSubmissions]);

  // ─── Host: All submissions in or timer → move to voting ───

  useEffect(() => {
    if (!isHost || wkPhase !== "submitting") return;

    if (allSubmissionsIn) {
      void advanceToVoting();
      return;
    }

    // Timer fallback
    if (wkSubmitDeadline <= 0) return;
    const ms = Math.max(0, wkSubmitDeadline - Date.now());
    const timer = setTimeout(() => { void advanceToVoting(); }, ms);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, wkPhase, allSubmissionsIn, wkSubmitDeadline]);

  const advanceToVoting = useCallback(async () => {
    if (!isHost) return;
    // Randomise the display order of submitted words
    const submittedUids = Object.keys(wkSubmissions);
    console.log(
      `[Wordonkulous] advanceToVoting: ${submittedUids.length} submissions from ${players.length} players. ` +
      `submitters=[${submittedUids.join(",")}] players=[${players.map((p) => p.uid).join(",")}]`,
    );
    const shuffled = shuffleArray(submittedUids);
    await updateFields({
      wkShuffledAuthors: shuffled,
      wkVoteDeadline: VOTE_TIMER_MS > 0 ? Date.now() + VOTE_TIMER_MS : 0,
      wkPhase: "voting",
    });
  }, [isHost, wkSubmissions, players, updateFields]);

  // ─── Player: Submit vote (via API) ────────────────────────

  const handleVote = useCallback(
    async (authorId: string) => {
      const result = await submitVote(sessionId, authorId);
      if (!result.ok) throw new Error(result.error);
    },
    [sessionId],
  );

  // ─── Host: AI vote ────────────────────────────────────────

  useEffect(() => {
    if (!isHost || wkPhase !== "voting" || aiProcessingRef.current) return;

    const aiVoters = players.filter(
      (p) => isAiPlayer(p.uid) && wkSubmissions[p.uid] != null && wkVotes[p.uid] == null,
    );
    if (aiVoters.length === 0) return;

    const words = wkShuffledAuthors
      .filter((uid) => wkSubmissions[uid] != null)
      .map((uid) => ({ authorId: uid, word: wkSubmissions[uid]! }));

    aiProcessingRef.current = true;
    (async () => {
      try {
        for (const ai of aiVoters) {
          const persona = getPersona(ai.uid);
          const votedFor = await aiVote(definition, words, ai.uid, {
            prompt: persona?.prompt ?? "",
            voice: persona?.voice ?? "",
          });
          await updateFields({ [`wkVotes.${ai.uid}`]: votedFor });
        }
      } finally {
        aiProcessingRef.current = false;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, wkPhase, definition, players, wkSubmissions, wkVotes, wkShuffledAuthors]);

  // ─── Host: All votes in or timer → score round ────────────

  useEffect(() => {
    if (!isHost || wkPhase !== "voting") return;

    if (allVotesIn) {
      void advanceToResults();
      return;
    }

    if (wkVoteDeadline <= 0) return;
    const ms = Math.max(0, wkVoteDeadline - Date.now());
    const timer = setTimeout(() => { void advanceToResults(); }, ms);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, wkPhase, allVotesIn, wkVoteDeadline]);

  const advanceToResults = useCallback(async () => {
    if (!isHost) return;
    const result = scoreRound(wkVotes, wkSubmissions);
    const newScores = applyScoreDeltas(wkScores, result.deltas);
    setLastRoundResult(result);
    await updateFields({
      wkScores: newScores,
      wkPhase: "results",
    });
  }, [isHost, wkVotes, wkSubmissions, wkScores, updateFields]);

  // ─── Host: Continue from results ──────────────────────────

  const advanceFromResults = useCallback(async () => {
    if (!isHost) return;

    if (wkCurrentRound < wkTotalRounds) {
      await updateFields({
        wkCurrentRound: wkCurrentRound + 1,
        wkSubmissions: {},
        wkVotes: {},
        wkShuffledAuthors: [],
        wkSubmitDeadline: 0,
        wkVoteDeadline: 0,
        wkPhase: "round-intro",
      });
      setLastRoundResult(null);
      return;
    }

    // Game over
    const { winners, points } = determineWinners(wkScores);
    await updateFields({
      wkWinners: winners,
      wkWinnerPoints: points,
      wkPhase: "final",
    });
    PointsManager.award(Activity.PLAY_GAME);
    if (isHost) PointsManager.award(Activity.HOST_GAME);
    if (winners.includes(userId)) PointsManager.award(Activity.WIN_GAME);
    recordGameStats(playerUids, winners, session?.ownerId ?? "");
  }, [
    isHost,
    userId,
    wkCurrentRound,
    wkTotalRounds,
    wkScores,
    playerUids,
    session?.ownerId,
    updateFields,
  ]);

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
    }
    if (wkPhase !== "final") {
      gameEndFiredRef.current = false;
    }
  }, [wkPhase, wkWinners, wkWinnerPoints, wkScores, onGameEnd, session?.players]);

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

      {/* Pack select (host picks, others wait) */}
      {wkPhase === "pack-select" && isHost && (lobbyAutoApplyFailed || !wkLobbyPackId) && (
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
            Host is selecting a pack&hellip;
          </p>
        </div>
      )}
      {wkPhase === "pack-select" && isHost && !lobbyAutoApplyFailed && wkLobbyPackId && (
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
            Loading pack&hellip;
          </p>
        </div>
      )}

      {/* Round intro overlay */}
      {showRoundIntro && (
        <RoundIntroScreen
          roundNumber={wkCurrentRound}
          onComplete={handleRoundIntroComplete}
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
            isHost={isHost}
            onContinue={advanceFromResults}
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
