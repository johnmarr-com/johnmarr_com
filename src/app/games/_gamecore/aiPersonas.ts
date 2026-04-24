export type AIPlayStyle =
  | "aggressive"
  | "cautious"
  | "creative"
  | "analytical"
  | "chaotic"
  | "balanced";

/**
 * AI difficulty is the same numeric continuum as the player levels (1–10+).
 * Personas are assigned to any level; algorithmic strength is dispatched from
 * level-ranges so adding a new level later doesn't require a new category.
 */
export type AISkillLevel = number;

/** Fallback when a persona doc predates the `skillLevel` field. */
export const DEFAULT_AI_SKILL_LEVEL = 7; // Champion

/** Level → engine tier. Keep in sync with any game-side AI dispatcher. */
export type AIEngineTier = "basic" | "standard" | "sharp";

export function aiEngineTierForLevel(level: number): AIEngineTier {
  if (level <= 3) return "basic";
  if (level <= 7) return "standard";
  return "sharp";
}

export interface AIPersonaStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
}

export interface AIPersona {
  id: string;
  name: string;
  playStyle: AIPlayStyle;
  /** User-level from /levels (1..10+). Missing = treat as Champion (7). */
  skillLevel?: number | undefined;
  description: string;
  avatarName?: string | undefined;
  prompt?: string | undefined;
  voice?: string | undefined;
  avatarScale?: number | undefined;
  stats?: AIPersonaStats | undefined;
}

// Hardcoded fallback roster — used when DB is unavailable
const FALLBACK_PERSONAS: AIPersona[] = [
  { id: "ai-viper", name: "Agent VIPER", playStyle: "aggressive", description: "Ruthless and direct. Always goes for the kill shot." },
  { id: "ai-blaze", name: "Agent BLAZE", playStyle: "aggressive", description: "Explosive opener. Pushes tempo from the very first move." },
  { id: "ai-fang", name: "Agent FANG", playStyle: "aggressive", description: "Relentless pressure. Never lets up, never backs down." },
  { id: "ai-sage", name: "Agent SAGE", playStyle: "cautious", description: "Patient and methodical. Waits for the perfect moment." },
  { id: "ai-shield", name: "Agent SHIELD", playStyle: "cautious", description: "Defensive specialist. Minimises risk at every turn." },
  { id: "ai-frost", name: "Agent FROST", playStyle: "cautious", description: "Ice cold under pressure. Never makes a reckless move." },
  { id: "ai-prism", name: "Agent PRISM", playStyle: "creative", description: "Unconventional thinker. Finds angles no one else sees." },
  { id: "ai-echo", name: "Agent ECHO", playStyle: "creative", description: "Mirrors and remixes opponents' own strategies against them." },
  { id: "ai-neon", name: "Agent NEON", playStyle: "creative", description: "Flashy and inventive. Style points matter." },
  { id: "ai-drift", name: "Agent DRIFT", playStyle: "creative", description: "Fluid and unpredictable. Shifts approach mid-game." },
  { id: "ai-cipher", name: "Agent CIPHER", playStyle: "analytical", description: "Pattern decoder. Reads the board three moves ahead." },
  { id: "ai-core", name: "Agent CORE", playStyle: "analytical", description: "Pure logic. Emotion never enters the equation." },
  { id: "ai-atlas", name: "Agent ATLAS", playStyle: "analytical", description: "Maps every possibility. Plays the highest-probability move." },
  { id: "ai-flux", name: "Agent FLUX", playStyle: "chaotic", description: "Wildcard. Even they don't know what they'll do next." },
  { id: "ai-jinx", name: "Agent JINX", playStyle: "chaotic", description: "Thrives in disorder. The messier the game, the better." },
  { id: "ai-glitch", name: "Agent GLITCH", playStyle: "chaotic", description: "Does the mathematically worst move... on purpose." },
  { id: "ai-havoc", name: "Agent HAVOC", playStyle: "chaotic", description: "Plays to create maximum confusion for everyone." },
  { id: "ai-cobalt", name: "Agent COBALT", playStyle: "balanced", description: "Well-rounded and adaptable. No obvious weakness." },
  { id: "ai-apex", name: "Agent APEX", playStyle: "balanced", description: "Peak performance. Adjusts strategy to match the situation." },
  { id: "ai-volt", name: "Agent VOLT", playStyle: "balanced", description: "Quick thinker with a steady hand. Reliable in any scenario." },
];

// ─────────────────────────────────────────────────────────────
// DYNAMIC PERSONA LOADING
// ─────────────────────────────────────────────────────────────

let _cached: AIPersona[] = FALLBACK_PERSONAS;
let _personaMap = new Map(_cached.map((p) => [p.id, p]));

function rebuildMap() {
  _personaMap = new Map(_cached.map((p) => [p.id, p]));
}

/**
 * Load personas from Firestore. Falls back to hardcoded list only on failure.
 * Always fetches fresh so newly-created personas appear immediately.
 */
export async function loadPersonasFromDB(): Promise<AIPersona[]> {
  try {
    const { getActiveAIPersonas } = await import("@/lib/ai-personas");
    const docs = await getActiveAIPersonas();
    if (docs.length > 0) {
      _cached = docs.map((d) => ({
        id: `ai-${d.id}`,
        name: d.name,
        playStyle: d.playStyle,
        skillLevel: d.skillLevel ?? undefined,
        description: d.description,
        avatarName: d.avatarName || undefined,
        prompt: d.prompt || undefined,
        voice: d.voice || undefined,
        avatarScale: d.avatarScale && d.avatarScale !== 1.0 ? d.avatarScale : undefined,
        stats: d.stats ? { gamesPlayed: d.stats.gamesPlayed, wins: d.stats.wins, losses: d.stats.losses } : undefined,
      }));
      rebuildMap();
    }
  } catch {
    // Keep fallback on network/auth error
  }
  return _cached;
}

/** Returns the current persona list (DB if loaded, fallback otherwise). */
export function getLoadedPersonas(): AIPersona[] {
  return _cached;
}

// Static export for backwards compatibility — returns current cached list
export const AI_PERSONAS = FALLBACK_PERSONAS;

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

export function isAiPlayer(uid: string): boolean {
  return uid.startsWith("ai-");
}

export function aiDisplayName(uid: string): string {
  return _personaMap.get(uid)?.name ?? "Agent AI";
}

export function getPersona(uid: string): AIPersona | undefined {
  return _personaMap.get(uid);
}

export const AI_IDS = FALLBACK_PERSONAS.map((p) => p.id);

export const PLAY_STYLE_COLORS: Record<AIPlayStyle, string> = {
  aggressive: "text-red-400 bg-red-500/15",
  cautious: "text-blue-400 bg-blue-500/15",
  creative: "text-purple-400 bg-purple-500/15",
  analytical: "text-cyan-400 bg-cyan-500/15",
  chaotic: "text-yellow-400 bg-yellow-500/15",
  balanced: "text-emerald-400 bg-emerald-500/15",
};
