/**
 * Shared team identity system — names & logos for any game.
 *
 * Every name has a matching grayscale logo at
 * `/public/images/teams/Team-{name}.jpg` (square, meant to be
 * rendered as a circle with an applied team-color tint).
 */

// ─── Team Name Pool ────────────────────────────────────────

export const TEAM_NAMES = [
  "Ghosts", "Phantoms", "Reapers", "Wraiths", "Shadows", "Zombies", "Goblins", "Spooks",
  "Angels", "Devils", "Titans", "Dragons", "Kraken", "Hydras",
  "Misfits", "Mutants", "Freaks", "Skulls", "Exiles", "Outcasts", "Rebels", "Bandits",
  "Warcraft", "Denizens", "Outlaws", "Alliance", "Insidious", "Saviors", "Hellions", "Vigilantes", "Equalizers",
  "Ronin", "Hackers", "Vandals", "Hunters", "Savants", "Aces", "Ringers", "Sleepers", 
  "Saints", "Mavericks", "Defenders", "Guardians", "Fixers", "Clerics", "Erasers", 
  "Crows", "Falcons", "Raptors", "Hounds",
  "Hoods", "Rising", "Plague", "Fury", "Rascals", "Sneakers",
  "Tower",
] as const;

export type TeamName = (typeof TEAM_NAMES)[number];

// ─── Team Identity ─────────────────────────────────────────

export interface TeamIdentity {
  name: TeamName;
  logoUrl: string;
}

/** Return the logo URL for a team name. */
export function getTeamLogoUrl(name: TeamName): string {
  return `/images/teams/Team-${name}.jpg`;
}

// ─── Random Selection ──────────────────────────────────────

/**
 * Pick `count` unique random teams from the pool.
 *
 * @param count - How many teams to pick (must be ≤ pool size).
 * @returns An array of `TeamIdentity` objects with no duplicates.
 */
export function pickRandomTeams(count: number): TeamIdentity[] {
  const shuffled = [...TEAM_NAMES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((name) => ({
    name,
    logoUrl: getTeamLogoUrl(name),
  }));
}
