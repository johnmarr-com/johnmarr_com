"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { ChevronDown } from "lucide-react";
import { JMAvatarView, JMAIAvatarView } from "@/JMKit";
import { GamePrimaryButton, GameStatusMessage } from "../_gamecore";
import { getPlayerForStep, type Chains, type ChainEntry } from "./chainEngine";
import type { GameSessionPlayer } from "@/lib/game-sessions";
import { isAiPlayer, getPersona } from "./aiConstants";

interface MegaSketchyShareProps {
  players: GameSessionPlayer[];
  playOrder: string[];
  chains: Chains;
  userId: string;
  isHost: boolean;
  onPlayAgain: () => void;
}

export default function MegaSketchyShare({
  players,
  playOrder,
  chains,
  userId,
  isHost,
  onPlayAgain,
}: MegaSketchyShareProps) {
  const [selectedUid, setSelectedUid] = useState(userId);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const getPlayerName = useCallback(
    (uid: string) => {
      if (uid === "control") return "Control";
      return players.find((p) => p.uid === uid)?.gamertag ?? "Unknown";
    },
    [players],
  );

  const getPlayerAvatar = useCallback(
    (uid: string) => {
      return players.find((p) => p.uid === uid)?.avatarName;
    },
    [players],
  );

  const elementIndex = playOrder.indexOf(selectedUid);
  const chain: ChainEntry[] = useMemo(
    () => (elementIndex >= 0 ? (chains[String(elementIndex)] ?? []) : []),
    [chains, elementIndex],
  );

  const cardCreators = useMemo(() => {
    return chain.map((_, step) => {
      if (step === 0) return "control";
      return getPlayerForStep(elementIndex, step, playOrder);
    });
  }, [chain, elementIndex, playOrder]);

  const selectPlayer = useCallback((uid: string) => {
    setSelectedUid(uid);
    setActiveIndex(0);
    scrollRef.current?.scrollTo({ left: 0, behavior: "instant" });
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !el.children.length) return;
    const card = el.children[0] as HTMLElement;
    if (!card) return;
    const cardWidth = card.offsetWidth;
    const gap = 16;
    const idx = Math.round(el.scrollLeft / (cardWidth + gap));
    setActiveIndex(idx);
  }, []);

  return (
    <div className="fixed inset-0 z-10 flex flex-col">
      {/* Header */}
      <div className="shrink-0 px-6 pt-8 pb-2 text-center">
        <p className="mb-1 text-xs font-bold uppercase tracking-[0.3em] text-green-400/70">
          Transmission Log
        </p>
        <h1 className="text-2xl font-black uppercase tracking-wider text-white">
          {getPlayerName(selectedUid)}&apos;s Chain
        </h1>
      </div>

      {/* Carousel */}
      <div className="flex flex-1 flex-col items-center justify-center overflow-hidden px-4">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex w-full max-w-lg snap-x snap-mandatory gap-4 overflow-x-auto pb-4"
          style={{ scrollbarWidth: "none" }}
        >
          {chain.map((entry, idx) => {
            const creatorUid = cardCreators[idx] ?? "control";
            const creatorName = getPlayerName(creatorUid);

            return (
              <div
                key={idx}
                className="relative shrink-0 snap-start overflow-hidden rounded-2xl bg-white"
                style={{ width: "min(85vw, 480px)", aspectRatio: "1 / 1" }}
              >
                {/* Gamertag badge */}
                <div className="absolute right-2.5 top-2.5 z-10 rounded-lg bg-purple-600 px-3 py-1.5 shadow-sm">
                  <span className="text-sm font-bold text-white">
                    {creatorName}
                  </span>
                </div>

                {/* Content */}
                {entry.type === "text" ? (
                  <div className="flex h-full w-full flex-col items-center justify-center p-8">
                    {idx === 0 && (
                      <p className="mb-2 text-sm font-bold uppercase tracking-widest text-purple-600">
                        Supposed to Send:
                      </p>
                    )}
                    {idx === chain.length - 1 && chain.length > 1 && (
                      <p className="mb-2 text-sm font-bold uppercase tracking-widest text-purple-600">
                        Sent:
                      </p>
                    )}
                    <p className="text-center text-4xl font-black text-gray-800 sm:text-5xl">
                      &ldquo;{entry.value}&rdquo;
                    </p>
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={entry.value}
                    alt="Sketch"
                    className="h-full w-full object-contain"
                    draggable={false}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Page dots */}
        {chain.length > 1 && (
          <div className="mt-2 flex gap-1.5">
            {chain.map((_, idx) => (
              <div
                key={idx}
                className={`h-2 w-2 rounded-full transition-all ${
                  idx === activeIndex
                    ? "scale-125 bg-white"
                    : "bg-white/30"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Player selector + actions */}
      <div className="shrink-0 px-6 pb-8 pt-4">
        <div className="mx-auto w-full max-w-lg">
          {/* Dropdown */}
          <div className="relative mb-4">
            <button
              onClick={() => setDropdownOpen((o) => !o)}
              className="flex w-full items-center gap-4 rounded-xl border border-white/15 bg-white/10 px-5 py-4 transition-colors hover:bg-white/15"
            >
              <PlayerBadge
                uid={selectedUid}
                name={getPlayerName(selectedUid)}
                avatarName={getPlayerAvatar(selectedUid)}
                size="lg"
              />
              <span className="flex-1 text-left text-lg font-bold text-white">
                {getPlayerName(selectedUid)}
              </span>
              <ChevronDown
                className={`h-5 w-5 text-white/40 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
              />
            </button>

            {dropdownOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 max-h-60 overflow-y-auto rounded-xl border border-white/15 bg-gray-900/95 backdrop-blur-sm">
                {playOrder.map((uid) => (
                  <button
                    key={uid}
                    onClick={() => {
                      selectPlayer(uid);
                      setDropdownOpen(false);
                    }}
                    className={`flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-white/10 ${
                      uid === selectedUid ? "bg-white/5" : ""
                    }`}
                  >
                    <PlayerBadge
                      uid={uid}
                      name={getPlayerName(uid)}
                      avatarName={getPlayerAvatar(uid)}
                      size="lg"
                    />
                    <span className="text-base font-bold text-white">
                      {getPlayerName(uid)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Host actions */}
          {isHost ? (
            <GamePrimaryButton onClick={onPlayAgain}>
              Play Again
            </GamePrimaryButton>
          ) : (
            <GameStatusMessage message="Waiting for host to start a new mission..." />
          )}
        </div>
      </div>
    </div>
  );
}

function PlayerBadge({
  uid,
  name,
  avatarName,
  size = "sm",
}: {
  uid: string;
  name: string;
  avatarName: string | undefined;
  size?: "sm" | "lg";
}) {
  const isAI = isAiPlayer(uid);
  const px = size === "lg" ? 44 : 32;
  const sizeClass = size === "lg" ? "h-11 w-11" : "h-8 w-8";

  if (isAI) {
    return <JMAIAvatarView size={px} avatarName={avatarName} scaleOverride={getPersona(uid)?.avatarScale} />;
  }

  if (avatarName) {
    return (
      <div className={`${sizeClass} shrink-0 overflow-hidden rounded-full`}>
        <JMAvatarView width={px} avatarName={avatarName} />
      </div>
    );
  }

  return (
    <div className={`flex ${sizeClass} shrink-0 items-center justify-center rounded-full bg-purple-500/20`}>
      <span className={`font-bold text-purple-400 ${size === "lg" ? "text-sm" : "text-xs"}`}>
        {name.charAt(0).toUpperCase()}
      </span>
    </div>
  );
}
