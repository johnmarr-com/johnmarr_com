"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useJMStyle } from "@/JMStyle";
import { JMAppHeader } from "@/JMKit";

type Attack = "H" | "M" | "L";
type ChapterName =
  | "Ready"
  | "H-L" | "H-M" | "H-H"
  | "M-H" | "M-L" | "M-M"
  | "L-M" | "L-H" | "L-L"
  | "W-W" | "R-W";
type GamePhase = "idle" | "ready" | "animating" | "finished";

const CHAPTERS: Record<ChapterName, { start: number; end: number }> = {
  Ready: { start: 0.0,     end: 0.417  },
  "H-L": { start: 0.417,   end: 3.833  },
  "H-M": { start: 4.375,   end: 8.583  },
  "H-H": { start: 9.125,   end: 12.208 },
  "M-H": { start: 12.750,  end: 16.125 },
  "M-L": { start: 16.667,  end: 21.125 },
  "M-M": { start: 21.667,  end: 24.833 },
  "L-M": { start: 25.375,  end: 30.708 },
  "L-H": { start: 31.250,  end: 37.208 },
  "L-L": { start: 37.750,  end: 40.500 },
  "W-W": { start: 41.042,  end: 43.750 },
  "R-W": { start: 44.292,  end: 47.042 },
};

// High beats Low, Mid beats High, Low beats Mid
const BEATS: Record<Attack, Attack> = { H: "L", M: "H", L: "M" };
const FRAME = 1 / 24;
const POINTS_TO_WIN = 5;
const ATTACKS: Attack[] = ["H", "M", "L"];
const ATTACK_LABEL: Record<Attack, string> = { H: "HIGH", M: "MID", L: "LOW" };
type PlayerSide = "red" | "white";

function roundWinner(left: Attack, right: Attack): "red" | "white" | null {
  if (left === right) return null;
  return BEATS[left] === right ? "red" : "white";
}

export default function SweepTheLegPage() {
  const { theme } = useJMStyle();
  const router = useRouter();

  const [phase, setPhase] = useState<GamePhase>("idle");
  const [redScore, setRedScore] = useState(0);
  const [whiteScore, setWhiteScore] = useState(0);
  const [winner, setWinner] = useState<"red" | "white" | null>(null);
  const [playerSide, setPlayerSide] = useState<PlayerSide>("red");

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

  const setP = useCallback((p: GamePhase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  const playChapter = useCallback(
    (
      name: ChapterName,
      opts: { loop?: boolean; freeze?: boolean; onEnd?: () => void } = {},
    ) => {
      const v = videoRef.current;
      if (!v) return;
      chapterRef.current = name;
      loopingRef.current = opts.loop ?? false;
      freezeRef.current = opts.freeze ?? false;
      onEndRef.current = opts.onEnd ?? null;
      v.currentTime = CHAPTERS[name].start;
      v.play().catch(() => {});
    },
    [],
  );

  // rAF loop — watches currentTime and enforces chapter boundaries
  // Also pauses video when tab is hidden so it doesn't play unchecked.
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
      sideRef.current = side;
      setPlayerSide(side);
      redRef.current = 0;
      whiteRef.current = 0;
      setRedScore(0);
      setWhiteScore(0);
      setWinner(null);
      setP("ready");
      playChapter("Ready", { loop: true });
    },
    [playChapter, setP],
  );

  const handleAttack = useCallback(
    (attack: Attack) => {
      if (phaseRef.current !== "ready") return;
      setP("animating");

      const cpu = ATTACKS[Math.floor(Math.random() * ATTACKS.length)]!;
      const isRed = sideRef.current === "red";
      const left = isRed ? attack : cpu;
      const right = isRed ? cpu : attack;
      const chapter = `${left}-${right}` as ChapterName;
      const rw = roundWinner(left, right);

      playChapter(chapter, {
        onEnd: () => {
          if (rw === "red") redRef.current += chapter === "L-M" ? 2 : 1;
          else if (rw === "white") whiteRef.current += chapter === "L-H" ? 2 : 1;
          setRedScore(redRef.current);
          setWhiteScore(whiteRef.current);

          if (redRef.current >= POINTS_TO_WIN) {
            setWinner("red");
            setP("finished");
            playChapter("R-W", { freeze: true });
          } else if (whiteRef.current >= POINTS_TO_WIN) {
            setWinner("white");
            setP("finished");
            playChapter("W-W", { freeze: true });
          } else {
            setP("ready");
            playChapter("Ready", { loop: true });
          }
        },
      });
    },
    [playChapter, setP],
  );

  return (
    <div className="min-h-screen bg-black">
      <JMAppHeader />

      <main className="mx-auto max-w-lg px-4 pb-8">
        <div className="py-3">
          <button
            onClick={() => {
              videoRef.current?.pause();
              router.push("/");
            }}
            className="text-sm font-medium text-white/50 transition-colors hover:text-white/80"
          >
            &larr; Back
          </button>
        </div>

        {/* Scoreboard */}
        {phase !== "idle" && (
          <div className="mb-3 flex items-end justify-between px-2">
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-400">
                Red
              </span>
              <span className="text-4xl font-black tabular-nums leading-none text-red-500">
                {redScore}
              </span>
            </div>
            <span className="mb-1 text-xs font-medium uppercase tracking-widest text-white/30">
              First to {POINTS_TO_WIN}
            </span>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">
                White
              </span>
              <span className="text-4xl font-black tabular-nums leading-none text-white">
                {whiteScore}
              </span>
            </div>
          </div>
        )}

        {/* Video arena */}
        <div className="relative w-full overflow-hidden rounded-xl">
          <video
            ref={videoRef}
            src="/video/Sweep-The-Leg-Chapters.mp4"
            playsInline
            preload="auto"
            className="block aspect-square w-full object-cover"
          />

          {phase === "idle" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black/60">
              <h1 className="text-center text-4xl font-black uppercase leading-tight tracking-tight text-white sm:text-5xl">
                Sweep
                <br />
                the Leg
              </h1>
              <p className="text-sm font-medium uppercase tracking-widest text-white/50">
                Choose your fighter
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => handleStart("red")}
                  className="rounded-full border-2 border-red-500 bg-red-500/20 px-8 py-3 text-lg font-bold uppercase tracking-wider text-red-400 transition-all hover:scale-105 hover:bg-red-500/30 active:scale-95"
                >
                  Red
                </button>
                <button
                  onClick={() => handleStart("white")}
                  className="rounded-full border-2 border-white/60 bg-white/10 px-8 py-3 text-lg font-bold uppercase tracking-wider text-white transition-all hover:scale-105 hover:bg-white/20 active:scale-95"
                >
                  White
                </button>
              </div>
            </div>
          )}

          {phase === "finished" && (
            <div className="absolute inset-0 flex flex-col items-center justify-end gap-3 bg-linear-to-t from-black/80 via-transparent to-transparent pb-8">
              <h2
                className="text-3xl font-black uppercase tracking-tight sm:text-4xl"
                style={{ color: winner === "red" ? "#ef4444" : "#ffffff" }}
              >
                {winner === "red" ? "Red Wins!" : "White Wins!"}
              </h2>
              <p className="text-lg font-bold text-white/60">
                {redScore} &ndash; {whiteScore}
              </p>
              <button
                onClick={() => {
                  videoRef.current?.pause();
                  setP("idle");
                }}
                className="mt-1 rounded-full px-8 py-3 text-sm font-bold uppercase tracking-wider text-black transition-transform hover:scale-105 active:scale-95"
                style={{ backgroundColor: theme.accents.goldenGlow }}
              >
                Play Again
              </button>
            </div>
          )}
        </div>

        {/* Player label + Attack buttons */}
        {(phase === "ready" || phase === "animating") && (
          <div className="mt-4">
            <p className="mb-3 text-center text-sm font-bold uppercase tracking-widest text-white/40">
              You are player{" "}
              {playerSide === "red" ? (
                <span className="text-red-500">RED</span>
              ) : (
                <span className="text-white">WHITE</span>
              )}
            </p>
          <div className="flex gap-3">
            {ATTACKS.map((a) => (
              <button
                key={a}
                onClick={() => handleAttack(a)}
                disabled={phase !== "ready"}
                className={`
                  flex-1 rounded-xl border-2 py-4 text-base font-bold uppercase tracking-wider
                  transition-all sm:text-lg
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
              >
                {ATTACK_LABEL[a]}
              </button>
            ))}
          </div>
          </div>
        )}
      </main>
    </div>
  );
}
