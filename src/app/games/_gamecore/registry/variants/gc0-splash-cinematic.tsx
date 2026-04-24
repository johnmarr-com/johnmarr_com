"use client";

/**
 * GC0 Variant: Splash Cinematic
 *
 * Full-bleed background, floating logo, pulse icon, music, "Play" button.
 * Wraps the existing GameLandingPage component.
 */

import { registerVariant } from "../registry";
import type { GC0Props } from "../types";
import { GameLandingPage } from "../../GameLandingPage";

function GC0SplashCinematic({ gameData, onSoloPlay, onSoloVsAI }: GC0Props) {
  return (
    <GameLandingPage
      {...(gameData.splashBgURL ? { splashBgURL: gameData.splashBgURL } : {})}
      {...(gameData.splashIconURL ? { splashIconURL: gameData.splashIconURL } : {})}
      {...(gameData.splashLogoURL ? { splashLogoURL: gameData.splashLogoURL } : {})}
      {...(gameData.backgroundMusicURL ? { backgroundMusicURL: gameData.backgroundMusicURL } : {})}
      {...(gameData.backgroundMusicVolume != null ? { backgroundMusicVolume: gameData.backgroundMusicVolume } : {})}
      {...(gameData.bgMusicLandingOnly != null ? { bgMusicLandingOnly: gameData.bgMusicLandingOnly } : {})}
      {...(gameData.slug ? { gameSlug: gameData.slug } : {})}
      {...(gameData.subtitle ? { subtitle: gameData.subtitle } : {})}
      {...(gameData.gameLikeLabel?.trim() ? { gameLikeLabel: gameData.gameLikeLabel.trim() } : {})}
      minPlayers={gameData.minPlayers ?? 1}
      {...(gameData.maxPlayers != null ? { maxPlayers: gameData.maxPlayers } : {})}
      disabled={!gameData.isPublished}
      {...(onSoloPlay ? { onSoloPlay } : {})}
      {...(onSoloVsAI ? { onSoloVsAI } : {})}
    />
  );
}

registerVariant({
  id: "splash-cinematic",
  slot: "gc0",
  label: "Cinematic Splash",
  description: "Full-bleed background, floating logo, music, and a Play button.",
  component: GC0SplashCinematic,
});

export default GC0SplashCinematic;
