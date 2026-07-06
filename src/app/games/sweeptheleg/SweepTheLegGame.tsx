"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import Image from "next/image";
import { JMGameScoreboard } from "@/JMKit";
import {
  useMultiplayerRound,
  useGameMusic,
  useChapteredVideo,
  useSimpleAiOpponent,
  useMatchAutoStart,
  WIN_PHRASES,
  pickRandom,
  parseActionByPrefix,
  getOpponentGamertag,
  buildTwoSideGameEnd,
  GameFinishedOverlay,
  JoinMatchButton,
  type AiMoveRecord,
  type AiPromptContext,
} from "../_gamecore";
import { useAuth } from "@/lib/AuthProvider";
import type { GameSession } from "@/lib/game-sessions";
import type { JMContent } from "@/lib/content-types";
import type { GameEndResult } from "../_gamecore/registry/types";

type Attack = "H" | "M" | "L";

type MoveRecord = AiMoveRecord<Attack>;

type ChapterName =
  | "Ready"
  | "H-L" | "H-M" | "H-H"
  | "M-H" | "M-L" | "M-M"
  | "L-M" | "L-H" | "L-L"
  | "W-W" | "R-W";
type GamePhase = "idle" | "ready" | "animating" | "finished";

const CHAPTERS: Record<ChapterName, { start: number; end: number }> = {
  Ready: { start: 0.0,     end: 1.5  },
  "H-L": { start: 1.667,   end: 5.083  },
  "H-M": { start: 5.625,   end: 9.833  },
  "H-H": { start: 10.375,  end: 13.458 },
  "M-H": { start: 14.0,    end: 17.375 },
  "M-L": { start: 17.917,  end: 22.375 },
  "M-M": { start: 22.917,  end: 26.083 },
  "L-M": { start: 26.625,  end: 31.958 },
  "L-H": { start: 32.5,    end: 38.458 },
  "L-L": { start: 39.0,    end: 41.75  },
  "W-W": { start: 42.292,  end: 45.0   },
  "R-W": { start: 45.542,  end: 48.292 },
};

const POINTS_TO_WIN = 5;
// After a move, stay optimistic this long (chosen attack highlighted, staging
// video looping) before fading in "Waiting for opponent…". Long enough that a
// normal resolve never shows it; only a genuinely slow opponent / AI does.
const WAITING_LABEL_DELAY_MS = 1500;
const ATTACKS: Attack[] = ["L", "M", "H"];
const ATTACK_LABEL: Record<Attack, string> = { H: "HIGH", M: "MID", L: "LOW" };
const ATTACK_BEATS: Record<Attack, string> = { H: "beats Low", M: "beats High", L: "beats Mid" };
type PlayerSide = "red" | "white";

const ACTION_TO_ATTACK: Record<string, Attack> = {
  high: "H",
  mid: "M",
  low: "L",
};

function parseAttackFromAction(action: string): Attack | null {
  return parseActionByPrefix(action, ACTION_TO_ATTACK);
}

function buildMovePrompt(aiSide: "red" | "white", history: MoveRecord[]): string {
  const playerSide = aiSide === "red" ? "White" : "Red";
  const nameMap: Record<string, string> = { H: "High", M: "Mid", L: "Low" };

  const system = `You are the ${aiSide.toUpperCase()} fighter in a martial-arts game. The human player is ${playerSide}. Each round both fighters simultaneously choose High, Mid, or Low.

WHAT BEATS WHAT:
- High beats Low (if opponent plays Low, you win with High)
- Mid beats High (if opponent plays High, you win with Mid)
- Low beats Mid (if opponent plays Mid, you win with Low)
- Same attack = tie

BONUS POINTS:
- Red scores 2 points (instead of 1) when Red plays Low and White plays Mid.
- White scores 2 points (instead of 1) when White plays Low and Red plays High.

First to 5 points wins. Study the player's patterns and choose the move most likely to beat them. Look for tendencies, repeats, sequences, and post-win/post-loss habits.

CRITICAL: Your ACTION must match your reasoning. If you reason that you should counter their Low, your ACTION must be High. If you reason that you should counter their High, your ACTION must be Mid. If you reason you should counter their Mid, your ACTION must be Low.

Format your response EXACTLY as:
REASONING: <1 brief sentence for the player to read after the game>
ACTION: <High, Mid, or Low>`;

  if (history.length === 0) {
    return system + "\n\nThis is the first round — no history yet. Pick your opening move.";
  }

  const lines = history.map((m, i) => {
    const result = m.winner === "tie" ? "Tie" : m.winner === "player" ? "Player won" : "You won";
    return `Round ${i + 1}: Player=${nameMap[m.player]}, You=${nameMap[m.opponent]} → ${result}`;
  });
  return system + `\n\nMove history:\n${lines.join("\n")}\n\nRound ${history.length + 1} — what do you play?`;
}

function buildPostGamePrompt(aiSide: "red" | "white", history: MoveRecord[], aiWon: boolean): string {
  const playerSide = aiSide === "red" ? "White" : "Red";
  const nameMap: Record<string, string> = { H: "High", M: "Mid", L: "Low" };
  const lines = history.map((m, i) => {
    const result = m.winner === "tie" ? "Tie" : m.winner === "player" ? "Player won" : "You won";
    return `Round ${i + 1}: Player=${nameMap[m.player]}, You=${nameMap[m.opponent]} → ${result}`;
  });

  return `You are the ${aiSide.toUpperCase()} fighter in a martial-arts game. The human player is ${playerSide}.

Full match history:
${lines.join("\n")}

The game is over. ${aiWon ? "You won!" : "You lost."} Give a brief post-game comment (1-2 sentences) reflecting on the match — what patterns you noticed, what worked or didn't, and whether the player surprised you. Be conversational and a good sport. Reply with ONLY your comment, nothing else.`;
}

function AttackIndicator({
  side,
  attack,
}: {
  side: "red" | "white";
  attack: Attack;
}) {
  const isRed = side === "red";
  const size = 48;
  const color = isRed ? "#ef4444" : "#ffffff";

  const verticalStyle: React.CSSProperties =
    attack === "H"
      ? { top: 24 }
      : attack === "L"
        ? { bottom: 24 }
        : { top: "50%", marginTop: -(size / 2) };

  const horizontalStyle: React.CSSProperties = isRed
    ? { left: -(size / 2) }
    : { right: -(size / 2) };

  const rotation = isRed ? 90 : -90;

  return (
    <div
      className={`absolute z-10 ${isRed ? "animate-indicator-in-left" : "animate-indicator-in-right"}`}
      style={{
        ...verticalStyle,
        ...horizontalStyle,
        width: size,
        height: size,
      }}
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        style={{ transform: `rotate(${rotation}deg)`, filter: `drop-shadow(0 0 6px ${color}80)` }}
      >
        <polygon points="50,15 90,85 50,65 10,85" fill={color} />
      </svg>
    </div>
  );
}

const AI_WIN_PHRASES = [
  "You beat AI",
  "You crushed AI!",
  "You defeated AI",
  "You destroyed Skynet",
  "You beat the machine",
  "You slayed the Bot",
  "You pwned AI",
  "You beat the bot",
  "You killed AI",
  "You ruled the machine",
];

const AI_LOSE_PHRASES = [
  "Skynet destroyed you",
  "The Bot Bites Back",
  "The Revenge of AI",
  "The Bot Beat You",
  "The Machine Ate Your Lunch",
  "Bullied by the Bot",
  "You Lost to AI",
  "Pwned by AI",
  "AI kicked yo butt",
  "AI Domination",
];

export default function SweepTheLegGame({
  sessionId,
  gameData,
  onGameEnd,
}: {
  sessionId: string;
  gameData: JMContent;
  onGameEnd: (result: GameEndResult) => void;
}) {
  const { user, gamertag: myTag } = useAuth();
  const userId = user?.uid ?? "";

  const splashLogoURL = gameData.splashLogoURL ?? gameData.coverURL;
  const splashBgURL = gameData.splashBgURL;
  const gameSlug = gameData.slug ?? "sweeptheleg";
  const backgroundMusicURL = gameData.backgroundMusicURL;
  const backgroundMusicVolume = gameData.backgroundMusicVolume;

  const musicURL = backgroundMusicURL || (gameSlug ? `/music/${gameSlug}.mp3` : null);
  const { ensurePlaying, connectVideo } = useGameMusic({ url: musicURL, volume: backgroundMusicVolume ?? 0.3 });

  const [phase, setPhase] = useState<GamePhase>("idle");
  const [redScore, setRedScore] = useState(0);
  const [whiteScore, setWhiteScore] = useState(0);
  const [playerSide, setPlayerSide] = useState<PlayerSide>("red");
  const [endMessage, setEndMessage] = useState("");
  const [roundAttacks, setRoundAttacks] = useState<{ red: Attack; white: Attack } | null>(null);
  const [selectedAttack, setSelectedAttack] = useState<Attack | null>(null);
  const [showWaiting, setShowWaiting] = useState(false);
  const [joinerAccepted, setJoinerAccepted] = useState(false);

  const phaseRef = useRef<GamePhase>("idle");
  const redRef = useRef(0);
  const whiteRef = useRef(0);
  const sideRef = useRef<PlayerSide>("red");
  const goToResultsRef = useRef<() => void>(() => {});

  // Video element + RAF chapter loop + visibility handling (shared machinery)
  const { videoRef, videoMountRef, playChapter } = useChapteredVideo<ChapterName>({
    chapters: CHAPTERS,
    initialChapter: "Ready",
    connectVideo,
  });

  // Rounds are resolved server-side (resolverKey "hml"); this hook just
  // subscribes, submits moves, and surfaces the server-written rounds.
  const {
    session: mpSession,
    phase: mpPhase,
    isHost: mpIsHost,
    submitMove: mpSubmitMove,
    markAnimationDone,
  } = useMultiplayerRound({
    sessionId,
    userId,
  });

  // Derive the player's assigned side from the multiplayer session
  const mpSide: PlayerSide | null = useMemo(() => {
    if (!mpSession?.playerSides || !userId) return null;
    const s = mpSession.playerSides[userId];
    return s === "red" || s === "white" ? s : null;
  }, [mpSession?.playerSides, userId]);

  // ─── AI opponent (a session player; the host drives its moves) ───
  // Prompt building stays here; the shared hook orchestrates fetch/submit,
  // the post-game comment, and the persona W/L record.
  const buildAiMovePrompt = useCallback(
    (history: MoveRecord[], ctx: AiPromptContext) =>
      buildMovePrompt(ctx.aiSide === "red" ? "red" : "white", history),
    [],
  );
  const buildAiPostGamePrompt = useCallback(
    (history: MoveRecord[], aiWon: boolean, ctx: AiPromptContext) =>
      buildPostGamePrompt(ctx.aiSide === "red" ? "red" : "white", history, aiWon),
    [],
  );
  const computeAiWon = useCallback((ctx: { session: GameSession; aiUid: string }) => {
    const sides = ctx.session.playerSides ?? {};
    const redUid = Object.entries(sides).find(([, s]) => s === "red")?.[0] ?? "";
    const whiteUid = Object.entries(sides).find(([, s]) => s === "white")?.[0] ?? "";
    const winnerUid = redRef.current >= POINTS_TO_WIN ? redUid : whiteUid;
    return winnerUid === ctx.aiUid;
  }, []);

  const { aiName, vsAI } = useSimpleAiOpponent<Attack>({
    session: mpSession,
    isHost: mpIsHost,
    sessionId,
    roundOpen: phase === "ready",
    finished: phase === "finished",
    defaultHistoryMove: "H",
    fallbackMoves: ATTACKS,
    parseAction: parseAttackFromAction,
    buildMovePrompt: buildAiMovePrompt,
    buildPostGamePrompt: buildAiPostGamePrompt,
    computeAiWon,
  });

  const opponentGamertag = useMemo(
    () => getOpponentGamertag(mpSession, userId),
    [mpSession, userId],
  );

  const setP = useCallback((p: GamePhase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  const handleStart = useCallback(
    (side: PlayerSide) => {
      ensurePlaying();
      sideRef.current = side;
      setPlayerSide(side);
      redRef.current = 0;
      whiteRef.current = 0;
      setSelectedAttack(null);
      setRedScore(0);
      setWhiteScore(0);
      setP("ready");
      playChapter("Ready", { loop: true });
    },
    [playChapter, setP, ensurePlaying],
  );

  // Auto-start the match once the session is playing and our side is known
  // (shared hook; joiner gate satisfies iOS autoplay gestures).
  useMatchAutoStart({
    session: mpSession,
    side: mpSide,
    isHost: mpIsHost,
    joinerAccepted,
    onStart: handleStart,
  });

  const mpRoundsLenRef = useRef(0);

  // Round results: play the video chapter, update scores, log the transcript.
  useEffect(() => {
    if (!mpSession?.rounds?.length) return;
    const rounds = mpSession.rounds;
    if (rounds.length <= mpRoundsLenRef.current) return;
    mpRoundsLenRef.current = rounds.length;

    const latest = rounds[rounds.length - 1]!;
    const res = latest.result as {
      chapter: ChapterName;
      winner: "red" | "white" | null;
      redDelta: number;
      whiteDelta: number;
      redScore: number;
      whiteScore: number;
    };

    const playerSidesMap = mpSession.playerSides ?? {};
    const redAttack = (latest.moves[Object.entries(playerSidesMap).find(([, s]) => s === "red")?.[0] ?? ""] ?? "H") as Attack;
    const whiteAttack = (latest.moves[Object.entries(playerSidesMap).find(([, s]) => s === "white")?.[0] ?? ""] ?? "H") as Attack;

    // Defer state updates to next frame to avoid synchronous setState-in-effect
    requestAnimationFrame(() => {
      setRoundAttacks({ red: redAttack, white: whiteAttack });

      const finishMessage = (playerWon: boolean) =>
        vsAI
          ? pickRandom(playerWon ? AI_WIN_PHRASES : AI_LOSE_PHRASES)
          : playerWon
            ? pickRandom(WIN_PHRASES)
            : "You Lose!";

      playChapter(res.chapter, {
        onEnd: () => {
          setRoundAttacks(null);
          redRef.current = res.redScore;
          whiteRef.current = res.whiteScore;
          setRedScore(res.redScore);
          setWhiteScore(res.whiteScore);

          // Game over: play the winner animation, then auto-advance to the
          // result screen (GC4) when it finishes — no button.
          if (res.redScore >= POINTS_TO_WIN) {
            setEndMessage(finishMessage(sideRef.current === "red"));
            setP("finished");
            playChapter("R-W", { onEnd: () => goToResultsRef.current() });
          } else if (res.whiteScore >= POINTS_TO_WIN) {
            setEndMessage(finishMessage(sideRef.current === "white"));
            setP("finished");
            playChapter("W-W", { onEnd: () => goToResultsRef.current() });
          } else {
            setP("ready");
            playChapter("Ready", { loop: true });
            markAnimationDone();
          }
        },
      });
    });
  }, [mpSession, vsAI, playChapter, setP, markAnimationDone]);

  // Stay optimistic right after a move: keep the chosen attack highlighted and
  // only declare "waiting for opponent" if the resolve genuinely takes a beat
  // (slow opponent / AI still thinking). Avoids a flicker on normal fast
  // resolves now that resolution round-trips the server.
  useEffect(() => {
    if (mpPhase === "submitted") {
      const t = setTimeout(() => setShowWaiting(true), WAITING_LABEL_DELAY_MS);
      return () => clearTimeout(t);
    }
    const r = requestAnimationFrame(() => setShowWaiting(false));
    return () => cancelAnimationFrame(r);
  }, [mpPhase]);

  // ─── Hand the finished match off to the factory result screen (GC4) ───
  const goToResults = useCallback(() => {
    if (!mpSession) return;
    videoRef.current?.pause();
    onGameEnd(buildTwoSideGameEnd(
      mpSession,
      { a: "red", b: "white" },
      redRef.current,
      whiteRef.current,
      redRef.current >= POINTS_TO_WIN,
    ));
  }, [mpSession, onGameEnd, videoRef]);

  // Keep the ref pointed at the latest goToResults so the winner-animation
  // onEnd callback (registered earlier) always calls the current closure.
  useEffect(() => {
    goToResultsRef.current = goToResults;
  }, [goToResults]);

  const handleAttack = useCallback(
    (attack: Attack) => {
      if (phaseRef.current !== "ready") return;
      ensurePlaying();
      setSelectedAttack(attack);
      setP("animating");
      mpSubmitMove(attack);
    },
    [setP, mpSubmitMove, ensurePlaying],
  );

  return (
    <div className="relative flex h-dvh flex-col bg-black">
      {splashBgURL && (
        <div
          className="absolute inset-0 z-0 bg-cover bg-center opacity-50"
          style={{ backgroundImage: `url(${splashBgURL})` }}
        />
      )}
      <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-hidden px-4">
        {/* Scoreboard */}
        {phase !== "idle" && (() => {
          const playerIsRed = playerSide === "red";
          const playerTag = myTag || "YOU";
          const oppLabel = opponentGamertag ?? (vsAI ? aiName : playerIsRed ? "White" : "Red");
          const leftLabel = playerIsRed ? playerTag : oppLabel;
          const rightLabel = !playerIsRed ? playerTag : oppLabel;
          return (
            <JMGameScoreboard
              leftLabel={leftLabel}
              rightLabel={rightLabel}
              leftScore={redScore}
              rightScore={whiteScore}
              pointsToWin={POINTS_TO_WIN}
              leftColorClass="text-red-500"
              rightColorClass="text-white"
            />
          );
        })()}

        {/* Video arena — grows to fill available space, stays square */}
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <div className="relative aspect-square max-h-full max-w-full">
            <div className="relative h-full w-full overflow-hidden rounded-xl">
              <video
                ref={videoMountRef}
                src="/video/Sweep-The-Leg-Chapters.mp4"
                playsInline
                preload="auto"
                className="block h-full w-full object-cover opacity-0 transition-opacity duration-500"
                onLoadedData={(e) => { (e.target as HTMLVideoElement).classList.remove("opacity-0"); }}
              />

              {phase === "idle" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black/60 px-6">
                  {splashLogoURL ? (
                    <Image
                      src={splashLogoURL}
                      alt="Sweep the Leg"
                      width={280}
                      height={140}
                      className={`w-full max-w-[280px] object-contain${!mpSession || mpSession.status !== "playing" || !mpSide ? " animate-gentle-float" : ""}`}
                      draggable={false}
                      priority
                    />
                  ) : (
                    <h1 className="text-center text-4xl font-black uppercase leading-tight tracking-tight text-white sm:text-5xl">
                      Sweep
                      <br />
                      the Leg
                    </h1>
                  )}
                  {!mpSession || mpSession.status !== "playing" || !mpSide ? (
                    <p className="text-center text-sm font-medium uppercase tracking-widest text-white animate-pulse">
                      Waiting for host
                      <br />
                      to start match…
                    </p>
                  ) : !mpIsHost && !joinerAccepted ? (
                    <JoinMatchButton
                      onJoin={() => {
                        ensurePlaying();
                        setJoinerAccepted(true);
                      }}
                    />
                  ) : (
                    <p className="text-sm font-medium uppercase tracking-widest text-white/50 animate-pulse">
                      Loading match…
                    </p>
                  )}
                </div>
              )}

              {phase === "finished" && (
                <GameFinishedOverlay
                  message={endMessage}
                  color={playerSide === "red" ? "#ef4444" : "#ffffff"}
                  leftScore={redScore}
                  rightScore={whiteScore}
                />
              )}
            </div>

            {roundAttacks && (
              <>
                <AttackIndicator side="red" attack={roundAttacks.red} />
                <AttackIndicator side="white" attack={roundAttacks.white} />
              </>
            )}
          </div>
        </div>

        {/* Player label + Attack buttons — always mounted to prevent layout jumps */}
        <div className="shrink-0 py-3">
          <p
            className={`mb-2 text-center text-sm font-bold uppercase tracking-widest text-white/40 transition-opacity ${
              phase === "ready" || phase === "animating" ? "opacity-100" : "opacity-0"
            }`}
          >
            Choose your attack
          </p>

          {(() => {
            const isActive = phase === "ready" || phase === "animating";
            const isWaiting = showWaiting;
            const buttonsVisible = isActive && !isWaiting;
            return (
              <div className="relative">
                <div className="flex gap-3">
                  {ATTACKS.map((a) => (
                    <button
                      key={a}
                      onClick={() => handleAttack(a)}
                      disabled={phase !== "ready"}
                      aria-hidden={!buttonsVisible}
                      tabIndex={buttonsVisible ? 0 : -1}
                      className={`
                        flex-1 rounded-xl border-2 py-3 text-base font-bold uppercase tracking-wider
                        transition-opacity
                        ${!buttonsVisible ? "pointer-events-none opacity-0" : ""}
                        ${
                          phase === "ready" && playerSide === "red"
                            ? "border-red-500/30 bg-red-500/6 text-red-400 hover:scale-105 hover:border-red-500/60 hover:bg-red-500/12 active:scale-95"
                            : phase === "ready"
                              ? "border-white/30 bg-white/6 text-white hover:scale-105 hover:border-white/60 hover:bg-white/12 active:scale-95"
                              : playerSide === "red"
                                ? "cursor-not-allowed border-red-500/10 bg-red-500/2 text-red-400/25"
                                : "cursor-not-allowed border-white/10 bg-white/2 text-white/25"
                        }
                      `}
                      style={
                        buttonsVisible && phase !== "ready" && selectedAttack
                          ? { opacity: a === selectedAttack ? 1 : 0.3 }
                          : undefined
                      }
                    >
                      <span className="block text-xl font-black sm:text-2xl">
                        {ATTACK_LABEL[a]}
                      </span>
                      <span className="mt-0.5 block text-[10px] font-medium normal-case tracking-wide text-white/40">
                        {ATTACK_BEATS[a]}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Waiting overlay — same footprint as the buttons, no layout shift */}
                <div
                  aria-hidden={!isWaiting}
                  className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity ${
                    isWaiting ? "opacity-100" : "opacity-0"
                  }`}
                >
                  <p className="text-center text-sm font-bold uppercase tracking-widest text-white animate-pulse">
                    Waiting for opponent…
                  </p>
                </div>
              </div>
            );
          })()}
        </div>
      </main>
    </div>
  );
}
