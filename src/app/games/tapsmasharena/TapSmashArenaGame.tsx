"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useJMStyle } from "@/JMStyle";
import { JMAppHeader, JMBannerText, JMChampionPicker, type ChampionOption } from "@/JMKit";
import { simpleMove, postGameComment, useGameMusic, type GameMode } from "../_gamecore";

type Attack = "R" | "P" | "S";

interface MoveRecord {
  player: Attack;
  opponent: Attack;
  winner: "player" | "opponent" | "tie";
}

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

interface TranscriptEntry {
  round: number;
  p1Attack: Attack;
  p2Attack: Attack;
  winner: "p1" | "p2" | null;
  aiAttack?: Attack;
  aiReason?: string;
}

const ATTACK_FULL: Record<Attack, string> = { R: "Rock", P: "Paper", S: "Scissors" };

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

const BEATS: Record<Attack, Attack> = { R: "S", S: "P", P: "R" };
const FRAME = 1 / 24;
const POINTS_TO_WIN = 3;
const ATTACKS: Attack[] = ["R", "P", "S"];
const CHAMPION_BG = "/images/games/tapsmasharena/Champion-Choose-BG.png";
const CHAMPION_OPTIONS: ChampionOption<Attack>[] = [
  { value: "R", imageURL: "/images/games/tapsmasharena/Champion-Rock.png", label: "Rock" },
  { value: "P", imageURL: "/images/games/tapsmasharena/Champion-Paper.png", label: "Paper" },
  { value: "S", imageURL: "/images/games/tapsmasharena/Champion-Scissors.png", label: "Scissors" },
];

type PlayerSide = "p1" | "p2";

const ACTION_TO_ATTACK: Record<string, Attack> = {
  rock: "R",
  paper: "P",
  scissors: "S",
};

function parseAttackFromAction(action: string): Attack | null {
  const key = action.toLowerCase().trim();
  for (const [word, atk] of Object.entries(ACTION_TO_ATTACK)) {
    if (key.startsWith(word)) return atk;
  }
  return null;
}

const TIE_CHAPTERS: Record<Attack, BattleChapter> = { R: "RR", P: "PP", S: "SS" };

/**
 * Resolve the battle chapter for a round.
 * Chapter naming: {ownerPick}-{opponentPick}-{1-3} — the current player's
 * champion always enters from the left side of the screen.
 */
function resolveChapter(
  ownerAtk: Attack,
  opponentAtk: Attack,
): { chapter: BattleChapter; winner: "owner" | "opponent" | null } {
  if (ownerAtk === opponentAtk) {
    return { chapter: TIE_CHAPTERS[ownerAtk], winner: null };
  }
  const variant = Math.floor(Math.random() * 3) + 1;
  const chapter = `${ownerAtk}-${opponentAtk}-${variant}` as BattleChapter;
  const ownerWins = BEATS[ownerAtk] === opponentAtk;
  return { chapter, winner: ownerWins ? "owner" : "opponent" };
}

function buildMovePrompt(history: MoveRecord[]): string {
  const system = `You are playing Rock Paper Scissors against a human.

RULES:
- Rock beats Scissors
- Scissors beats Paper
- Paper beats Rock
- Same = tie

First to 3 points wins. Study the player's patterns and choose the move most likely to beat them. Look for tendencies, repeats, sequences, and post-win/post-loss habits.

CRITICAL: Your ACTION must match your reasoning. If you want to counter their Rock, play Paper. If you want to counter their Paper, play Scissors. If you want to counter their Scissors, play Rock.

Format your response EXACTLY as:
REASONING: <1 brief sentence for the player to read after the game>
ACTION: <Rock, Paper, or Scissors>`;

  const nameMap: Record<string, string> = { R: "Rock", P: "Paper", S: "Scissors" };
  const lines = history.map((m, i) => {
    const result = m.winner === "tie" ? "Tie" : m.winner === "player" ? "Player won" : "You won";
    return `Round ${i + 1}: Player=${nameMap[m.player]}, You=${nameMap[m.opponent]} → ${result}`;
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

const WIN_PHRASES = [
  "CONGRATS!", "WAY TO GO!", "YOU CRUSHED!", "YOU DID IT!", "YOU RULE!",
  "YOU DA BOSS!", "YOU'RE FANTASTIC!", "YOU'RE AMAZING!", "YOU DOMINATED!", "YOU'RE THE BEST!",
];
const AI_WIN_PHRASES = [
  "You beat AI", "You crushed AI!", "You defeated AI", "You destroyed Skynet",
  "You beat the machine", "You slayed the Bot", "You pwned AI", "You beat the bot",
];
const AI_LOSE_PHRASES = [
  "Skynet destroyed you", "The Bot Bites Back", "The Revenge of AI", "The Bot Beat You",
  "The Machine Ate Your Lunch", "Bullied by the Bot", "You Lost to AI", "Pwned by AI",
];

function pickRandom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export default function TapSmashArenaGame({
  splashBgURL,
  mode = "solo",
  gameSlug,
  backgroundMusicURL,
  backgroundMusicVolume,
}: {
  splashBgURL?: string;
  mode?: GameMode;
  gameSlug?: string;
  backgroundMusicURL?: string;
  backgroundMusicVolume?: number;
}) {
  const { theme } = useJMStyle();

  const musicURL = backgroundMusicURL || (gameSlug ? `/music/${gameSlug}.mp3` : null);
  const { ensurePlaying, connectVideo } = useGameMusic({ url: musicURL, volume: backgroundMusicVolume ?? 0.3 });

  const [phase, setPhase] = useState<GamePhase>("ready");
  const [p1Score, setP1Score] = useState(0);
  const [p2Score, setP2Score] = useState(0);
  const [playerSide, setPlayerSide] = useState<PlayerSide>("p1");
  const [endMessage, setEndMessage] = useState("");
  const [waitingForBattle, setWaitingForBattle] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [showTranscript, setShowTranscript] = useState(false);
  const [aiPostGame, setAiPostGame] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const chapterRef = useRef<ChapterName>("Ready");
  const freezeRef = useRef(false);
  const onEndRef = useRef<(() => void) | null>(null);
  const rafRef = useRef(0);
  const phaseRef = useRef<GamePhase>("idle");
  const p1Ref = useRef(0);
  const p2Ref = useRef(0);
  const sideRef = useRef<PlayerSide>("p1");
  const historyRef = useRef<MoveRecord[]>([]);
  const prefetchRef = useRef<Promise<{ attack: Attack; reasoning: string }> | null>(null);

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
      opts: { freeze?: boolean; onEnd?: () => void } = {},
    ) => {
      const v = videoRef.current;
      if (!v) return;
      connectVideo(v);
      chapterRef.current = name;
      freezeRef.current = opts.freeze ?? false;
      onEndRef.current = opts.onEnd ?? null;
      v.currentTime = CHAPTERS[name].start;
      v.play().catch(() => {});
    },
    [connectVideo],
  );

  // RAF loop: watches for chapter end
  useEffect(() => {
    let active = true;
    const wasPlayingRef = { current: false };

    function tick() {
      if (!active) return;
      const v = videoRef.current;
      if (v && !v.paused && !v.ended && !v.seeking) {
        const ch = CHAPTERS[chapterRef.current];
        if (v.currentTime >= ch.end - FRAME) {
          if (freezeRef.current) {
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
      p1Ref.current = 0;
      p2Ref.current = 0;
      historyRef.current = [];
      prefetchRef.current = null;
      setTranscript([]);
      setShowTranscript(false);
      setAiPostGame("");
      setP1Score(0);
      setP2Score(0);
      setP("ready");

      // Jump to first frame of Ready and pause (no loop)
      const v = videoRef.current;
      if (v) {
        connectVideo(v);
        chapterRef.current = "Ready";
        v.currentTime = CHAPTERS.Ready.start;
        v.pause();
      }
    },
    [setP, ensurePlaying, connectVideo],
  );

  // Auto-start on mount — no idle screen
  const mountedRef = useRef(false);
  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    // Deferred to avoid synchronous setState inside effect body
    queueMicrotask(() => handleStart("p1"));
  }, [handleStart]);

  const fetchAiMove = useCallback((): Promise<{ attack: Attack; reasoning: string }> => {
    const prompt = buildMovePrompt(historyRef.current);
    return simpleMove(prompt)
      .then(({ action, reason }) => {
        const attack = parseAttackFromAction(action);
        if (attack) return { attack, reasoning: reason };
        return { attack: ATTACKS[Math.floor(Math.random() * ATTACKS.length)]!, reasoning: reason };
      })
      .catch(() => ({
        attack: ATTACKS[Math.floor(Math.random() * ATTACKS.length)]!,
        reasoning: "",
      }));
  }, []);

  const resolveRound = useCallback(
    (playerAttack: Attack, cpuAttack: Attack, aiReason?: string) => {
      const isP1 = sideRef.current === "p1";
      const p1Atk = isP1 ? playerAttack : cpuAttack;
      const p2Atk = isP1 ? cpuAttack : playerAttack;

      // Owner = current user; chapter names use owner's pick first
      const { chapter, winner: rw } = resolveChapter(playerAttack, cpuAttack);

      const moveWinner: MoveRecord["winner"] =
        rw === null ? "tie" : rw === "owner" ? "player" : "opponent";
      historyRef.current.push({ player: playerAttack, opponent: cpuAttack, winner: moveWinner });

      let nextP1 = p1Ref.current;
      let nextP2 = p2Ref.current;
      if (rw === "owner") {
        if (isP1) nextP1 += 1; else nextP2 += 1;
      } else if (rw === "opponent") {
        if (isP1) nextP2 += 1; else nextP1 += 1;
      }
      const gameOver = nextP1 >= POINTS_TO_WIN || nextP2 >= POINTS_TO_WIN;

      if (mode === "ai") {
        const transcriptWinner = rw === null ? null : (rw === "owner" ? (isP1 ? "p1" : "p2") : (isP1 ? "p2" : "p1")) as "p1" | "p2";
        const entry: TranscriptEntry = {
          round: historyRef.current.length,
          p1Attack: p1Atk,
          p2Attack: p2Atk,
          winner: transcriptWinner,
          aiAttack: cpuAttack,
        };
        const reason = aiReason || (historyRef.current.length === 1 ? "First round — random." : "");
        if (reason) entry.aiReason = reason;
        setTranscript((prev) => [...prev, entry]);
      }

      if (mode === "ai" && !gameOver) {
        prefetchRef.current = fetchAiMove();
      }

      if (mode === "ai" && gameOver) {
        const playerWon = rw === "owner";
        const prompt = buildPostGamePrompt(historyRef.current, !playerWon);
        postGameComment(prompt)
          .then(({ comment }) => { if (comment) setAiPostGame(comment); })
          .catch(() => {});
      }

      setWaitingForBattle(false);
      playChapter(chapter, {
        onEnd: () => {
          p1Ref.current = nextP1;
          p2Ref.current = nextP2;
          setP1Score(nextP1);
          setP2Score(nextP2);

          if (gameOver) {
            const playerWon = (isP1 && nextP1 >= POINTS_TO_WIN) || (!isP1 && nextP2 >= POINTS_TO_WIN);
            setEndMessage(
              mode === "ai"
                ? pickRandom(playerWon ? AI_WIN_PHRASES : AI_LOSE_PHRASES)
                : playerWon ? pickRandom(WIN_PHRASES) : "You Lose!",
            );
            setP("finished");
            playChapter(playerWon ? "WIN" : "LOSE", { freeze: true });
          } else {
            setP("ready");
            const v = videoRef.current;
            if (v) {
              chapterRef.current = "Ready";
              v.currentTime = CHAPTERS.Ready.start;
              v.pause();
            }
          }
        },
      });
    },
    [playChapter, setP, mode, fetchAiMove],
  );

  const handleAttack = useCallback(
    (attack: Attack) => {
      if (phaseRef.current !== "ready") return;
      ensurePlaying();
      setWaitingForBattle(true);
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
    [mode, setP, resolveRound, ensurePlaying],
  );

  const sideColor = playerSide === "p1" ? "#3b82f6" : "#f97316";

  return (
    <div className="relative flex h-dvh flex-col bg-black">
      {/* Background image — dimmed, behind everything */}
      {splashBgURL && (
        <div
          className="absolute inset-0 z-0 bg-cover bg-center opacity-30"
          style={{ backgroundImage: `url(${splashBgURL})` }}
        />
      )}
      <div className="relative z-10"><JMAppHeader /></div>

      <main className="relative z-10 flex flex-1 items-center justify-center overflow-hidden">
        {/* Video arena — height-driven, 9:16 aspect, capped at screen width */}
        <div
          className="relative h-full max-w-full overflow-hidden rounded-xl"
          style={{ aspectRatio: "9 / 16" }}
        >
              <video
                ref={videoMountRef}
                src="/video/Tap-Smash-Arena.mp4"
                playsInline
                preload="auto"
                className="block h-full w-full object-cover"
              />

              {/* Scoreboard overlay */}
              {phase !== "idle" && (() => {
                const youIsP1 = playerSide === "p1";
                const leftLabel = youIsP1 ? "YOU" : (mode === "ai" ? "AI" : "P1");
                const rightLabel = !youIsP1 ? "YOU" : (mode === "ai" ? "AI" : "P2");
                return (
                  <>
                    <div className="absolute z-20 flex flex-col items-start gap-0.5" style={{ left: 16, top: 16 }}>
                      <span className="max-w-[90px] truncate text-xs font-bold uppercase tracking-wider text-blue-400">
                        {leftLabel}
                      </span>
                      <span className="text-6xl font-black tabular-nums leading-none text-blue-500">
                        {p1Score}
                      </span>
                    </div>
                    <div className="absolute left-1/2 z-20 -translate-x-1/2" style={{ top: 16 }}>
                      <JMBannerText borderColor="#ffffff" borderWidth={1}>
                        <span className="text-sm font-medium uppercase tracking-widest text-white/80">
                          First to {POINTS_TO_WIN}
                        </span>
                      </JMBannerText>
                    </div>
                    <div className="absolute z-20 flex flex-col items-end gap-0.5" style={{ right: 16, top: 16 }}>
                      <span className="max-w-[90px] truncate text-xs font-bold uppercase tracking-wider text-orange-400">
                        {rightLabel}
                      </span>
                      <span className="text-6xl font-black tabular-nums leading-none text-orange-500">
                        {p2Score}
                      </span>
                    </div>
                  </>
                );
              })()}

              {/* Champion selection overlay */}
              <JMChampionPicker<Attack>
                options={CHAMPION_OPTIONS}
                backgroundImageURL={CHAMPION_BG}
                open={phase === "ready"}
                onSelect={handleAttack}
              />

              {/* Waiting for opponent after selection, before video plays */}
              {waitingForBattle && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50">
                  <p className="text-sm font-bold uppercase tracking-widest text-white/60 animate-pulse">
                    Waiting for opponent…
                  </p>
                </div>
              )}

              {/* Finished overlay */}
              {phase === "finished" && !showTranscript && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-end gap-3 bg-linear-to-t from-black/80 via-transparent to-transparent pb-8">
                  <JMBannerText paddingX={32} paddingY={10}>
                    <h2
                      className="text-center text-3xl font-black uppercase tracking-tight sm:text-4xl"
                      style={{ color: sideColor }}
                    >
                      {endMessage}
                    </h2>
                  </JMBannerText>
                  <p className="text-lg font-bold text-white/60">
                    {p1Score} &ndash; {p2Score}
                  </p>
                  <button
                    onClick={() => handleStart("p1")}
                    className="mt-1 rounded-full px-8 py-3 text-sm font-bold uppercase tracking-wider text-black transition-transform hover:scale-105 active:scale-95"
                    style={{ backgroundColor: theme.accents.goldenGlow }}
                  >
                    Play Again
                  </button>
                  {mode === "ai" && transcript.length > 0 && (
                    <button
                      onClick={() => setShowTranscript(true)}
                      className="mt-2 rounded-full border border-white/30 bg-white/10 px-6 py-2 text-sm font-bold uppercase tracking-wider text-white/80 transition-all hover:scale-105 hover:bg-white/20 active:scale-95"
                    >
                      View AI Transcript
                    </button>
                  )}
                </div>
              )}

              {/* Transcript overlay */}
              {phase === "finished" && showTranscript && (
                <div className="absolute inset-0 z-10 flex flex-col bg-black/95">
                  <div className="flex items-center justify-between px-5 py-4">
                    <span className="text-sm font-bold uppercase tracking-widest text-white/70">
                      AI Transcript
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
                          <span className="font-semibold text-blue-400">P1: {ATTACK_FULL[entry.p1Attack]}</span>
                          <span className="mx-2 text-white/30">|</span>
                          <span className="font-semibold text-orange-400">P2: {ATTACK_FULL[entry.p2Attack]}</span>
                        </p>
                        <p className="text-sm text-white/60">
                          {entry.winner
                            ? `${entry.winner === "p1" ? "P1" : "P2"} wins — 1 Point`
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
      </main>
    </div>
  );
}
