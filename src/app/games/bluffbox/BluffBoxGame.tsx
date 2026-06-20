"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/AuthProvider";
import { useBluffBoxSession } from "./useBluffBoxSession";
import { selectPack, submitSharerChoice, submitGuess } from "./bluffboxApi";
import { GameGamertagBadge, recordGameStats, useEngineDeadline, PhaseTimerBar } from "@/app/games/_gamecore";
import { PointsManager, Activity } from "@/lib/points";

import RoundIntroScreen from "./screens/RoundIntroScreen";
import MatchupScreen from "./screens/MatchupScreen";
import SharerViewScreen from "./screens/SharerViewScreen";
import GroupGuessModal from "./screens/GroupGuessModal";
import TurnResultModal from "./screens/TurnResultModal";
import WinnerScreen from "./screens/WinnerScreen";
import BluffPackPicker from "./BluffPackPicker";
import BluffPackGridPicker from "./BluffPackGridPicker";
import type { BluffBoxPack } from "@/lib/bluffbox-packs";
import { JMConfettiOverlay } from "@/JMKit";
import type { JMContent } from "@/lib/content-types";
import type { GameEndResult } from "@/app/games/_gamecore/registry/types";

// Timer durations for the progress bars — keep in sync with the bluffbox reducer.
const BB_SHARE_MS = 30_000;
const BB_GUESS_MS = 15_000;

interface BluffBoxGameProps {
  sessionId: string;
  splashBgURL?: string;
  gameLogoURL?: string;
  gameData?: JMContent;
  onGameEnd?: (result: GameEndResult) => void;
}

export default function BluffBoxGame({
  sessionId,
  splashBgURL,
  gameLogoURL,
  onGameEnd,
}: BluffBoxGameProps) {
  const { user, isAdmin } = useAuth();
  const userId = user?.uid ?? "";
  const { state } = useBluffBoxSession(sessionId, userId);
  const [resultDismissed, setResultDismissed] = useState(false);
  const [showRoundIntro, setShowRoundIntro] = useState(false);
  // The sharer's own pick is stored locally (the real answer lives server-side
  // in the secret doc and is revealed to everyone only at `result`).
  const [myChoice, setMyChoice] = useState<"truth" | "lie" | null>(null);

  const {
    session,
    bbPhase,
    selectedPackCoverURL,
    roundNumber,
    totalRounds,
    turnOrder,
    currentTurnIndex,
    cardURL,
    guesses,
    bbRevealChoice,
    scores,
    winners,
    winnerPoints,
    isHost,
  } = state;

  const players = useMemo(() => session?.players ?? [], [session?.players]);
  const playerUids = useMemo(() => players.map((p) => p.uid), [players]);

  const phaseDeadlineAt =
    ((session as unknown as Record<string, unknown>)?.["phaseDeadlineAt"] as number | undefined) ?? 0;
  useEngineDeadline(sessionId, phaseDeadlineAt);

  // ─── Derived ───────────────────────────────────────────────
  const currentSharer = turnOrder[currentTurnIndex] ?? "";
  const isSharer = currentSharer === userId;
  const sharerPlayer = players.find((p) => p.uid === currentSharer);
  const expectedGuessCount = players.filter((p) => p.uid !== currentSharer).length;
  const guessCount = Object.keys(guesses).length;
  const playerGuess = guesses[userId] ?? null;
  const hasGuessed = playerGuess != null;
  const fooledCount = bbRevealChoice
    ? players.filter((p) => p.uid !== currentSharer && guesses[p.uid] !== bbRevealChoice).length
    : 0;
  const sharerFooledEveryone = fooledCount > 0 && fooledCount === expectedGuessCount;

  // Reset the sharer's local choice + result dismissal when the turn changes.
  useEffect(() => {
    setMyChoice(null);
    setResultDismissed(false);
  }, [roundNumber, currentTurnIndex]);

  // Round-intro overlay; engine advances to `sharing` on its short deadline.
  useEffect(() => {
    if (bbPhase === "round-intro") setShowRoundIntro(true);
  }, [bbPhase]);

  // ─── Actions (all via the API; engine owns progression) ────
  const handlePackSelected = useCallback(
    async (pack: BluffBoxPack) => {
      const result = await selectPack(sessionId, {
        id: pack.id,
        name: pack.name,
        coverURL: pack.coverImageURL ?? null,
        cards: pack.cards,
      });
      if (!result.ok) throw new Error(result.error);
    },
    [sessionId],
  );

  const handleSharerChoice = useCallback(
    async (choice: "truth" | "lie") => {
      setMyChoice(choice);
      const result = await submitSharerChoice(sessionId, choice);
      if (!result.ok) setMyChoice(null); // let them retry
    },
    [sessionId],
  );

  const handleGuess = useCallback(
    async (guess: "truth" | "lie") => {
      const result = await submitGuess(sessionId, guess);
      if (!result.ok) throw new Error(result.error);
    },
    [sessionId],
  );

  // ─── Finish → composeGame result + gamification ────────────
  const gameEndFiredRef = useRef(false);
  useEffect(() => {
    if (bbPhase === "game-over" && winners.length > 0 && onGameEnd && !gameEndFiredRef.current) {
      gameEndFiredRef.current = true;
      onGameEnd({
        winners: players.filter((p) => winners.includes(p.uid)),
        winnerPoints,
        allPlayers: players,
        scores,
      });
      PointsManager.award(Activity.PLAY_GAME);
      if (isHost) PointsManager.award(Activity.HOST_GAME);
      if (winners.includes(userId)) PointsManager.award(Activity.WIN_GAME);
      if (isHost) recordGameStats(playerUids, winners, session?.ownerId ?? "");
    }
    if (bbPhase !== "game-over") gameEndFiredRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires once at game-over
  }, [bbPhase, winners, winnerPoints, players, scores, onGameEnd, isHost, userId]);

  // ─── Render ────────────────────────────────────────────────
  if (!session) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
      </div>
    );
  }

  const matchupScreenExtras = {
    ...(gameLogoURL ? { gameLogoURL } : {}),
    ...(splashBgURL ? { backgroundImageURL: splashBgURL } : {}),
  };
  const splashUnderlayExtras = splashBgURL ? { backgroundImageURL: splashBgURL } : {};
  const hasSplash = !!splashBgURL;
  const sharerViewPhases = (bbPhase === "sharing" || bbPhase === "guessing") && isSharer;
  const subtleSplashShell = hasSplash && (sharerViewPhases || bbPhase === "game-over");

  return (
    <div
      className="relative flex h-screen flex-col overflow-hidden bg-neutral-950"
      style={
        hasSplash && !subtleSplashShell
          ? {
              backgroundImage: `linear-gradient(rgba(0,0,0,0.8), rgba(0,0,0,0.9)), url(${splashBgURL})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : undefined
      }
    >
      {hasSplash && subtleSplashShell ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${splashBgURL})`, opacity: 0.3 }}
        />
      ) : null}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <GameGamertagBadge badgeClassName="bg-black" />

        {/* ── Pack Select (host picks AFTER Start; others wait) ── */}
        {bbPhase === "pack-select" && isHost && (
          isAdmin ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
              <h2 className="text-xl font-black uppercase tracking-wider text-amber-400">
                Choose a Bluff Pack
              </h2>
              <BluffPackPicker onSelect={handlePackSelected} onClose={() => {}} />
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pt-4 pb-10">
              <h2 className="text-center text-xl font-black uppercase tracking-wider text-amber-400">
                Choose a Bluff Pack
              </h2>
              <BluffPackGridPicker onSelect={handlePackSelected} />
            </div>
          )
        )}
        {bbPhase === "pack-select" && !isHost && (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
            {gameLogoURL ? (
              <div className="motion-reduce:animate-none animate-[float_3s_ease-in-out_infinite]">
                <Image
                  src={gameLogoURL}
                  alt=""
                  width={400}
                  height={200}
                  className="h-24 w-auto max-w-[min(320px,80vw)] object-contain select-none sm:h-32"
                />
              </div>
            ) : null}
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
            <p className="text-sm text-white/50">Host is setting up the game&hellip;</p>
          </div>
        )}

        {/* ── Round Intro overlay ── */}
        {showRoundIntro && (
          <RoundIntroScreen
            roundNumber={roundNumber}
            totalRounds={totalRounds}
            onComplete={() => {}}
            onAnimationDone={() => setShowRoundIntro(false)}
          />
        )}

        {/* ── Sharing ── */}
        {bbPhase === "sharing" && isSharer && (
          <>
            <SharerViewScreen
              key={`sharer-${roundNumber}-${currentTurnIndex}`}
              roundNumber={roundNumber}
              totalRounds={totalRounds}
              {...(gameLogoURL ? { gameLogoURL } : {})}
              cardURL={cardURL}
              packCoverURL={selectedPackCoverURL}
              onRevealBox={() => {}}
              onChoose={handleSharerChoice}
              sharerChoice={myChoice}
            />
            <div className="relative z-10 mx-auto w-full max-w-md px-6 pb-4">
              <PhaseTimerBar deadline={phaseDeadlineAt} durationMs={BB_SHARE_MS} />
            </div>
          </>
        )}
        {bbPhase === "sharing" && !isSharer && (
          <>
            <MatchupScreen
              roundNumber={roundNumber}
              totalRounds={totalRounds}
              players={players}
              scores={scores}
              currentSharer={currentSharer}
              turnOrder={turnOrder}
              currentTurnIndex={currentTurnIndex}
              {...matchupScreenExtras}
            />
            <div className="relative z-10 mx-auto w-full max-w-md px-6 pb-4">
              <p className="mb-2 text-center text-sm font-bold uppercase tracking-wider text-white/70">
                {sharerPlayer?.gamertag ?? "Someone"} is deciding&hellip;
              </p>
              <PhaseTimerBar deadline={phaseDeadlineAt} durationMs={BB_SHARE_MS} />
            </div>
          </>
        )}

        {/* ── Guessing ── */}
        {bbPhase === "guessing" && isSharer && (
          <>
            <SharerViewScreen
              key={`sharer-voting-${roundNumber}-${currentTurnIndex}`}
              roundNumber={roundNumber}
              totalRounds={totalRounds}
              {...(gameLogoURL ? { gameLogoURL } : {})}
              cardURL={cardURL}
              packCoverURL={selectedPackCoverURL}
              onRevealBox={() => {}}
              onChoose={handleSharerChoice}
              sharerChoice={myChoice}
              waitingForVotes
            />
            <div className="relative z-10 mx-auto w-full max-w-md px-6 pb-4">
              <PhaseTimerBar deadline={phaseDeadlineAt} durationMs={BB_GUESS_MS} />
            </div>
          </>
        )}
        {bbPhase === "guessing" && !isSharer && (
          <>
            <MatchupScreen
              roundNumber={roundNumber}
              totalRounds={totalRounds}
              players={players}
              scores={scores}
              currentSharer={currentSharer}
              turnOrder={turnOrder}
              currentTurnIndex={currentTurnIndex}
              {...matchupScreenExtras}
            />
            <GroupGuessModal
              {...splashUnderlayExtras}
              sharerName={sharerPlayer?.gamertag ?? "Player"}
              onGuess={handleGuess}
              hasGuessed={hasGuessed}
              guessCount={guessCount}
              totalGuessers={expectedGuessCount}
            />
            <div className="relative z-10 mx-auto w-full max-w-md px-6 pb-4">
              <PhaseTimerBar deadline={phaseDeadlineAt} durationMs={BB_GUESS_MS} />
            </div>
          </>
        )}

        {/* ── Result (auto-advances; engine drives) ── */}
        {bbPhase === "result" && (
          <>
            <MatchupScreen
              roundNumber={roundNumber}
              totalRounds={totalRounds}
              players={players}
              scores={scores}
              currentSharer={currentSharer}
              turnOrder={turnOrder}
              currentTurnIndex={currentTurnIndex}
              {...matchupScreenExtras}
            />
            {!resultDismissed && bbRevealChoice && cardURL && (
              <TurnResultModal
                {...splashUnderlayExtras}
                sharerName={sharerPlayer?.gamertag ?? "Player"}
                sharerAvatarName={sharerPlayer?.avatarName}
                sharerChoice={bbRevealChoice}
                cardURL={cardURL}
                playerGuess={isSharer ? null : playerGuess}
                sharerFooledCount={fooledCount}
                sharerEarnedFoolBonus={sharerFooledEveryone}
                onDismiss={() => setResultDismissed(true)}
              />
            )}
          </>
        )}

        {/* ── Game Over (skipped when composeGame handles the result) ── */}
        {bbPhase === "game-over" && winners.length > 0 && !onGameEnd && (
          <>
            <JMConfettiOverlay loop />
            <WinnerScreen
              winners={players.filter((p) => winners.includes(p.uid))}
              winnerPoints={winnerPoints}
              allPlayers={players}
              scores={scores}
              isHost={isHost}
              onPlayAgain={() => {}}
            />
          </>
        )}
      </div>
    </div>
  );
}
