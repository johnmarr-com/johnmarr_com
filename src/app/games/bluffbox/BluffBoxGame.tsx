"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/AuthProvider";
import { useBluffBoxSession } from "./useBluffBoxSession";
import {
  calculateTotalRounds,
  initScores,
  shuffleTurnOrder,
  selectCard,
  shuffleCards,
  scoreTurn,
  applyScoreDeltas,
  determineWinners,
} from "./tournament";
import { isAiPlayer, getPersona } from "@/app/games/_gamecore";
import { aiShare, aiGuess } from "./aiBluffPlayer";
import { GameGamertagBadge } from "@/app/games/_gamecore";
import { PointsManager, Activity } from "@/lib/points";
import { recordGameStats } from "./recordGameStats";

import RoundIntroScreen from "./screens/RoundIntroScreen";
import MatchupScreen from "./screens/MatchupScreen";
import SharerViewScreen from "./screens/SharerViewScreen";
import AIShareDisplay from "./screens/AIShareDisplay";
import HumanToAIInput from "./screens/HumanToAIInput";
import GroupGuessModal from "./screens/GroupGuessModal";
import TurnResultModal from "./screens/TurnResultModal";
import WinnerScreen from "./screens/WinnerScreen";
import BluffPackPicker from "./BluffPackPicker";
import type { BluffBoxPack } from "@/lib/bluffbox-packs";
import { JMConfettiOverlay } from "@/JMKit";

/** Host auto-advance from `result` phase (ms). 2× the original 4s; host tap runs `advanceFromResult` for everyone. */
const RESULT_PHASE_AUTO_ADVANCE_MS = 8000;

interface BluffBoxGameProps {
  sessionId: string;
  splashBgURL?: string;
  /** Shown above the left player on the matchup / VS screen */
  gameLogoURL?: string;
}

export default function BluffBoxGame({
  sessionId,
  splashBgURL,
  gameLogoURL,
}: BluffBoxGameProps) {
  const { user } = useAuth();
  const userId = user?.uid ?? "";
  const { state, updateFields, setPhase } = useBluffBoxSession(
    sessionId,
    userId,
  );
  const aiProcessingRef = useRef(false);
  const [resultDismissed, setResultDismissed] = useState(false);

  const {
    session,
    bbPhase,
    selectedPackId,
    selectedPackCoverURL,
    cardPool,
    roundNumber,
    totalRounds,
    turnOrder,
    currentTurnIndex,
    cardURL,
    sharerChoice,
    guesses,
    aiShareText,
    humanShareText,
    scores,
    winners,
    winnerPoints,
    isHost,
  } = state;

  const players = session?.players ?? [];
  const playerUids = players.map((p) => p.uid);

  // ─── Derived values ────────────────────────────────────────

  const currentSharer = turnOrder[currentTurnIndex] ?? "";
  const isSharer = currentSharer === userId;
  const sharerPlayer = players.find((p) => p.uid === currentSharer);
  const hasAiGuessers = players.some(
    (p) => p.uid !== currentSharer && isAiPlayer(p.uid),
  );
  const expectedGuessCount = players.filter(
    (p) => p.uid !== currentSharer,
  ).length;
  const guessCount = Object.keys(guesses).length;
  const allGuessesIn =
    guessCount >= expectedGuessCount && expectedGuessCount > 0;
  /** 3+ players and every guesser missed → sharer earned +1 (matches `scoreTurn`). */
  const sharerFooledEveryone =
    sharerChoice != null &&
    playerUids.length >= 3 &&
    players
      .filter((p) => p.uid !== currentSharer)
      .every((p) => guesses[p.uid] !== sharerChoice);
  const playerGuess = guesses[userId] ?? null;
  const hasGuessed = playerGuess != null;

  // ─── Host: Pack Selected ───────────────────────────────────

  const handlePackSelected = useCallback(
    async (pack: BluffBoxPack) => {
      const shuffled = shuffleCards(pack.cards);
      const total = calculateTotalRounds(playerUids.length);
      const order = shuffleTurnOrder(playerUids);
      const initScoresMap = initScores(playerUids);
      const { deleteField } = await import("firebase/firestore");
      await updateFields({
        selectedPackId: pack.id,
        selectedPackName: pack.name,
        selectedPackCoverURL: pack.coverImageURL,
        cardPool: shuffled,
        roundNumber: 1,
        totalRounds: total,
        turnOrder: order,
        currentTurnIndex: 0,
        cardURL: null,
        sharerChoice: null,
        guesses: {},
        aiShareText: null,
        humanShareText: null,
        scores: initScoresMap,
        winners: [],
        winnerPoints: 0,
        bbPhase: "round-intro",
        bluffLobbyPackId: deleteField(),
        bluffLobbyPackName: deleteField(),
        bluffLobbyPackCoverURL: deleteField(),
      });
    },
    [playerUids, updateFields],
  );

  const [lobbyAutoApplyFailed, setLobbyAutoApplyFailed] = useState(false);

  const lobbyPackIdRaw = session
    ? (session as unknown as Record<string, unknown>)["bluffLobbyPackId"]
    : undefined;
  const lobbyPackId =
    typeof lobbyPackIdRaw === "string" && lobbyPackIdRaw
      ? lobbyPackIdRaw
      : null;

  useEffect(() => {
    if (bbPhase !== "pack-select") {
      setLobbyAutoApplyFailed(false);
      return;
    }
    if (!lobbyPackId) {
      setLobbyAutoApplyFailed(false);
      return;
    }
    if (!isHost || lobbyAutoApplyFailed) return;

    let cancelled = false;
    (async () => {
      const { getPack } = await import("@/lib/bluffbox-packs");
      const pack = await getPack(lobbyPackId);
      if (cancelled) return;
      if (!pack?.cards.length) {
        setLobbyAutoApplyFailed(true);
        return;
      }
      await handlePackSelected(pack);
    })().catch(() => {
      if (!cancelled) setLobbyAutoApplyFailed(true);
    });

    return () => {
      cancelled = true;
    };
  }, [isHost, bbPhase, lobbyPackId, lobbyAutoApplyFailed, handlePackSelected]);

  // ─── Deal card (human sharer taps; AI sharer auto-dealt by host) ─

  const handleRevealBox = useCallback(async () => {
    if (!isHost && currentSharer !== userId) return;
    let pool = cardPool;
    if (pool.length === 0) {
      const { getPack } = await import("@/lib/bluffbox-packs");
      const pack = await getPack(selectedPackId!);
      pool = shuffleCards(pack?.cards ?? []);
    }
    const { card, remainingPool } = selectCard(pool);
    await updateFields({
      cardURL: card,
      cardPool: remainingPool,
    });
  }, [cardPool, currentSharer, userId, isHost, selectedPackId, updateFields]);

  // ─── Host: Auto-deal for AI sharer ────────────────────────

  const aiSharerAutoDealRef = useRef(false);

  useEffect(() => {
    if (bbPhase !== "sharing") {
      aiSharerAutoDealRef.current = false;
      return;
    }
    if (cardURL) return;
    if (!isHost || !isAiPlayer(currentSharer)) return;
    if (cardPool.length === 0) return;
    if (aiSharerAutoDealRef.current) return;
    aiSharerAutoDealRef.current = true;
    void handleRevealBox();
  }, [bbPhase, cardURL, currentSharer, cardPool.length, isHost, handleRevealBox]);

  // ─── Sharer: Choose Truth/Lie ──────────────────────────────

  const handleSharerChoice = useCallback(
    async (choice: "truth" | "lie") => {
      await updateFields({ sharerChoice: choice });

      if (!isAiPlayer(currentSharer) && hasAiGuessers) {
        await setPhase("human-to-ai-input");
      } else {
        await setPhase("guessing");
      }
    },
    [currentSharer, hasAiGuessers, updateFields, setPhase],
  );

  // ─── Host: AI Sharer Logic ────────────────────────────────

  useEffect(() => {
    if (!isHost || bbPhase !== "sharing" || !cardURL || aiProcessingRef.current)
      return;
    if (!isAiPlayer(currentSharer)) return;

    aiProcessingRef.current = true;
    (async () => {
      try {
        const persona = getPersona(currentSharer);
        const result = await aiShare(cardURL, {
          prompt: persona?.prompt ?? "",
          voice: persona?.voice ?? "",
        });
        await updateFields({
          sharerChoice: result.choice,
          aiShareText: result.shareText,
          bbPhase: "ai-share-display",
        });
      } finally {
        aiProcessingRef.current = false;
      }
    })();
  }, [isHost, bbPhase, cardURL, currentSharer, updateFields]);

  // ─── Human: Submit share text for AI guessers ─────────────

  const handleHumanShareText = useCallback(
    async (text: string) => {
      await updateFields({
        humanShareText: text,
        bbPhase: "guessing",
      });
    },
    [updateFields],
  );

  // ─── Any player: Submit guess ─────────────────────────────

  const handleGuess = useCallback(
    async (guess: "truth" | "lie") => {
      await updateFields({ [`guesses.${userId}`]: guess });
    },
    [userId, updateFields],
  );

  // ─── Host: AI Guesser Logic ───────────────────────────────

  useEffect(() => {
    if (!isHost || bbPhase !== "guessing" || aiProcessingRef.current) return;

    const aiGuessers = players.filter(
      (p) => p.uid !== currentSharer && isAiPlayer(p.uid) && !guesses[p.uid],
    );
    if (aiGuessers.length === 0) return;

    const shareText =
      humanShareText || aiShareText || "something mysterious";

    aiProcessingRef.current = true;
    (async () => {
      try {
        for (const ai of aiGuessers) {
          const persona = getPersona(ai.uid);
          const guess = await aiGuess(shareText, {
            prompt: persona?.prompt ?? "",
            voice: persona?.voice ?? "",
          });
          await updateFields({ [`guesses.${ai.uid}`]: guess });
        }
      } finally {
        aiProcessingRef.current = false;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, bbPhase, currentSharer, guesses, players]);

  // ─── Host: All guesses in → calculate scores + enter result ─

  useEffect(() => {
    if (!isHost || bbPhase !== "guessing") return;
    if (!allGuessesIn || !sharerChoice) return;

    // Calculate and write scores BEFORE entering result phase
    const deltas = scoreTurn(
      sharerChoice,
      guesses,
      currentSharer,
      playerUids.length,
    );
    const newScores = applyScoreDeltas(scores, deltas);

    void updateFields({
      scores: newScores,
      bbPhase: "result",
    });
  }, [
    isHost,
    bbPhase,
    allGuessesIn,
    sharerChoice,
    guesses,
    currentSharer,
    playerUids.length,
    scores,
    updateFields,
  ]);

  // ─── Reset resultDismissed when phase changes ─────────────

  useEffect(() => {
    if (bbPhase !== "result") {
      setResultDismissed(false);
    }
  }, [bbPhase]);

  // ─── Host: Advance from result ────────────────────────────

  const advanceFromResult = useCallback(async () => {
    if (!isHost) return;

    const nextTurnIndex = currentTurnIndex + 1;

    if (nextTurnIndex < turnOrder.length) {
      // More turns in this round
      await updateFields({
        currentTurnIndex: nextTurnIndex,
        cardURL: null,
        sharerChoice: null,
        guesses: {},
        aiShareText: null,
        humanShareText: null,
        bbPhase: "sharing",
      });
      return;
    }

    if (roundNumber < totalRounds) {
      // More rounds to play
      const newOrder = shuffleTurnOrder(playerUids);
      await updateFields({
        roundNumber: roundNumber + 1,
        turnOrder: newOrder,
        currentTurnIndex: 0,
        cardURL: null,
        sharerChoice: null,
        guesses: {},
        aiShareText: null,
        humanShareText: null,
        bbPhase: "round-intro",
      });
      return;
    }

    // Game over — determine winners
    const { winners: w, points: p } = determineWinners(scores);
    await updateFields({
      winners: w,
      winnerPoints: p,
      bbPhase: "game-over",
    });
    PointsManager.award(Activity.PLAY_GAME);
    recordGameStats(playerUids, w, session?.ownerId ?? "");
  }, [
    isHost,
    currentTurnIndex,
    turnOrder.length,
    roundNumber,
    totalRounds,
    playerUids,
    scores,
    session?.ownerId,
    updateFields,
  ]);

  // ─── Host: Auto-advance from result after delay ───────────

  useEffect(() => {
    if (!isHost || bbPhase !== "result") return;
    const timer = setTimeout(() => {
      void advanceFromResult();
    }, RESULT_PHASE_AUTO_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [isHost, bbPhase, advanceFromResult]);

  // ─── Play Again ────────────────────────────────────────────

  const handlePlayAgain = useCallback(async () => {
    await updateFields({
      bbPhase: "pack-select",
      cardURL: null,
      sharerChoice: null,
      guesses: {},
      aiShareText: null,
      humanShareText: null,
      winners: [],
      winnerPoints: 0,
      turnOrder: [],
      currentTurnIndex: 0,
      scores: {},
    });
  }, [updateFields]);

  // ─── Start first turn from round-intro ────────────────────

  const startFirstTurn = useCallback(async () => {
    if (!isHost) return;
    await updateFields({
      cardURL: null,
      sharerChoice: null,
      guesses: {},
      aiShareText: null,
      humanShareText: null,
      bbPhase: "sharing",
    });
  }, [isHost, updateFields]);

  // ─── Render ────────────────────────────────────────────────

  if (!session) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
      </div>
    );
  }

  const hostPackSelectSpinner =
    bbPhase === "pack-select" &&
    isHost &&
    !!lobbyPackId &&
    !lobbyAutoApplyFailed;

  const matchupScreenExtras = {
    ...(gameLogoURL != null && gameLogoURL.length > 0 ? { gameLogoURL } : {}),
    ...(splashBgURL != null && splashBgURL.length > 0
      ? { backgroundImageURL: splashBgURL }
      : {}),
  };

  const splashUnderlayExtras =
    splashBgURL != null && splashBgURL.length > 0
      ? { backgroundImageURL: splashBgURL }
      : {};

  const hasSplash = splashBgURL != null && splashBgURL.length > 0;
  const sharerViewPhases =
    (bbPhase === "sharing" || bbPhase === "guessing") && isSharer && !isAiPlayer(userId);
  const humanToAiPhase = bbPhase === "human-to-ai-input" && isSharer;
  /** Same 30% splash layer as sharer flow — avoids the heavy root gradient that hides art (e.g. game-over). */
  const subtleSplashShell =
    hasSplash &&
    (sharerViewPhases || humanToAiPhase || bbPhase === "game-over");

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
          style={{
            backgroundImage: `url(${splashBgURL})`,
            opacity: 0.3,
          }}
        />
      ) : null}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <GameGamertagBadge badgeClassName="bg-indigo-950/90 backdrop-blur-sm" />

        {/* ── Pack Select ── */}
        {bbPhase === "pack-select" &&
          isHost &&
          (hostPackSelectSpinner ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
              <p className="text-sm text-white/60">
                Starting game&hellip;
              </p>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
              <h2 className="text-xl font-black uppercase tracking-wider text-amber-400">
                Choose a Bluff Pack
              </h2>
              <BluffPackPicker
                onSelect={handlePackSelected}
                onClose={() => {}}
              />
            </div>
          ))}
        {bbPhase === "pack-select" && !isHost && (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
            {gameLogoURL != null && gameLogoURL.length > 0 ? (
              <div className="motion-reduce:animate-none animate-bounce">
                <Image
                  src={gameLogoURL}
                  alt=""
                  width={280}
                  height={140}
                  className="h-16 w-auto max-w-[min(240px,70vw)] object-contain select-none sm:h-20"
                  priority={false}
                />
              </div>
            ) : null}
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
            <p className="text-sm text-white/50">
              Hold on to your seats&hellip;
            </p>
          </div>
        )}

        {/* ── Round Intro ── */}
        {bbPhase === "round-intro" && (
          <RoundIntroScreen
            roundNumber={roundNumber}
            totalRounds={totalRounds}
            onComplete={() => {
              if (isHost) startFirstTurn();
            }}
          />
        )}

        {/* ── Sharing ── */}
        {bbPhase === "sharing" && isSharer && !isAiPlayer(userId) && (
          <SharerViewScreen
            key={`sharer-${roundNumber}-${currentTurnIndex}`}
            roundNumber={roundNumber}
            totalRounds={totalRounds}
            {...(gameLogoURL != null && gameLogoURL.length > 0
              ? { gameLogoURL }
              : {})}
            cardURL={cardURL}
            packCoverURL={selectedPackCoverURL}
            onRevealBox={handleRevealBox}
            onChoose={handleSharerChoice}
            sharerChoice={sharerChoice}
          />
        )}
        {bbPhase === "sharing" && (!isSharer || isAiPlayer(userId)) && (
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
        )}

        {/* ── AI Share Display ── */}
        {bbPhase === "ai-share-display" && aiShareText && (
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
            <AIShareDisplay
              {...splashUnderlayExtras}
              aiName={sharerPlayer?.gamertag ?? "AI"}
              aiAvatarName={sharerPlayer?.avatarName}
              shareText={aiShareText}
              onDismiss={() => {
                if (isHost) setPhase("guessing");
              }}
            />
          </>
        )}

        {/* ── Human to AI Input ── */}
        {bbPhase === "human-to-ai-input" && isSharer && (
          <HumanToAIInput
            aiName="the group"
            onSubmit={handleHumanShareText}
          />
        )}
        {bbPhase === "human-to-ai-input" && !isSharer && (
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
        )}

        {/* ── Guessing ── */}
        {bbPhase === "guessing" && isSharer && !isAiPlayer(userId) && (
          <SharerViewScreen
            key={`sharer-voting-${roundNumber}-${currentTurnIndex}`}
            roundNumber={roundNumber}
            totalRounds={totalRounds}
            {...(gameLogoURL != null && gameLogoURL.length > 0
              ? { gameLogoURL }
              : {})}
            cardURL={cardURL}
            packCoverURL={selectedPackCoverURL}
            onRevealBox={handleRevealBox}
            onChoose={handleSharerChoice}
            sharerChoice={sharerChoice}
            waitingForVotes
          />
        )}
        {bbPhase === "guessing" && (!isSharer || isAiPlayer(userId)) && (
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
            {!isSharer && !isAiPlayer(userId) && (
              <GroupGuessModal
                {...splashUnderlayExtras}
                sharerName={sharerPlayer?.gamertag ?? "Player"}
                onGuess={handleGuess}
                hasGuessed={hasGuessed}
                guessCount={guessCount}
                totalGuessers={expectedGuessCount}
              />
            )}
          </>
        )}

        {/* ── Result ── */}
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
            {!resultDismissed && sharerChoice && cardURL && (
              <TurnResultModal
                {...splashUnderlayExtras}
                sharerName={sharerPlayer?.gamertag ?? "Player"}
                sharerAvatarName={sharerPlayer?.avatarName}
                sharerChoice={sharerChoice}
                cardURL={cardURL}
                playerGuess={isSharer ? null : playerGuess}
                sharerEarnedFoolBonus={sharerFooledEveryone}
                onDismiss={() => {
                  if (isHost) {
                    void advanceFromResult();
                  } else {
                    setResultDismissed(true);
                  }
                }}
              />
            )}
          </>
        )}

        {/* ── Game Over — confetti portals to `document.body` at z-index 99999 (above z-50 modals) */}
        {bbPhase === "game-over" && winners.length > 0 && (
          <>
            <JMConfettiOverlay loop />
            <WinnerScreen
              winners={players.filter((p) => winners.includes(p.uid))}
              winnerPoints={winnerPoints}
              isHost={isHost}
              onPlayAgain={handlePlayAgain}
            />
          </>
        )}
      </div>
    </div>
  );
}
