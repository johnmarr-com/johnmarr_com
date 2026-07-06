"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { JMChampionPicker, JMGameScoreboard, JMWaiting, type ChampionOption } from "@/JMKit";
import {
  useMultiplayerRound,
  useGameMusic,
  useChapteredVideo,
  useSimpleAiOpponent,
  useMatchAutoStart,
  sliceHistoryByTier,
  aiHistoryTierForLevel,
  TIER_PROMPT_DIRECTIVE,
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
import type { JMContent } from "@/lib/content-types";
import type { GameEndResult } from "../_gamecore/registry/types";

type Attack = "R" | "P" | "S";

type MoveRecord = AiMoveRecord<Attack>;

type BattleChapter =
  | "S-R-1" | "S-R-2" | "S-R-3"
  | "R-S-1" | "R-S-2" | "R-S-3"
  | "S-P-1" | "S-P-2" | "S-P-3"
  | "P-S-1" | "P-S-2" | "P-S-3"
  | "R-P-1" | "R-P-2" | "R-P-3"
  | "P-R-1" | "P-R-2" | "P-R-3"
  | "RR" | "PP" | "SS";

type ChapterName = "Ready" | BattleChapter | "WIN" | "LOSE";
type GamePhase = "idle" | "ready" | "animating" | "finished";

const CHAPTERS: Record<ChapterName, { start: number; end: number }> = {
  Ready:   { start: 0.000,   end: 1.833   },
  "S-R-1": { start: 1.833,   end: 9.542   },
  "S-R-2": { start: 10.167,  end: 17.708  },
  "S-R-3": { start: 18.500,  end: 27.750  },
  "R-S-1": { start: 28.708,  end: 36.167  },
  "R-S-2": { start: 36.875,  end: 45.000  },
  "R-S-3": { start: 45.792,  end: 53.500  },
  "S-P-1": { start: 54.292,  end: 60.208  },
  "S-P-2": { start: 61.000,  end: 68.542  },
  "S-P-3": { start: 69.333,  end: 75.458  },
  "P-S-1": { start: 76.250,  end: 83.125  },
  "P-S-2": { start: 83.917,  end: 90.500  },
  "P-S-3": { start: 91.292,  end: 99.125  },
  "R-P-1": { start: 99.917,  end: 110.708 },
  "R-P-2": { start: 111.500, end: 121.083 },
  "R-P-3": { start: 121.875, end: 128.708 },
  "P-R-1": { start: 129.500, end: 138.792 },
  "P-R-2": { start: 139.500, end: 147.208 },
  "P-R-3": { start: 148.000, end: 158.875 },
  PP:      { start: 159.667, end: 165.083 },
  RR:      { start: 165.875, end: 171.667 },
  SS:      { start: 172.458, end: 177.458 },
  WIN:     { start: 178.250, end: 185.833 },
  LOSE:    { start: 186.625, end: 193.875 },
};

const POINTS_TO_WIN = 3;
const ATTACKS: Attack[] = ["R", "P", "S"];
const CHAMPION_BG = "/images/games/tapsmasharena/Champion-Choose-BG.png";
const CHAMPION_OPTIONS: ChampionOption<Attack>[] = [
  { value: "R", imageURL: "/images/games/tapsmasharena/Champion-Rock.png", label: "Rock" },
  { value: "P", imageURL: "/images/games/tapsmasharena/Champion-Paper.png", label: "Paper" },
  { value: "S", imageURL: "/images/games/tapsmasharena/Champion-Scissors.png", label: "Scissors" },
];

type PlayerSide = "p1" | "p2";

const TIE_CHAPTERS: Record<Attack, BattleChapter> = { R: "RR", P: "PP", S: "SS" };

const ACTION_TO_ATTACK: Record<string, Attack> = {
  rock: "R",
  paper: "P",
  scissors: "S",
};

function parseAttackFromAction(action: string): Attack | null {
  return parseActionByPrefix(action, ACTION_TO_ATTACK);
}

/**
 * Build owner-perspective chapter name.
 * For non-ties, both the variant (1-3) and the chapter follow the pattern
 * {ownerPick}-{opponentPick}-{variant}.
 */
function buildChapterName(
  ownerAtk: Attack,
  opponentAtk: Attack,
  variant: number,
): BattleChapter {
  if (ownerAtk === opponentAtk) return TIE_CHAPTERS[ownerAtk];
  return `${ownerAtk}-${opponentAtk}-${variant}` as BattleChapter;
}

function buildMovePrompt(
  history: MoveRecord[],
  skillLevel: number | undefined,
): string {
  const tier = aiHistoryTierForLevel(skillLevel);
  const sliced = sliceHistoryByTier(history, tier);

  const system = `You are playing Rock Paper Scissors against a human.

RULES:
- Rock beats Scissors
- Scissors beats Paper
- Paper beats Rock
- Same = tie

First to 3 points wins. Study the player's patterns and choose the move most likely to beat them. Look for tendencies, repeats, sequences, and post-win/post-loss habits.

CRITICAL: Your ACTION must match your reasoning. If you want to counter their Rock, play Paper. If you want to counter their Paper, play Scissors. If you want to counter their Scissors, play Rock.

${TIER_PROMPT_DIRECTIVE[tier]}

Format your response EXACTLY as:
REASONING: <1 brief sentence for the player to read after the game>
ACTION: <Rock, Paper, or Scissors>`;

  const nameMap: Record<string, string> = { R: "Rock", P: "Paper", S: "Scissors" };

  if (sliced.length === 0) {
    const reason = tier === "none" && history.length > 0
      ? "You don't recall earlier rounds — pick your move on instinct."
      : "This is the first round — no history yet. Pick your opening move.";
    return system + `\n\n${reason}`;
  }

  const lines = sliced.map((m, i) => {
    const result = m.winner === "tie" ? "Tie" : m.winner === "player" ? "Player won" : "You won";
    const roundNum = history.length - sliced.length + i + 1;
    return `Round ${roundNum}: Player=${nameMap[m.player]}, You=${nameMap[m.opponent]} → ${result}`;
  });
  return system + `\n\nMove history:\n${lines.join("\n")}\n\nRound ${history.length + 1} — what do you play?`;
}

function buildPostGamePrompt(history: MoveRecord[], aiWon: boolean): string {
  const nameMap: Record<string, string> = { R: "Rock", P: "Paper", S: "Scissors" };
  const lines = history.map((m, i) => {
    const result = m.winner === "tie" ? "Tie" : m.winner === "player" ? "Player won" : "You won";
    return `Round ${i + 1}: Player=${nameMap[m.player]}, You=${nameMap[m.opponent]} → ${result}`;
  });

  return `You just played Rock Paper Scissors against a human.

Full match history:
${lines.join("\n")}

The game is over. ${aiWon ? "You won!" : "You lost."} Give a brief post-game comment (1-2 sentences) reflecting on the match — what patterns you noticed, what worked or didn't, and whether the player surprised you. Be conversational and a good sport. Reply with ONLY your comment, nothing else.`;
}

const AI_WIN_PHRASES = [
  "You beat AI", "You crushed AI!", "You defeated AI", "You destroyed Skynet",
  "You beat the machine", "You slayed the Bot", "You pwned AI", "You beat the bot",
];
const AI_LOSE_PHRASES = [
  "Skynet destroyed you", "The Bot Bites Back", "The Revenge of AI", "The Bot Beat You",
  "The Machine Ate Your Lunch", "Bullied by the Bot", "You Lost to AI", "Pwned by AI",
];

export default function TapSmashArenaGame({
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

  const splashBgURL = gameData.splashBgURL;
  const gameSlug = gameData.slug ?? "tapsmasharena";
  const backgroundMusicURL = gameData.backgroundMusicURL;
  const backgroundMusicVolume = gameData.backgroundMusicVolume;

  const musicURL = backgroundMusicURL || (gameSlug ? `/music/${gameSlug}.mp3` : null);
  const { ensurePlaying, connectVideo } = useGameMusic({ url: musicURL, volume: backgroundMusicVolume ?? 0.3 });

  const [phase, setPhase] = useState<GamePhase>("idle");
  const [p1Score, setP1Score] = useState(0);
  const [p2Score, setP2Score] = useState(0);
  const [playerSide, setPlayerSide] = useState<PlayerSide>("p1");
  const [endMessage, setEndMessage] = useState("");
  const [waitingForBattle, setWaitingForBattle] = useState(false);
  const [joinerAccepted, setJoinerAccepted] = useState(false);

  const phaseRef = useRef<GamePhase>("idle");
  const p1Ref = useRef(0);
  const p2Ref = useRef(0);
  const sideRef = useRef<PlayerSide>("p1");
  const goToResultsRef = useRef<() => void>(() => {});

  // Video element + RAF chapter loop + visibility handling (shared machinery)
  const { videoRef, videoMountRef, playChapter, cueChapter } = useChapteredVideo<ChapterName>({
    chapters: CHAPTERS,
    initialChapter: "Ready",
    connectVideo,
  });

  // Rounds are resolved server-side (resolverKey "rps"); this hook just
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

  // Derive this player's side from Firestore playerSides
  const mpSide: PlayerSide | null = useMemo(() => {
    if (!mpSession?.playerSides || !userId) return null;
    const s = mpSession.playerSides[userId];
    return s === "p1" || s === "p2" ? (s as PlayerSide) : null;
  }, [mpSession?.playerSides, userId]);

  // ─── AI opponent (a session player; the host drives its moves) ───
  // Prompt building stays here; the shared hook orchestrates fetch/submit,
  // the post-game comment, and the persona W/L record.
  const buildAiMovePrompt = useCallback(
    (history: MoveRecord[], ctx: AiPromptContext) => buildMovePrompt(history, ctx.skillLevel),
    [],
  );
  const buildAiPostGamePrompt = useCallback(
    (history: MoveRecord[], aiWon: boolean) => buildPostGamePrompt(history, aiWon),
    [],
  );
  const computeAiWon = useCallback((ctx: { aiSide: string }) => {
    const winnerSide = p1Ref.current >= POINTS_TO_WIN ? "p1" : "p2";
    return winnerSide === ctx.aiSide;
  }, []);

  const { aiName, vsAI } = useSimpleAiOpponent<Attack>({
    session: mpSession,
    isHost: mpIsHost,
    sessionId,
    roundOpen: phase === "ready",
    finished: phase === "finished",
    defaultHistoryMove: "R",
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
      p1Ref.current = 0;
      p2Ref.current = 0;
      setP1Score(0);
      setP2Score(0);
      setWaitingForBattle(false);
      setP("ready");
      cueChapter("Ready");
    },
    [setP, ensurePlaying, cueChapter],
  );

  // ─── Auto-start the match once the session is playing and our side is
  // known (shared hook; joiner gate satisfies iOS autoplay gestures). ───
  useMatchAutoStart({
    session: mpSession,
    side: mpSide,
    isHost: mpIsHost,
    joinerAccepted,
    onStart: handleStart,
  });

  const mpRoundsLenRef = useRef(0);

  // ─── Round results: play the video chapter and update scores ───
  useEffect(() => {
    if (!mpSession?.rounds?.length || !userId) return;
    const rounds = mpSession.rounds;
    if (rounds.length <= mpRoundsLenRef.current) return;
    mpRoundsLenRef.current = rounds.length;

    const latest = rounds[rounds.length - 1]!;
    const res = latest.result as {
      p1Attack: Attack;
      p2Attack: Attack;
      winner: "p1" | "p2" | null;
      variant: number;
      p1Score: number;
      p2Score: number;
    };

    const playerSidesMap = mpSession.playerSides ?? {};
    const mySide = playerSidesMap[userId] as PlayerSide | undefined;
    const myAttack = mySide === "p1" ? res.p1Attack : res.p2Attack;
    const theirAttack = mySide === "p1" ? res.p2Attack : res.p1Attack;
    const chapter = buildChapterName(myAttack, theirAttack, res.variant);

    const gameOver = res.p1Score >= POINTS_TO_WIN || res.p2Score >= POINTS_TO_WIN;
    const winnerSide = res.p1Score >= POINTS_TO_WIN ? "p1" : res.p2Score >= POINTS_TO_WIN ? "p2" : null;
    const iWon = winnerSide === mySide;

    requestAnimationFrame(() => {
      // Fade the waiting overlay out *before* the round chapter starts so
      // the transition reads as: graphic fades → animation begins. Matches
      // the 300ms transition-opacity duration on the overlay.
      setWaitingForBattle(false);
      setTimeout(() => playChapter(chapter, {
        onEnd: () => {
          p1Ref.current = res.p1Score;
          p2Ref.current = res.p2Score;
          setP1Score(res.p1Score);
          setP2Score(res.p2Score);

          // Game over: play the winner animation, then auto-advance to the
          // result screen (GC4) when it finishes — no button.
          if (gameOver) {
            setEndMessage(
              vsAI
                ? pickRandom(iWon ? AI_WIN_PHRASES : AI_LOSE_PHRASES)
                : iWon ? pickRandom(WIN_PHRASES) : "You Lose!",
            );
            setP("finished");
            playChapter(iWon ? "WIN" : "LOSE", { onEnd: () => goToResultsRef.current() });
          } else {
            setP("ready");
            cueChapter("Ready");
            markAnimationDone();
          }
        },
      }), 300);
    });
  }, [mpSession, vsAI, userId, playChapter, cueChapter, setP, markAnimationDone]);

  // ─── Hand the finished match off to the factory result screen (GC4) ───
  const goToResults = useCallback(() => {
    if (!mpSession) return;
    videoRef.current?.pause();
    onGameEnd(buildTwoSideGameEnd(
      mpSession,
      { a: "p1", b: "p2" },
      p1Ref.current,
      p2Ref.current,
      p1Ref.current >= POINTS_TO_WIN,
    ));
  }, [mpSession, onGameEnd, videoRef]);

  useEffect(() => {
    goToResultsRef.current = goToResults;
  }, [goToResults]);

  const handleAttack = useCallback(
    (attack: Attack) => {
      if (phaseRef.current !== "ready") return;
      ensurePlaying();
      setWaitingForBattle(true);
      setP("animating");
      mpSubmitMove(attack);
    },
    [setP, mpSubmitMove, ensurePlaying],
  );

  const youIsP1 = playerSide === "p1";
  const playerTag = myTag || "YOU";
  const oppTag = opponentGamertag ?? (vsAI ? aiName : youIsP1 ? "P2" : "P1");
  const leftLabel = youIsP1 ? playerTag : oppTag;
  const rightLabel = !youIsP1 ? playerTag : oppTag;
  const sideColor = youIsP1 ? "#3b82f6" : "#f97316";

  return (
    <div className="relative flex h-dvh flex-col bg-black">
      {splashBgURL && (
        <div
          className="absolute inset-0 z-0 bg-cover bg-center opacity-30"
          style={{ backgroundImage: `url(${splashBgURL})` }}
        />
      )}
      <main className="relative z-10 flex flex-1 items-center justify-center overflow-hidden">
        <div
          className="relative h-full max-w-full overflow-hidden rounded-xl"
          style={{ aspectRatio: "9 / 16" }}
        >
              <video
                ref={videoMountRef}
                src="/video/Tap-Smash-Arena.mp4"
                playsInline
                preload="auto"
                className="block h-full w-full object-cover opacity-0 transition-opacity duration-500"
                onLoadedData={(e) => { (e.target as HTMLVideoElement).classList.remove("opacity-0"); }}
              />

              {/* Idle overlay — waiting for the host to start the match */}
              {phase === "idle" && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60">
                  {!mpSession || mpSession.status !== "playing" || !mpSide ? (
                    <p className="text-sm font-medium uppercase tracking-widest text-white/50 animate-pulse">
                      Waiting for host to start match…
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

              {/* Scoreboard overlay */}
              {phase !== "idle" && (
                <JMGameScoreboard
                  overlay
                  leftLabel={leftLabel}
                  rightLabel={rightLabel}
                  leftScore={p1Score}
                  rightScore={p2Score}
                  pointsToWin={POINTS_TO_WIN}
                />
              )}

              {/* Champion selection overlay */}
              <JMChampionPicker<Attack>
                options={CHAMPION_OPTIONS}
                backgroundImageURL={CHAMPION_BG}
                open={phase === "ready"}
                onSelect={handleAttack}
              />

              {/* Waiting for opponent after selection — always mounted, fades
                  in after the picker dismisses and out before the round chapter
                  plays so neither side pops. */}
              <div
                aria-hidden={!(waitingForBattle || mpPhase === "submitted")}
                className={`absolute inset-0 z-10 flex items-center justify-center bg-black/50 transition-opacity duration-300 ${
                  waitingForBattle || mpPhase === "submitted"
                    ? "opacity-100"
                    : "pointer-events-none opacity-0"
                }`}
              >
                <JMWaiting alt="Waiting for opponent…" />
              </div>

              {/* Finished overlay — the WIN/LOSE chapter auto-advances to GC4 */}
              {phase === "finished" && (
                <GameFinishedOverlay
                  className="z-10"
                  message={endMessage}
                  color={sideColor}
                  leftScore={p1Score}
                  rightScore={p2Score}
                />
              )}
        </div>
      </main>
    </div>
  );
}
