export { GameLandingPage, type GameLandingPageProps, type GameMode } from "./GameLandingPage";
export { GameMultiplayerFlow } from "./GameMultiplayerFlow";
export { useMultiplayerRound, type RoundResolver, type MpPhase, type ResolverOutput } from "./useMultiplayerRound";
export { useEngineDeadline } from "./useEngineDeadline";
export { PhaseTimerBar } from "./PhaseTimerBar";
export { useTrackKnownPlayers } from "./useTrackKnownPlayers";
export { useGameMusic } from "./useGameMusic";
export { bgMusic, SFX } from "./BackgroundMusicPlayer";
export { updateSessionFields } from "./sessionHelpers";
export {
  simpleMove,
  postGameComment,
  type AIMoveResult,
  type AICommentResult,
} from "./AIPlayerManager";
export { getAIAuthHeaders } from "./getAIAuthHeaders";
export {
  generatePostGameComments,
  generatePostGameCommentsForUid,
  type PostGameCommentsInput,
} from "./aiPostGameComments";
export {
  aiHistoryTierForLevel,
  sliceHistoryByTier,
  sliceHistoryForLevel,
  pickByRankedRoll,
  TIER_PROMPT_DIRECTIVE,
  type AIHistoryTier,
} from "./aiSkillDice";
export { SketchCanvas, type SketchCanvasRef } from "./SketchCanvas";
export {
  GameGamertagBadge,
  type GameGamertagBadgeProps,
} from "./GameGamertagBadge";
export { InviteKnownPlayersModal } from "./InviteKnownPlayersModal";
export { InviteAIModal } from "./InviteAIModal";
export { PickAIOpponentModal } from "./PickAIOpponentModal";
export {
  AI_PERSONAS,
  isAiPlayer,
  aiDisplayName,
  getPersona,
  AI_IDS,
  PLAY_STYLE_COLORS,
  type AIPersona,
  type AIPersonaStats,
  type AIPlayStyle,
} from "./aiPersonas";
export { AIPersonaGrid, type AIPersonaGridItem } from "./AIPersonaGrid";
export { GameSectionHeader } from "./GameSectionHeader";
export { GamePrimaryButton } from "./GamePrimaryButton";
export { GameStatusMessage } from "./GameStatusMessage";
export { useAutosave, SavedFlash } from "./useAutosave";
export { recordGameStats } from "./recordGameStats";
export {
  TEAM_NAMES,
  type TeamName,
  type TeamIdentity,
  getTeamLogoUrl,
  pickRandomTeams,
} from "./teams";
export { GameBgUnderlay, type GameBgUnderlayProps } from "./GameBgUnderlay";
export {
  type GameLengthPreset,
  resolvePreset,
} from "./gameLengthPresets";

// ─── GameCore Factory ──────────────────────────────────────
export { GameColorsProvider, useGameColors, colorsFromGameData, type GameColors } from "./GameColorsProvider";
export { composeGame } from "./composeGame";
export { useGameFlow } from "./useGameFlow";
export {
  type GCSlot,
  type VariantMeta,
  type GameAssembly,
  type GameEndResult,
  type GC3Props,
  type ComposeGameInput,
  type GameFlowPhase,
  type EngineSkinLoadError,
  GC_SLOT_LABELS,
  getAllVariants,
  getVariantsForSlot,
} from "./registry";
