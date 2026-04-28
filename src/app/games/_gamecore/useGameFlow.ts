"use client";

/**
 * useGameFlow — Outer phase state machine for composed games.
 *
 * Manages the high-level flow: landing → game → result → replay.
 * The gate and lobby phases (GC1/GC2) are handled internally by
 * GameLandingPage + GameMultiplayerFlow for V1.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import { getContentBySlug } from "@/lib/content";
import type { JMContent } from "@/lib/content-types";
import { joinGameSessionById, subscribeToSession } from "@/lib/game-sessions";
import type { GameSession } from "@/lib/game-sessions";
import { updateSessionFields } from "../_gamecore/sessionHelpers";
import type {
  GameFlowPhase,
  GameEndResult,
  ComposeGameInput,
  EngineSkinLoadError,
} from "./registry/types";

export interface GameFlowState {
  phase: GameFlowPhase;
  gameData: JMContent | null;
  /** Set when `contentSlugFromQueryParam` is used and the skin could not be resolved. */
  skinLoadError: EngineSkinLoadError | null;
  activeSessionId: string | null;
  session: GameSession | null;
  isHost: boolean;
  gameResult: GameEndResult | null;
  isLoading: boolean;
}

export interface GameFlowActions {
  /** Called by GameLandingPage when multiplayer game starts. */
  handleMultiplayerStart: (sessionId: string) => void;
  /** Called by the GC3 game component when gameplay ends. */
  handleGameEnd: (result: GameEndResult) => void;
  /** Called by the GC4 result screen when the host taps Play Again. */
  handlePlayAgain: () => Promise<void>;
  /** Navigate away / back to home. */
  handleExit: () => void;
}

export function useGameFlow(config: ComposeGameInput): GameFlowState & GameFlowActions {
  const searchParams = useSearchParams();
  const { user, gamertag, avatarName, isLoading: authLoading } = useAuth();
  const initialSessionId = searchParams.get("sessionId");
  const qParam = config.contentSlugFromQueryParam;
  const skinSlug = qParam ? (searchParams.get(qParam)?.trim() ?? "") : null;

  // ─── Core state ──────────────────────────────────────────
  const [phase, setPhase] = useState<GameFlowPhase>(
    initialSessionId ? "game" : "landing",
  );
  const [loadedGameData, setLoadedGameData] = useState<JMContent | null>(null);
  const [fetchSkinError, setFetchSkinError] = useState<EngineSkinLoadError | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
  const [session, setSession] = useState<GameSession | null>(null);
  const [gameResult, setGameResult] = useState<GameEndResult | null>(null);
  const [contentLoading, setContentLoading] = useState(true);

  const autoJoinRef = useRef(false);
  const lastReplayCountRef = useRef<number>(0);

  // Prefer URL sessionId (handles client-side nav from My Games)
  const activeSessionId = initialSessionId ?? sessionId;

  /** Engine skin routes require ?param=slug; derive error without syncing state in an effect. */
  const missingSkinParam = !!(qParam && !skinSlug);
  const gameData = missingSkinParam ? null : loadedGameData;
  const skinLoadError = missingSkinParam ? "missing_game_param" : fetchSkinError;
  const isLoading = missingSkinParam ? false : contentLoading;

  // ─── Fetch game data (fixed slug or ?queryParam= for engine skins) ───
  useEffect(() => {
    if (qParam) {
      if (!skinSlug) {
        return;
      }
      setContentLoading(true); // eslint-disable-line react-hooks/set-state-in-effect -- reset loading before async skin fetch when query param resolves
      setFetchSkinError(null);
      getContentBySlug("game", skinSlug).then((data) => {
        if (!data) {
          setLoadedGameData(null);
          setFetchSkinError("game_not_found");
        } else if (data.engineSlug !== config.slug) {
          setLoadedGameData(null);
          setFetchSkinError("game_wrong_engine");
        } else {
          setLoadedGameData(data);
          setFetchSkinError(null);
        }
        setContentLoading(false);
      });
      return;
    }
    setFetchSkinError(null);
    getContentBySlug("game", config.slug).then((data) => {
      setLoadedGameData(data);
      setContentLoading(false);
    });
  }, [config.slug, qParam, skinSlug]);

  // A sessionId arriving in the URL while the page was already on landing
  // (e.g. My Games "Rejoin" tapped from the same game's splash) needs to
  // push phase into "game" — useState's initializer only ran on first mount.
  useEffect(() => {
    if (initialSessionId && phase === "landing") {
      setPhase("game"); // eslint-disable-line react-hooks/set-state-in-effect -- sync phase when a sessionId appears in the URL after initial mount (My Games rejoin while on splash)
    }
  }, [initialSessionId, phase]);

  // ─── Auto-join from invite link ──────────────────────────
  useEffect(() => {
    if (!initialSessionId || autoJoinRef.current || authLoading || !user || !gamertag) return;
    autoJoinRef.current = true;
    joinGameSessionById(initialSessionId, user.uid, gamertag, avatarName ?? undefined).catch(() => {});
  }, [initialSessionId, authLoading, user, gamertag, avatarName]);

  // ─── Subscribe to session when active ────────────────────
  // Also detects host's "Play Again" via replayCount increment
  // so non-host players transition back to the game phase.
  useEffect(() => {
    if (!activeSessionId) return;
    let cancelled = false;
    let unsub: (() => void) | undefined;
    subscribeToSession(activeSessionId, (updated) => {
      if (cancelled || !updated) return;
      // Detect replay: host incremented replayCount
      const count = updated.replayCount ?? 0;
      if (count > lastReplayCountRef.current) {
        lastReplayCountRef.current = count;
        // Non-host players: leave result screen and re-enter game
        const hostOwned = user && updated.ownerId === user.uid;
        if (!hostOwned) {
          setGameResult(null);
          setPhase("game");
        }
      }
      setSession(updated);
    }).then((fn) => {
      if (cancelled) { fn(); } else { unsub = fn; }
    });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [activeSessionId, user]);

  // ─── Derive isHost ───────────────────────────────────────
  const isHost = !!(session && user && session.ownerId === user.uid);

  // ─── Actions ─────────────────────────────────────────────

  const handleMultiplayerStart = useCallback((sid: string) => {
    setSessionId(sid);
    setPhase("game");
  }, []);

  const handleGameEnd = useCallback((result: GameEndResult) => {
    setGameResult(result);
    setPhase("result");
  }, []);

  const handlePlayAgain = useCallback(async () => {
    if (!activeSessionId || !session) return;
    const fields = config.resetFields(session);
    await updateSessionFields(activeSessionId, {
      ...fields,
      replayCount: (session.replayCount ?? 0) + 1,
    });
    setGameResult(null);
    setPhase("game");
  }, [activeSessionId, config, session]);

  const handleExit = useCallback(() => {
    setSessionId(null);
    setSession(null);
    setGameResult(null);
    setPhase("landing");
  }, []);

  return {
    phase,
    gameData,
    skinLoadError,
    activeSessionId,
    session,
    isHost,
    gameResult,
    isLoading,
    handleMultiplayerStart,
    handleGameEnd,
    handlePlayAgain,
    handleExit,
  };
}
