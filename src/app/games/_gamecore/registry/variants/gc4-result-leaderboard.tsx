"use client";

/**
 * GC4 Variant: Leaderboard Result
 *
 * Shared win screen showing winner card(s) + ranked leaderboard.
 * Consolidated from the nearly-identical WinnerScreen components
 * in Wordonkulous and Blarf. Colors driven by gameData.primaryColor
 * and gameData.secondaryColor.
 *
 * Per-game overrides via `resultOptions`:
 *   logoRight    — Tailwind right-* class for logo position
 *   hideScores   — hide points subtitle + leaderboard
 *   playMusic    — resume background music on this screen
 */

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { X } from "lucide-react";
import { registerVariant } from "../registry";
import type { GC4Props } from "../types";
import { JMAvatarView, JMWinnerLoserCard, JMConfettiOverlay, JMSimpleButton } from "@/JMKit";
import { GameGamertagBadge } from "../../GameGamertagBadge";
import { useGameColors } from "../../GameColorsProvider";
import { bgMusic } from "../../BackgroundMusicPlayer";
import { getPersona, isAiPlayer } from "../../aiPersonas";

function GC4ResultLeaderboard({
  gameData,
  session,
  result,
  isHost,
  onPlayAgain,
  resultOptions,
}: GC4Props) {
  const { winners, winnerPoints, allPlayers, scores } = result;
  const { logoRight, hideScores, playMusic, showAIPostGameComments } = resultOptions ?? {};

  // Pull AI Post-Game Comments off the session doc if the game opted in.
  // `aiPostGameComments` is an optional `Record<aiUid, string>` the game
  // writes at end-of-game. We only render the button when ≥1 is present.
  const aiComments =
    (showAIPostGameComments &&
      (session as unknown as Record<string, unknown>)?.["aiPostGameComments"]) as
      | Record<string, string>
      | undefined;
  const commentEntries = aiComments
    ? allPlayers
        .filter((p) => isAiPlayer(p.uid) && aiComments[p.uid])
        .map((p) => ({
          uid: p.uid,
          name: p.gamertag,
          avatarName: p.avatarName,
          comment: aiComments[p.uid]!,
        }))
    : [];
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const { primary, secondary } = useGameColors();
  const gameLogoURL = gameData.splashLogoURL ?? gameData.coverURL;
  const bgDim = gameData.splashBgDim ?? 50;

  const winnerUids = new Set(winners.map((w) => w.uid));
  const others = allPlayers
    .filter((p) => !winnerUids.has(p.uid))
    .sort((a, b) => (scores[b.uid] ?? 0) - (scores[a.uid] ?? 0));

  // Resume background music on the result screen if requested
  useEffect(() => {
    if (!playMusic) return;
    const slug = gameData.slug;
    const url = gameData.backgroundMusicURL || (slug ? `/music/${slug}.mp3` : null);
    if (url) {
      bgMusic.play(url, gameData.backgroundMusicVolume ?? 0.3);
    }
    return () => {
      if (playMusic) bgMusic.stop();
    };
  }, [playMusic, gameData.slug, gameData.backgroundMusicURL, gameData.backgroundMusicVolume]);

  const logoRightClass = logoRight ?? "right-[-8px]";

  return (
    <div
      className="relative flex min-h-dvh flex-col items-center justify-center gap-5 overflow-hidden bg-black px-6 py-8"
      style={{
        ...(gameData.splashBgURL ? {
          backgroundImage: `url(${gameData.splashBgURL})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        } : {}),
      }}
    >
      {/* Dim overlay — driven by CMS splashBgDim (0 = none, 100 = full black) */}
      {bgDim > 0 && (
        <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${bgDim / 100})` }} />
      )}

      {/* Gamertag — top center */}
      <GameGamertagBadge />

      {/* Exit button — top left */}
      <Link href="/" className="absolute left-3 top-3 z-20">
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

      {/* Animated game logo — top right */}
      {gameLogoURL && (
        <div className={`pointer-events-none absolute ${logoRightClass} top-2 z-20 animate-[wk-slide-in-tr_0.6s_ease-out_both]`}>
          <Image
            src={gameLogoURL}
            alt=""
            width={300}
            height={120}
            className="h-25 w-auto select-none object-contain drop-shadow-lg sm:h-30 animate-[rock_3s_ease-in-out_0.6s_infinite]"
          />
        </div>
      )}

      <JMConfettiOverlay loop />

      {/* Content — above the overlay */}
      <div className="relative z-10 flex flex-col items-center gap-5">
        {/* Winner card(s) — primary = "WINNER!" title, secondary = gamertag name */}
        {winners.length === 1 && (
          <JMWinnerLoserCard
            variant="winner"
            avatarName={winners[0]!.avatarName ?? "default"}
            name={winners[0]!.gamertag}
            titleColor={primary}
            nameColor={secondary}
            {...(hideScores ? {} : { subtitle: `${winnerPoints} ${winnerPoints === 1 ? "point" : "points"}!` })}
          />
        )}

        {winners.length >= 2 && (
          <div className="flex flex-wrap items-start justify-center gap-4">
            {winners.map((w) => (
              <JMWinnerLoserCard
                key={w.uid}
                variant="winner"
                avatarName={w.avatarName ?? "default"}
                name={w.gamertag}
                titleColor={primary}
                nameColor={secondary}
                {...(hideScores ? {} : { subtitle: `${winnerPoints} ${winnerPoints === 1 ? "point" : "points"}!` })}
              />
            ))}
          </div>
        )}

        {/* Leaderboard */}
        {!hideScores && others.length > 0 && (
          <div
            className="w-full max-w-md rounded-xl border border-white/10 bg-black/40 px-4 py-3"
            style={{
              boxShadow:
                "inset 0 4px 8px rgba(0,0,0,0.5), inset 0 -2px 4px rgba(255,255,255,0.1)",
            }}
          >
            <p className="mb-2 text-center text-xs font-black uppercase tracking-widest text-white/50">
              Leaderboard
            </p>
            <div className="flex flex-col gap-2">
              {others.map((p) => (
                <div key={p.uid} className="flex items-center gap-3">
                  <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-black">
                    <JMAvatarView width={32} avatarName={p.avatarName ?? "default"} />
                  </div>
                  <span
                    className="min-w-0 flex-1 truncate text-sm font-black"
                    style={{ color: secondary }}
                  >
                    {p.gamertag}
                  </span>
                  <span
                    className="text-sm font-black tabular-nums"
                    style={{ color: primary }}
                  >
                    {scores[p.uid] ?? 0}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Play Again — host only */}
        {isHost && (
          <button
            onClick={onPlayAgain}
            className="mt-4 w-full max-w-xs rounded-xl py-4 text-lg font-black uppercase tracking-wider text-black shadow-lg transition-all hover:scale-[1.02] active:scale-95"
            style={{ backgroundColor: primary }}
          >
            Play Again
          </button>
        )}

        {/* AI Post-Game Comments — one button per AI with a comment. */}
        {commentEntries.length > 0 && (
          <div className="mt-2 flex w-full max-w-xs flex-col gap-2">
            {commentEntries.map((entry) => (
              <button
                key={entry.uid}
                onClick={() => setShowCommentsModal(true)}
                className="rounded-full border border-white/30 bg-white/10 px-5 py-2 text-sm font-bold uppercase tracking-wider text-white/80 transition-all hover:scale-[1.02] hover:bg-white/20 active:scale-95"
              >
                {entry.name}&rsquo;s Post-Game Comments
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Modal: all AI comments stacked */}
      {showCommentsModal && commentEntries.length > 0 && (
        <div className="fixed inset-0 z-40 flex flex-col bg-black/95 backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <span className="text-sm font-black uppercase tracking-widest text-white/70">
              Post-Game Comments
            </span>
            <button
              type="button"
              onClick={() => setShowCommentsModal(false)}
              aria-label="Close"
              className="rounded-full p-2 text-white/70 transition-colors hover:bg-white/10"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {commentEntries.map((entry) => {
              const persona = getPersona(entry.uid);
              return (
                <div
                  key={entry.uid}
                  className="mb-5 rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-black/40">
                      <JMAvatarView width={40} avatarName={entry.avatarName ?? "default"} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate text-sm font-black uppercase tracking-wider"
                        style={{ color: secondary }}
                      >
                        {entry.name}
                      </p>
                      {persona?.description && (
                        <p className="truncate text-xs text-white/40">
                          {persona.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm italic text-amber-300/90">
                    &ldquo;{entry.comment}&rdquo;
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

registerVariant({
  id: "result-leaderboard",
  slot: "gc4",
  label: "Leaderboard",
  description: "Winner card(s) with ranked standings and a Play Again button.",
  component: GC4ResultLeaderboard,
});

export default GC4ResultLeaderboard;
