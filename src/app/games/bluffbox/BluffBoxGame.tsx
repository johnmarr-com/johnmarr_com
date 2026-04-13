"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/AuthProvider";
import { useBluffBoxSession, type MatchupState, type MatchupLogEntry } from "./useBluffBoxSession";
import {
  selectNextMatchup,
  selectCard,
  shuffleCards,
  resolveTurn,
  evaluateRound,
  initPlayerStatuses,
  resetForNewRound,
  resetForBonusRound,
} from "./tournament";
import { isAiPlayer, getPersona } from "@/app/games/_gamecore";
import { aiShare, aiGuess } from "./aiBluffPlayer";
import { GameGamertagBadge } from "@/app/games/_gamecore";
import { PointsManager, Activity } from "@/lib/points";

import RoundIntroScreen from "./screens/RoundIntroScreen";
import MatchupScreen from "./screens/MatchupScreen";
import SharerViewScreen from "./screens/SharerViewScreen";
import OpponentGuessScreen from "./screens/OpponentGuessScreen";
import AIShareDisplay from "./screens/AIShareDisplay";
import HumanToAIInput from "./screens/HumanToAIInput";
import TurnResultScreen from "./screens/TurnResultScreen";
import WinnerScreen from "./screens/WinnerScreen";
import GameOverScreen from "./screens/GameOverScreen";
import BluffPackPicker from "./BluffPackPicker";
import type { BluffBoxPack } from "@/lib/bluffbox-packs";

interface BluffBoxGameProps {
  sessionId: string;
  splashBgURL?: string;
  /** Shown above the left player on the matchup / VS screen */
  gameLogoURL?: string;
}

export default function BluffBoxGame({ sessionId, splashBgURL, gameLogoURL }: BluffBoxGameProps) {
  const { user } = useAuth();
  const userId = user?.uid ?? "";
  const { state, updateFields, setPhase } = useBluffBoxSession(sessionId, userId);
  const aiProcessingRef = useRef(false);

  const {
    session,
    bbPhase,
    selectedPackId,
    cardPool,
    roundNumber,
    bonusRoundCount,
    playerStatuses,
    matchup,
    matchupLog,
    bbWinner,
    bbTiedWinners,
    bbEndType,
    isHost,
  } = state;

  const players = session?.players ?? [];
  const playerUids = players.map((p) => p.uid);

  // ─── Host: Pack Selected ────────────────────────────────────

  const handlePackSelected = useCallback(async (pack: BluffBoxPack) => {
    const shuffled = shuffleCards(pack.cards);
    const statuses = initPlayerStatuses(playerUids);
    const { deleteField } = await import("firebase/firestore");
    await updateFields({
      selectedPackId: pack.id,
      selectedPackName: pack.name,
      selectedPackCoverURL: pack.coverImageURL,
      cardPool: shuffled,
      roundNumber: 1,
      bonusRoundCount: 0,
      playerStatuses: statuses,
      matchup: null,
      matchupLog: [],
      bbWinner: null,
      bbTiedWinners: [],
      bbEndType: null,
      bbPhase: "round-intro",
      bluffLobbyPackId: deleteField(),
      bluffLobbyPackName: deleteField(),
      bluffLobbyPackCoverURL: deleteField(),
    });
  }, [playerUids, updateFields]);

  const [lobbyAutoApplyFailed, setLobbyAutoApplyFailed] = useState(false);

  const lobbyPackIdRaw = session
    ? (session as unknown as Record<string, unknown>)["bluffLobbyPackId"]
    : undefined;
  const lobbyPackId = typeof lobbyPackIdRaw === "string" && lobbyPackIdRaw ? lobbyPackIdRaw : null;

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

  // ─── Host: Start Next Matchup ──────────────────────────────

  const startNextMatchup = useCallback(async () => {
    const next = selectNextMatchup(playerStatuses, playerUids);
    if (!next) {
      await setPhase("round-end");
      return;
    }

    let pool = cardPool;
    if (pool.length === 0) {
      const { getPack } = await import("@/lib/bluffbox-packs");
      const pack = await getPack(selectedPackId!);
      pool = shuffleCards(pack?.cards ?? []);
    }

    const matchupState: MatchupState = {
      sharer: next.sharer,
      opponent: next.opponent,
      turn: 1,
      isStandIn: next.isStandIn,
      cardURL: null,
      sharerChoice: null,
      opponentGuess: null,
      aiShareText: null,
      humanShareText: null,
    };

    await updateFields({
      matchup: matchupState,
      cardPool: pool,
      bbPhase: "matchup-reveal",
    });
  }, [playerStatuses, playerUids, cardPool, selectedPackId, updateFields, setPhase]);

  // ─── Host: Auto-advance from matchup-reveal ────────────────

  useEffect(() => {
    if (!isHost || bbPhase !== "matchup-reveal") return;
    const timer = setTimeout(async () => {
      await setPhase("sharer-box");
    }, 2000);
    return () => clearTimeout(timer);
  }, [isHost, bbPhase, setPhase]);

  // ─── Host: Reveal Card (sharer taps box) ───────────────────

  const handleRevealBox = useCallback(async () => {
    if (!isHost && matchup?.sharer !== userId) return;

    const pool = cardPool;
    if (pool.length === 0) return;

    const { card, remainingPool } = selectCard(pool);
    await updateFields({
      "matchup.cardURL": card,
      cardPool: remainingPool,
    });
  }, [cardPool, matchup, userId, isHost, updateFields]);

  // ─── Sharer: Choose Truth/Lie ──────────────────────────────

  const handleSharerChoice = useCallback(async (choice: "truth" | "lie") => {
    await updateFields({
      "matchup.sharerChoice": choice,
    });

    const opponentIsAI = matchup && isAiPlayer(matchup.opponent);
    const sharerIsHuman = matchup && !isAiPlayer(matchup.sharer);

    if (sharerIsHuman && opponentIsAI) {
      await setPhase("human-to-ai-input");
    } else {
      await setPhase("opponent-guess");
    }
  }, [matchup, updateFields, setPhase]);

  // ─── Host: AI Sharer Logic ─────────────────────────────────

  useEffect(() => {
    if (!isHost || bbPhase !== "sharer-box" || !matchup?.cardURL || aiProcessingRef.current) return;
    if (!isAiPlayer(matchup.sharer)) return;

    aiProcessingRef.current = true;
    (async () => {
      try {
        const persona = getPersona(matchup.sharer);
        const result = await aiShare(
          matchup.cardURL!,
          { prompt: persona?.prompt ?? "", voice: persona?.voice ?? "" },
        );
        await updateFields({
          "matchup.sharerChoice": result.choice,
          "matchup.aiShareText": result.shareText,
          bbPhase: "ai-share-display",
        });
      } finally {
        aiProcessingRef.current = false;
      }
    })();
  }, [isHost, bbPhase, matchup, updateFields]);

  // ─── Human: Submit share text for AI opponent ──────────────

  const handleHumanShareText = useCallback(async (text: string) => {
    await updateFields({
      "matchup.humanShareText": text,
      bbPhase: "opponent-guess",
    });
  }, [updateFields]);

  // ─── Host: AI Opponent Logic ───────────────────────────────

  useEffect(() => {
    if (!isHost || bbPhase !== "opponent-guess" || aiProcessingRef.current) return;
    if (!matchup || !isAiPlayer(matchup.opponent)) return;
    if (matchup.opponentGuess) return;

    const shareText = matchup.humanShareText || matchup.aiShareText || "something mysterious";

    aiProcessingRef.current = true;
    (async () => {
      try {
        const persona = getPersona(matchup.opponent);
        const guess = await aiGuess(shareText, {
          prompt: persona?.prompt ?? "",
          voice: persona?.voice ?? "",
        });
        await handleOpponentGuess(guess);
      } finally {
        aiProcessingRef.current = false;
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, bbPhase, matchup]);

  // ─── Opponent: Guess Truth/Lie ─────────────────────────────

  const handleOpponentGuess = useCallback(async (guess: "truth" | "lie") => {
    if (!matchup || !matchup.sharerChoice) return;

    const { opponentSurvived } = resolveTurn(matchup.sharerChoice, guess);

    const logEntry: MatchupLogEntry = {
      sharer: matchup.sharer,
      opponent: matchup.opponent,
      sharerChoice: matchup.sharerChoice,
      opponentGuess: guess,
      opponentSurvived,
      isStandIn: matchup.isStandIn,
      round: roundNumber,
    };

    const newStatuses = { ...playerStatuses };
    if (!opponentSurvived) {
      newStatuses[matchup.opponent] = "eliminated";
    } else if (newStatuses[matchup.opponent] !== "eliminated") {
      newStatuses[matchup.opponent] = "played";
    }

    await updateFields({
      "matchup.opponentGuess": guess,
      playerStatuses: newStatuses,
      matchupLog: [...matchupLog, logEntry],
      bbPhase: "turn-result",
    });
  }, [matchup, roundNumber, playerStatuses, matchupLog, updateFields]);

  // ─── Host: After turn result, advance ──────────────────────

  const handleTurnResultComplete = useCallback(async () => {
    if (!isHost || !matchup) return;

    // Turn 1 done, not a stand-in → swap for turn 2
    if (matchup.turn === 1 && !matchup.isStandIn) {
      const pool = cardPool.length > 0 ? cardPool : [];
      let remainingPool = pool;
      if (pool.length > 0) {
        const result = selectCard(pool);
        remainingPool = result.remainingPool;
      }

      const turn2: MatchupState = {
        sharer: matchup.opponent,
        opponent: matchup.sharer,
        turn: 2,
        isStandIn: false,
        cardURL: null,
        sharerChoice: null,
        opponentGuess: null,
        aiShareText: null,
        humanShareText: null,
      };

      await updateFields({
        matchup: turn2,
        cardPool: remainingPool,
        bbPhase: "sharer-box",
      });
      return;
    }

    // Both turns done (or stand-in) → mark sharer as played if alive
    const newStatuses = { ...playerStatuses };
    if (newStatuses[matchup.sharer] === "alive") {
      newStatuses[matchup.sharer] = "played";
    }

    await updateFields({
      matchup: null,
      playerStatuses: newStatuses,
      bbPhase: "matchup-complete",
    });
  }, [isHost, matchup, cardPool, playerStatuses, updateFields]);

  // ─── Host: Matchup Complete → next matchup or round-end ───

  useEffect(() => {
    if (!isHost || bbPhase !== "matchup-complete") return;
    const timer = setTimeout(async () => {
      await startNextMatchup();
    }, 1500);
    return () => clearTimeout(timer);
  }, [isHost, bbPhase, startNextMatchup]);

  // ─── Host: Round End → evaluate ────────────────────────────

  useEffect(() => {
    if (!isHost || bbPhase !== "round-end") return;

    const timer = setTimeout(async () => {
      const result = evaluateRound(playerStatuses, bonusRoundCount);

      switch (result.action) {
        case "winner":
          await updateFields({
            bbWinner: result.winner!,
            bbEndType: "winner",
            bbPhase: "game-over",
          });
          PointsManager.award(Activity.PLAY_GAME);
          break;

        case "next-round": {
          const newStatuses = resetForNewRound(playerStatuses);
          await updateFields({
            playerStatuses: newStatuses,
            roundNumber: roundNumber + 1,
            matchup: null,
            bbPhase: "round-intro",
          });
          break;
        }

        case "bonus-round": {
          const newStatuses = resetForBonusRound(playerStatuses);
          await updateFields({
            playerStatuses: newStatuses,
            bonusRoundCount: bonusRoundCount + 1,
            roundNumber: roundNumber + 1,
            matchup: null,
            bbPhase: "round-intro",
          });
          break;
        }

        case "tie":
          await updateFields({
            bbTiedWinners: result.survivors,
            bbEndType: "tie",
            bbPhase: "game-over",
          });
          PointsManager.award(Activity.PLAY_GAME);
          break;

        case "tpk":
          await updateFields({
            bbEndType: "tpk",
            bbPhase: "game-over",
          });
          PointsManager.award(Activity.PLAY_GAME);
          break;
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [isHost, bbPhase, playerStatuses, bonusRoundCount, roundNumber, updateFields]);

  // ─── Play Again ────────────────────────────────────────────

  const handlePlayAgain = useCallback(async () => {
    await updateFields({
      bbPhase: "pack-select",
      matchup: null,
      bbWinner: null,
      bbTiedWinners: [],
      bbEndType: null,
      matchupLog: [],
    });
  }, [updateFields]);

  // ─── Render ────────────────────────────────────────────────

  if (!session) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
      </div>
    );
  }

  // Determine if current user is the active sharer or opponent
  const isSharer = matchup?.sharer === userId;
  const isOpponent = matchup?.opponent === userId;
  const sharerPlayer = matchup ? players.find((p) => p.uid === matchup.sharer) : undefined;
  const opponentPlayer = matchup ? players.find((p) => p.uid === matchup.opponent) : undefined;

  const hostPackSelectSpinner =
    bbPhase === "pack-select" && isHost && !!lobbyPackId && !lobbyAutoApplyFailed;

  return (
    <div
      className="flex h-screen flex-col bg-neutral-950"
      style={splashBgURL ? {
        backgroundImage: `linear-gradient(rgba(0,0,0,0.8), rgba(0,0,0,0.9)), url(${splashBgURL})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      } : undefined}
    >
      <GameGamertagBadge />

      {/* Pack Select — skipped when lobby already chose a pack (see BluffPackLobbySelector) */}
      {bbPhase === "pack-select" && isHost && (
        hostPackSelectSpinner ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
            <p className="text-sm text-white/60">Starting game…</p>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
            <h2 className="text-xl font-black uppercase tracking-wider text-amber-400">
              Choose a Bluff Pack
            </h2>
            <BluffPackPicker onSelect={handlePackSelected} onClose={() => {}} />
          </div>
        )
      )}
      {bbPhase === "pack-select" && !isHost && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
          <p className="text-sm text-white/50">Hold on to your seats…</p>
        </div>
      )}

      {/* Round Intro */}
      {bbPhase === "round-intro" && (
        <RoundIntroScreen
          roundNumber={roundNumber}
          bonusRoundCount={bonusRoundCount}
          onComplete={() => { if (isHost) startNextMatchup(); }}
        />
      )}

      {/* Matchup Reveal + Active Game */}
      {(bbPhase === "matchup-reveal" || bbPhase === "matchup-complete") && (
        <MatchupScreen
          roundNumber={roundNumber}
          bonusRoundCount={bonusRoundCount}
          players={players}
          playerStatuses={playerStatuses}
          matchup={matchup}
          {...(gameLogoURL ? { gameLogoURL } : {})}
        />
      )}

      {/* Sharer Box / Decide */}
      {(bbPhase === "sharer-box" || bbPhase === "sharer-decide") && isSharer && !isAiPlayer(userId) && (
        <SharerViewScreen
          cardURL={matchup?.cardURL ?? null}
          onRevealBox={handleRevealBox}
          onChoose={handleSharerChoice}
        />
      )}
      {(bbPhase === "sharer-box" || bbPhase === "sharer-decide") && !isSharer && (
        <MatchupScreen
          roundNumber={roundNumber}
          bonusRoundCount={bonusRoundCount}
          players={players}
          playerStatuses={playerStatuses}
          matchup={matchup}
          {...(gameLogoURL ? { gameLogoURL } : {})}
        />
      )}

      {/* AI Share Display */}
      {bbPhase === "ai-share-display" && matchup?.aiShareText && (
        <>
          <MatchupScreen
            roundNumber={roundNumber}
            bonusRoundCount={bonusRoundCount}
            players={players}
            playerStatuses={playerStatuses}
            matchup={matchup}
            {...(gameLogoURL ? { gameLogoURL } : {})}
          />
          <AIShareDisplay
            aiName={sharerPlayer?.gamertag ?? "AI"}
            aiAvatarName={sharerPlayer?.avatarName}
            shareText={matchup.aiShareText}
            onDismiss={() => { if (isHost) setPhase("opponent-guess"); }}
          />
        </>
      )}

      {/* Human to AI Input */}
      {bbPhase === "human-to-ai-input" && isSharer && (
        <HumanToAIInput
          aiName={opponentPlayer?.gamertag ?? "AI"}
          onSubmit={handleHumanShareText}
        />
      )}
      {bbPhase === "human-to-ai-input" && !isSharer && (
        <MatchupScreen
          roundNumber={roundNumber}
          bonusRoundCount={bonusRoundCount}
          players={players}
          playerStatuses={playerStatuses}
          matchup={matchup}
          {...(gameLogoURL ? { gameLogoURL } : {})}
        />
      )}

      {/* Opponent Guess */}
      {bbPhase === "opponent-guess" && isOpponent && !isAiPlayer(userId) && (
        <OpponentGuessScreen
          sharerName={sharerPlayer?.gamertag ?? "Player"}
          sharerIsHuman={!isAiPlayer(matchup?.sharer ?? "")}
          onGuess={handleOpponentGuess}
        />
      )}
      {bbPhase === "opponent-guess" && !isOpponent && (
        <MatchupScreen
          roundNumber={roundNumber}
          bonusRoundCount={bonusRoundCount}
          players={players}
          playerStatuses={playerStatuses}
          matchup={matchup}
          {...(gameLogoURL ? { gameLogoURL } : {})}
        />
      )}

      {/* Turn Result */}
      {bbPhase === "turn-result" && matchup && (
        <TurnResultScreen
          sharerName={sharerPlayer?.gamertag ?? "Player"}
          opponentName={opponentPlayer?.gamertag ?? "Player"}
          sharerChoice={matchup.sharerChoice!}
          opponentGuess={matchup.opponentGuess!}
          opponentSurvived={matchup.opponentGuess === matchup.sharerChoice}
          onComplete={handleTurnResultComplete}
        />
      )}

      {/* Round End (brief) */}
      {bbPhase === "round-end" && (
        <MatchupScreen
          roundNumber={roundNumber}
          bonusRoundCount={bonusRoundCount}
          players={players}
          playerStatuses={playerStatuses}
          matchup={null}
          {...(gameLogoURL ? { gameLogoURL } : {})}
        />
      )}

      {/* Game Over */}
      {bbPhase === "game-over" && bbEndType === "winner" && bbWinner && (
        <WinnerScreen
          winner={players.find((p) => p.uid === bbWinner) ?? players[0]!}
          isHost={isHost}
          onPlayAgain={handlePlayAgain}
        />
      )}
      {bbPhase === "game-over" && bbEndType === "tie" && (
        <GameOverScreen
          endType="tie"
          tiedWinners={players.filter((p) => bbTiedWinners.includes(p.uid))}
          allPlayers={players}
          isHost={isHost}
          onPlayAgain={handlePlayAgain}
        />
      )}
      {bbPhase === "game-over" && bbEndType === "tpk" && (
        <GameOverScreen
          endType="tpk"
          tiedWinners={[]}
          allPlayers={players}
          isHost={isHost}
          onPlayAgain={handlePlayAgain}
        />
      )}
    </div>
  );
}
