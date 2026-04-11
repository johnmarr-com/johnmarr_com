"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import Image from "next/image";
import { useJMStyle } from "@/JMStyle";
import { JMBannerText, JMGameScoreboard } from "@/JMKit";
import { simpleMove, postGameComment, useMultiplayerRound, useGameMusic, GameGamertagBadge, type GameMode, type ResolverOutput, type AIPersona } from "../_gamecore";
import { useAuth } from "@/lib/AuthProvider";
import { startGame, type GameSession } from "@/lib/game-sessions";

type Attack = "H" | "M" | "L";

interface MoveRecord {
  player: Attack;
  opponent: Attack;
  winner: "player" | "opponent" | "tie";
}
type ChapterName =
  | "Ready"
  | "H-L" | "H-M" | "H-H"
  | "M-H" | "M-L" | "M-M"
  | "L-M" | "L-H" | "L-L"
  | "W-W" | "R-W";
type GamePhase = "idle" | "ready" | "animating" | "finished";

interface TranscriptEntry {
  round: number;
  redAttack: Attack;
  whiteAttack: Attack;
  winner: "red" | "white" | null;
  points: number;
  aiAttack?: Attack;
  aiReason?: string;
}

const ATTACK_FULL: Record<Attack, string> = { H: "High", M: "Mid", L: "Low" };

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

const BEATS: Record<Attack, Attack> = { H: "L", M: "H", L: "M" };
const FRAME = 1 / 24;
const POINTS_TO_WIN = 5;
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
  const key = action.toLowerCase().trim();
  for (const [word, atk] of Object.entries(ACTION_TO_ATTACK)) {
    if (key.startsWith(word)) return atk;
  }
  return null;
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

const WIN_PHRASES = [
  "CONGRATS!",
  "WAY TO GO!",
  "YOU CRUSHED!",
  "YOU DID IT!",
  "YOU RULE!",
  "YOU DA BOSS!",
  "YOU'RE FANTASTIC!",
  "YOU'RE AMAZING!",
  "YOU DOMINATED!",
  "YOU'RE THE BEST!",
];

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

function pickRandom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function roundWinner(left: Attack, right: Attack): "red" | "white" | null {
  if (left === right) return null;
  return BEATS[left] === right ? "red" : "white";
}

export default function SweepTheLegGame({
  splashLogoURL,
  splashBgURL,
  mode = "solo",
  gameSlug,
  backgroundMusicURL,
  backgroundMusicVolume,
  sessionId: sessionIdProp,
  aiPersona,
}: {
  splashLogoURL?: string;
  splashBgURL?: string;
  mode?: GameMode;
  gameSlug?: string;
  backgroundMusicURL?: string;
  backgroundMusicVolume?: number;
  sessionId?: string;
  aiPersona?: AIPersona;
}) {
  const { theme } = useJMStyle();
  const { user, gamertag: myTag } = useAuth();

  const musicURL = backgroundMusicURL || (gameSlug ? `/music/${gameSlug}.mp3` : null);
  const { ensurePlaying, connectVideo } = useGameMusic({ url: musicURL, volume: backgroundMusicVolume ?? 0.3 });

  const [phase, setPhase] = useState<GamePhase>("idle");
  const [redScore, setRedScore] = useState(0);
  const [whiteScore, setWhiteScore] = useState(0);
  const [playerSide, setPlayerSide] = useState<PlayerSide>("red");
  const [endMessage, setEndMessage] = useState("");
  const [roundAttacks, setRoundAttacks] = useState<{ red: Attack; white: Attack } | null>(null);
  const [selectedAttack, setSelectedAttack] = useState<Attack | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [showTranscript, setShowTranscript] = useState(false);
  const [aiPostGame, setAiPostGame] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const chapterRef = useRef<ChapterName>("Ready");
  const loopingRef = useRef(false);
  const freezeRef = useRef(false);
  const onEndRef = useRef<(() => void) | null>(null);
  const rafRef = useRef(0);
  const phaseRef = useRef<GamePhase>("idle");
  const redRef = useRef(0);
  const whiteRef = useRef(0);
  const sideRef = useRef<PlayerSide>("red");
  const historyRef = useRef<MoveRecord[]>([]);
  const prefetchRef = useRef<Promise<{ attack: Attack; reasoning: string }> | null>(null);
  const personaPrompt = aiPersona?.prompt || undefined;
  const personaVoice = aiPersona?.voice || undefined;
  const aiName = aiPersona?.name || "AI";

  // Multiplayer resolver: maps pending moves to Sweep the Leg outcome
  const stlResolver = useCallback(
    (moves: Record<string, string>, sess: GameSession): ResolverOutput => {
      const sides = sess.playerSides ?? {};
      let redUid = "";
      let whiteUid = "";
      for (const [uid, side] of Object.entries(sides)) {
        if (side === "red") redUid = uid;
        else if (side === "white") whiteUid = uid;
      }

      const redAttack = (moves[redUid] ?? "H") as Attack;
      const whiteAttack = (moves[whiteUid] ?? "H") as Attack;
      const chapter = `${redAttack}-${whiteAttack}` as ChapterName;
      const rw = roundWinner(redAttack, whiteAttack);

      const currentRound = sess.currentRound ?? 0;
      const prevRounds = sess.rounds ?? [];
      let rScore = 0;
      let wScore = 0;
      for (const r of prevRounds) {
        const res = r.result as { redDelta?: number; whiteDelta?: number };
        rScore += res.redDelta ?? 0;
        wScore += res.whiteDelta ?? 0;
      }

      let redDelta = 0;
      let whiteDelta = 0;
      if (rw === "red") redDelta = chapter === "L-M" ? 2 : 1;
      else if (rw === "white") whiteDelta = chapter === "L-H" ? 2 : 1;

      rScore += redDelta;
      wScore += whiteDelta;
      const gameOver = rScore >= POINTS_TO_WIN || wScore >= POINTS_TO_WIN;
      const winner = gameOver
        ? rScore >= POINTS_TO_WIN ? redUid : whiteUid
        : null;

      const redTag = sess.players.find((p) => p.uid === redUid)?.gamertag ?? "Red";
      const whiteTag = sess.players.find((p) => p.uid === whiteUid)?.gamertag ?? "White";

      const lines: string[] = [
        `Round ${currentRound + 1} — Red (${redTag}): ${ATTACK_FULL[redAttack]}, White (${whiteTag}): ${ATTACK_FULL[whiteAttack]}`,
      ];
      if (rw) {
        const delta = rw === "red" ? redDelta : whiteDelta;
        lines.push(
          `${rw === "red" ? "Red" : "White"} wins — ${delta} point${delta > 1 ? "s" : ""} (${rScore}-${wScore})`,
        );
      } else {
        lines.push(`Tie (${rScore}-${wScore})`);
      }
      if (gameOver) {
        lines.push(`Game over — ${rw === "red" ? `Red (${redTag})` : `White (${whiteTag})`} wins!`);
      }

      return {
        roundEntry: {
          round: currentRound,
          moves: { [redUid]: redAttack, [whiteUid]: whiteAttack },
          result: { chapter, winner: rw, redDelta, whiteDelta, redScore: rScore, whiteScore: wScore },
        },
        transcriptLines: lines,
        gameOver,
        winner,
      };
    },
    [],
  );

  const isFriends = mode === "friends" && !!sessionIdProp;

  const {
    session: mpSession,
    phase: mpPhase,
    isHost: mpIsHost,
    submitMove: mpSubmitMove,
    markAnimationDone,
  } = useMultiplayerRound({
    sessionId: isFriends ? sessionIdProp! : null,
    userId: user?.uid ?? "",
    resolver: stlResolver,
  });

  // Derive the player's assigned side from the multiplayer session
  const mpSide: PlayerSide | null = useMemo(() => {
    if (!isFriends || !mpSession?.playerSides || !user?.uid) return null;
    const s = mpSession.playerSides[user.uid];
    return s === "red" || s === "white" ? s : null;
  }, [isFriends, mpSession?.playerSides, user?.uid]);

  const opponentGamertag = useMemo(() => {
    if (!mpSession || !user?.uid) return null;
    const opp = mpSession.players.find((p) => p.uid !== user.uid);
    return opp?.gamertag ?? null;
  }, [mpSession, user]);

  const setP = useCallback((p: GamePhase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  const videoMountRef = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
  }, []);

  const playChapter = useCallback(
    (
      name: ChapterName,
      opts: { loop?: boolean; freeze?: boolean; onEnd?: () => void } = {},
    ) => {
      const v = videoRef.current;
      if (!v) return;
      connectVideo(v);
      chapterRef.current = name;
      loopingRef.current = opts.loop ?? false;
      freezeRef.current = opts.freeze ?? false;
      onEndRef.current = opts.onEnd ?? null;
      v.currentTime = CHAPTERS[name].start;
      v.play().catch(() => {});
    },
    [connectVideo],
  );

  useEffect(() => {
    let active = true;
    const wasPlayingRef = { current: false };

    function tick() {
      if (!active) return;
      const v = videoRef.current;
      if (v && !v.paused && !v.ended && !v.seeking) {
        const ch = CHAPTERS[chapterRef.current];
        if (v.currentTime >= ch.end - FRAME) {
          if (loopingRef.current) {
            v.currentTime = ch.start;
          } else if (freezeRef.current) {
            v.pause();
          } else {
            const cb = onEndRef.current;
            onEndRef.current = null;
            cb?.();
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    function onVisibilityChange() {
      const v = videoRef.current;
      if (!v) return;
      if (document.hidden) {
        wasPlayingRef.current = !v.paused;
        if (!v.paused) v.pause();
      } else if (wasPlayingRef.current) {
        v.currentTime = CHAPTERS[chapterRef.current].start;
        v.play().catch(() => {});
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      active = false;
      cancelAnimationFrame(rafRef.current);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  const handleStart = useCallback(
    (side: PlayerSide) => {
      ensurePlaying();
      sideRef.current = side;
      setPlayerSide(side);
      redRef.current = 0;
      whiteRef.current = 0;
      historyRef.current = [];
      prefetchRef.current = null;
      setTranscript([]);
      setShowTranscript(false);
      setAiPostGame("");
      setSelectedAttack(null);
      setRedScore(0);
      setWhiteScore(0);
      setP("ready");
      playChapter("Ready", { loop: true });
    },
    [playChapter, setP, ensurePlaying],
  );

  // Track multiplayer restarts via a generation counter
  const mpStartedRef = useRef(false);
  const mpRoundsLenRef = useRef(0);
  const mpPrevStatusRef = useRef<string | null>(null);

  // Multiplayer auto-start (and restart): detect fresh "playing" state
  useEffect(() => {
    if (!isFriends || !mpSession || !mpSide) return;

    const prevStatus = mpPrevStatusRef.current;
    mpPrevStatusRef.current = mpSession.status;

    if (mpSession.status !== "playing") return;

    // Detect restart: transition from finished → playing, or first start
    const isRestart = prevStatus === "finished" && mpSession.currentRound === 0;
    if (isRestart) {
      mpStartedRef.current = false;
      mpRoundsLenRef.current = 0;
    }

    if (mpStartedRef.current) return;
    mpStartedRef.current = true;
    requestAnimationFrame(() => handleStart(mpSide));
  }, [isFriends, mpSession, mpSide, handleStart]);

  // Multiplayer round results: play the video chapter and update scores
  useEffect(() => {
    if (!isFriends || !mpSession?.rounds?.length) return;
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
      setTranscript((prev) => [
        ...prev,
        {
          round: latest.round + 1,
          redAttack,
          whiteAttack,
          winner: res.winner,
          points: res.winner === "red" ? res.redDelta : res.winner === "white" ? res.whiteDelta : 0,
        },
      ]);

      setRoundAttacks({ red: redAttack, white: whiteAttack });

      playChapter(res.chapter, {
        onEnd: () => {
          setRoundAttacks(null);
          redRef.current = res.redScore;
          whiteRef.current = res.whiteScore;
          setRedScore(res.redScore);
          setWhiteScore(res.whiteScore);

          if (res.redScore >= POINTS_TO_WIN) {
            const playerWon = sideRef.current === "red";
            setEndMessage(playerWon ? pickRandom(WIN_PHRASES) : "You Lose!");
            setP("finished");
            playChapter("R-W", { freeze: true });
          } else if (res.whiteScore >= POINTS_TO_WIN) {
            const playerWon = sideRef.current === "white";
            setEndMessage(playerWon ? pickRandom(WIN_PHRASES) : "You Lose!");
            setP("finished");
            playChapter("W-W", { freeze: true });
          } else {
            setP("ready");
            playChapter("Ready", { loop: true });
            markAnimationDone();
          }
        },
      });
    });
  }, [isFriends, mpSession?.rounds, mpSession?.playerSides, mpSession?.currentRound, playChapter, setP, markAnimationDone]);

  const fetchAiMove = useCallback((): Promise<{ attack: Attack; reasoning: string }> => {
    const aiSide = sideRef.current === "red" ? "white" : "red";
    const prompt = buildMovePrompt(aiSide, historyRef.current);
    return simpleMove(prompt, personaPrompt, personaVoice)
      .then(({ action, reason }) => {
        const attack = parseAttackFromAction(action);
        if (attack) return { attack, reasoning: reason };
        return { attack: ATTACKS[Math.floor(Math.random() * ATTACKS.length)]!, reasoning: reason };
      })
      .catch(() => ({
        attack: ATTACKS[Math.floor(Math.random() * ATTACKS.length)]!,
        reasoning: "",
      }));
  }, [personaPrompt, personaVoice]);

  const resolveRound = useCallback(
    (attack: Attack, cpu: Attack, aiReason?: string) => {
      const isRed = sideRef.current === "red";
      const left = isRed ? attack : cpu;
      const right = isRed ? cpu : attack;
      const chapter = `${left}-${right}` as ChapterName;
      const rw = roundWinner(left, right);

      const winner: MoveRecord["winner"] =
        rw === null ? "tie" : (isRed ? rw === "red" : rw === "white") ? "player" : "opponent";
      historyRef.current.push({ player: attack, opponent: cpu, winner });

      setRoundAttacks({ red: left, white: right });

      let nextRed = redRef.current;
      let nextWhite = whiteRef.current;
      if (rw === "red") nextRed += chapter === "L-M" ? 2 : 1;
      else if (rw === "white") nextWhite += chapter === "L-H" ? 2 : 1;
      const pts = rw === "red" ? nextRed - redRef.current : rw === "white" ? nextWhite - whiteRef.current : 0;
      const gameOver = nextRed >= POINTS_TO_WIN || nextWhite >= POINTS_TO_WIN;

      if (mode === "ai") {
        const entry: TranscriptEntry = {
          round: historyRef.current.length,
          redAttack: left,
          whiteAttack: right,
          winner: rw,
          points: pts,
          aiAttack: cpu,
        };
        const reason = aiReason || (historyRef.current.length === 1 ? "First round — random." : "");
        if (reason) entry.aiReason = reason;
        setTranscript((prev) => [...prev, entry]);
      }

      if (mode === "ai" && !gameOver) {
        prefetchRef.current = fetchAiMove();
      }

      if (mode === "ai" && gameOver) {
        const aiSide = sideRef.current === "red" ? "white" : "red";
        const aiWon = (aiSide === "red" && nextRed >= POINTS_TO_WIN) || (aiSide === "white" && nextWhite >= POINTS_TO_WIN);
        const prompt = buildPostGamePrompt(aiSide, historyRef.current, aiWon);
        postGameComment(prompt, personaPrompt, personaVoice)
          .then(({ comment }) => { if (comment) setAiPostGame(comment); })
          .catch(() => {});

        if (aiPersona) {
          const docId = aiPersona.id.replace(/^ai-/, "");
          import("@/lib/ai-personas").then(({ recordAIGameResult }) => {
            recordAIGameResult(docId, aiWon).catch(() => {});
          });
        }
      }

      playChapter(chapter, {
        onEnd: () => {
          setRoundAttacks(null);

          redRef.current = nextRed;
          whiteRef.current = nextWhite;
          setRedScore(nextRed);
          setWhiteScore(nextWhite);

          if (nextRed >= POINTS_TO_WIN) {
            const playerWon = sideRef.current === "red";
            setEndMessage(
              mode === "ai"
                ? pickRandom(playerWon ? AI_WIN_PHRASES : AI_LOSE_PHRASES)
                : playerWon
                  ? pickRandom(WIN_PHRASES)
                  : "You Lose!",
            );
            setP("finished");
            playChapter("R-W", { freeze: true });
          } else if (nextWhite >= POINTS_TO_WIN) {
            const playerWon = sideRef.current === "white";
            setEndMessage(
              mode === "ai"
                ? pickRandom(playerWon ? AI_WIN_PHRASES : AI_LOSE_PHRASES)
                : playerWon
                  ? pickRandom(WIN_PHRASES)
                  : "You Lose!",
            );
            setP("finished");
            playChapter("W-W", { freeze: true });
          } else {
            setP("ready");
            playChapter("Ready", { loop: true });
          }
        },
      });
    },
    [playChapter, setP, mode, fetchAiMove, personaPrompt, personaVoice, aiPersona],
  );

  const handleAttack = useCallback(
    (attack: Attack) => {
      if (phaseRef.current !== "ready") return;
      ensurePlaying();
      setSelectedAttack(attack);

      if (isFriends) {
        setP("animating");
        mpSubmitMove(attack);
        return;
      }

      setP("animating");

      if (mode === "ai") {
        const pending = prefetchRef.current;
        prefetchRef.current = null;

        if (pending) {
          pending.then(({ attack: cpu, reasoning }) => resolveRound(attack, cpu, reasoning));
        } else {
          const cpu = ATTACKS[Math.floor(Math.random() * ATTACKS.length)]!;
          resolveRound(attack, cpu);
        }
      } else {
        const cpu = ATTACKS[Math.floor(Math.random() * ATTACKS.length)]!;
        resolveRound(attack, cpu);
      }
    },
    [mode, isFriends, setP, resolveRound, mpSubmitMove, ensurePlaying],
  );

  return (
    <div className="relative flex h-dvh flex-col bg-black">
      <GameGamertagBadge />
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
          const leftLabel = playerIsRed ? playerTag : (isFriends && opponentGamertag ? opponentGamertag : mode === "ai" ? aiName : "Red");
          const rightLabel = !playerIsRed ? playerTag : (isFriends && opponentGamertag ? opponentGamertag : mode === "ai" ? aiName : "White");
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
                      className="w-full max-w-[280px] object-contain"
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
                  {isFriends ? (
                    <p className="text-sm font-medium uppercase tracking-widest text-white/50 animate-pulse">
                      Loading match…
                    </p>
                  ) : (
                    <>
                      <JMBannerText borderColor="#ffffff" borderWidth={1}>
                        <span className="text-sm font-medium uppercase tracking-widest text-white/70">
                          Choose your fighter
                        </span>
                      </JMBannerText>
                      <div className="flex gap-4">
                        <button
                          onClick={() => handleStart("red")}
                          className="animate-fighter-pulse rounded-full border-2 border-red-500 bg-red-900/70 px-8 py-3 text-lg font-bold uppercase tracking-wider text-red-400 hover:bg-red-500/30 active:scale-95"
                        >
                          Red
                        </button>
                        <button
                          onClick={() => handleStart("white")}
                          className="animate-fighter-pulse-alt rounded-full border-2 border-white/60 bg-white/20 px-8 py-3 text-lg font-bold uppercase tracking-wider text-white hover:bg-white/20 active:scale-95"
                        >
                          White
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {phase === "finished" && !showTranscript && (
                <div className="absolute inset-0 flex flex-col items-center justify-end gap-3 bg-linear-to-t from-black/80 via-transparent to-transparent pb-8">
                  <JMBannerText paddingX={32} paddingY={10}>
                    <h2
                      className="text-center text-3xl font-black uppercase tracking-tight sm:text-4xl"
                      style={{ color: playerSide === "red" ? "#ef4444" : "#ffffff" }}
                    >
                      {endMessage}
                    </h2>
                  </JMBannerText>
                  <p className="text-lg font-bold text-white/60">
                    {redScore} &ndash; {whiteScore}
                  </p>
                  {isFriends ? (
                    mpIsHost ? (
                      <button
                        onClick={async () => {
                          if (!mpSession?.playerSides) return;
                          ensurePlaying();
                          videoRef.current?.pause();
                          await startGame(mpSession.id, mpSession.playerSides);
                        }}
                        className="mt-1 rounded-full px-8 py-3 text-sm font-bold uppercase tracking-wider text-black transition-transform hover:scale-105 active:scale-95"
                        style={{ backgroundColor: theme.accents.goldenGlow }}
                      >
                        Play Again
                      </button>
                    ) : (
                      <p className="mt-1 text-sm font-bold uppercase tracking-widest text-white/40 animate-pulse">
                        Waiting for rematch…
                      </p>
                    )
                  ) : (
                    <button
                      onClick={() => {
                        ensurePlaying();
                        videoRef.current?.pause();
                        setP("idle");
                      }}
                      className="mt-1 rounded-full px-8 py-3 text-sm font-bold uppercase tracking-wider text-black transition-transform hover:scale-105 active:scale-95"
                      style={{ backgroundColor: theme.accents.goldenGlow }}
                    >
                      Play Again
                    </button>
                  )}
                  {(mode === "ai" || isFriends) && transcript.length > 0 && (
                    <button
                      onClick={() => setShowTranscript(true)}
                      className="mt-2 rounded-full border border-white/30 bg-white/10 px-6 py-2 text-sm font-bold uppercase tracking-wider text-white/80 transition-all hover:scale-105 hover:bg-white/20 active:scale-95"
                    >
                      {isFriends ? "View Transcript" : "View AI Transcript"}
                    </button>
                  )}
                </div>
              )}

              {phase === "finished" && showTranscript && (
                <div className="absolute inset-0 z-30 flex flex-col bg-black/95">
                  <div className="flex items-center justify-between px-5 py-4">
                    <span className="text-sm font-bold uppercase tracking-widest text-white/70">
                      {isFriends ? "Match Transcript" : "AI Transcript"}
                    </span>
                    <button
                      onClick={() => setShowTranscript(false)}
                      className="rounded-full border border-white/20 px-4 py-1 text-xs font-bold uppercase tracking-widest text-white/60 hover:bg-white/10 hover:text-white"
                    >
                      Close
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto px-5 pb-5">
                    {aiPostGame && (
                      <div className="mb-4 pb-4 border-b border-white/15">
                        <p className="text-xs font-bold uppercase tracking-widest text-white/40">
                          Post-Game Thoughts
                        </p>
                        <p className="mt-2 text-sm italic text-amber-300/80">
                          &ldquo;{aiPostGame}&rdquo;
                        </p>
                      </div>
                    )}
                    {transcript.map((entry) => (
                      <div key={entry.round} className="mb-4 border-t border-white/15 pt-4 first:border-0 first:pt-0">
                        <p className="text-xs font-bold uppercase tracking-widest text-white/40">
                          Round {entry.round}
                        </p>
                        <p className="mt-1.5 text-sm">
                          <span className="font-semibold text-red-400">Red: {ATTACK_FULL[entry.redAttack]}</span>
                          <span className="mx-2 text-white/30">|</span>
                          <span className="font-semibold text-white">White: {ATTACK_FULL[entry.whiteAttack]}</span>
                        </p>
                        <p className="text-sm text-white/60">
                          {entry.winner
                            ? `${entry.winner === "red" ? "Red" : "White"} wins — ${entry.points} Point${entry.points > 1 ? "s" : ""}`
                            : "Tie — 0 Points"}
                        </p>
                        {entry.aiReason && (
                          <p className="mt-1.5 text-sm italic text-amber-300/80">
                            &ldquo;{entry.aiReason}&rdquo;
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
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

        {/* Player label + Attack buttons */}
        {(phase === "ready" || phase === "animating") && (
          <div className="shrink-0 py-3">
            <p className="mb-2 text-center text-sm font-bold uppercase tracking-widest text-white/40">
              {isFriends && opponentGamertag ? (
                <>
                  Choose your attack, player{" "}
                  {playerSide === "red" ? (
                    <span className="text-red-500">RED</span>
                  ) : (
                    <span className="text-white">WHITE</span>
                  )}
                  {" "}vs {opponentGamertag}
                </>
              ) : (
                <>
                  Choose your attack, player{" "}
                  {playerSide === "red" ? (
                    <span className="text-red-500">RED</span>
                  ) : (
                    <span className="text-white">WHITE</span>
                  )}
                </>
              )}
            </p>

            {isFriends && mpPhase === "submitted" ? (
              <p className="py-4 text-center text-sm font-bold uppercase tracking-widest text-white/40 animate-pulse">
                Waiting for opponent…
              </p>
            ) : (
              <div className="flex gap-3">
                {ATTACKS.map((a) => (
                  <button
                    key={a}
                    onClick={() => handleAttack(a)}
                    disabled={phase !== "ready"}
                    className={`
                      flex-1 rounded-xl border-2 py-3 text-base font-bold uppercase tracking-wider
                      transition-all
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
                      phase !== "ready" && selectedAttack
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
            )}
          </div>
        )}
      </main>
    </div>
  );
}
