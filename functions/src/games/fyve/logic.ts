/**
 * FYVE — pure game logic (copied into the functions package; no `@/` alias).
 *
 * Heist-themed Codenames. 16-card board: 5 Syndicate-1 assets, 5 Syndicate-2
 * assets, 5 neutral civilians, 1 bomb. A team wins by revealing all 5 of its
 * assets; tapping the bomb hands the win to the other team. Assets reveal in
 * story order (not pre-assigned to positions) — only civilians + the bomb have
 * fixed board positions. Mirrors the original /api/games/fyve route logic so
 * behavior is preserved; the engine reducer now owns it.
 */

export type CardType = "T1" | "T2" | "N" | "BOMB";
export type FyveTeam = "syndicate1" | "syndicate2";

export const ASSETS_PER_TEAM = 5;
export const BOARD_SIZE = ASSETS_PER_TEAM * 3 + 1; // 16
export const MAX_CARD_INDEX = BOARD_SIZE - 1;

export const HEIST_ELEMENT_LABELS = [
  "Intel",
  "Insider",
  "Distract",
  "Escape",
  "Payday",
] as const;

// ─── Heist data subsets the reducer needs ───────────────────

export interface HeistWordPool {
  tier1: string[];
  tier2: string[];
  tier3: string[];
}

export interface HeistAsset {
  name: string;
  description: string;
  imageUrl: string;
  bombDescription?: string;
  bombImageUrl?: string;
  bombSoundEffect?: string;
}

export interface HeistCivilian {
  name: string;
  description: string;
  imageUrl: string;
}

// ─── Board cards ─────────────────────────────────────────────

export interface BoardCard {
  index: number;
  word: string;
  revealed: boolean;
  revealedType?: CardType;
  revealedName?: string;
  revealedDescription?: string;
  revealedImageUrl?: string;
  revealedAssetNumber?: number;
  revealedSoundEffect?: string;
  /** The team that tapped this card (active team at reveal time). */
  revealedByTeam?: FyveTeam;
}

// ─── Helpers ─────────────────────────────────────────────────

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export function coinFlipTeam(): FyveTeam {
  return Math.random() < 0.5 ? "syndicate1" : "syndicate2";
}

export function otherTeam(t: FyveTeam): FyveTeam {
  return t === "syndicate1" ? "syndicate2" : "syndicate1";
}

// ─── Board + key generation ──────────────────────────────────

export interface GeneratedBoard {
  /** 16 public cards (no color info). */
  board: BoardCard[];
  /** Secret key: key[i] is the type of board[i]. */
  key: CardType[];
  /** boardIndex → civilians[] index, for neutral positions. */
  civilianAssignments: Record<number, number>;
  /** Board index of the bomb. */
  bombIndex: number;
}

/**
 * Build the 16-card board + secret key from a heist's word pool. All words come
 * from the pool (no character names). Assets are NOT pre-assigned to positions —
 * they reveal in story order — so only civilians + the bomb get position maps.
 */
export function generateBoard(words: HeistWordPool): GeneratedBoard {
  const fullPool = [...words.tier1, ...words.tier2, ...words.tier3];
  const boardWords = shuffle(fullPool).slice(0, BOARD_SIZE);

  const keyTemplate: CardType[] = [
    ...Array<CardType>(ASSETS_PER_TEAM).fill("T1"),
    ...Array<CardType>(ASSETS_PER_TEAM).fill("T2"),
    ...Array<CardType>(ASSETS_PER_TEAM).fill("N"),
    "BOMB",
  ];
  const key = shuffle(keyTemplate);

  const civilianAssignments: Record<number, number> = {};
  const neutralPositions = key.map((k, i) => (k === "N" ? i : -1)).filter((i) => i >= 0);
  const shuffledCivIndices = shuffle([0, 1, 2, 3, 4]);
  neutralPositions.forEach((boardIdx, i) => {
    civilianAssignments[boardIdx] = shuffledCivIndices[i]!;
  });

  const bombIndex = key.indexOf("BOMB");

  const board: BoardCard[] = boardWords.map((word, i) => ({
    index: i,
    word,
    revealed: false,
  }));

  return { board, key, civilianAssignments, bombIndex };
}

// ─── Reveal resolution ───────────────────────────────────────

export interface RevealResult {
  cardType: CardType;
  name: string;
  description: string;
  imageUrl: string;
  /** For T1/T2: which asset number (1–5) for the owning team. */
  assetNumber?: number;
  /** For BOMB: per-element failure sound. */
  bombSoundEffect?: string;
}

/**
 * What a tapped card is + its display metadata. `t1RevealCount`/`t2RevealCount`
 * are the owning team's already-revealed counts (BEFORE this reveal). Pure.
 */
export function resolveCard(args: {
  key: CardType[];
  cardIndex: number;
  assets: HeistAsset[];
  civilians: HeistCivilian[];
  civilianAssignments: Record<number, number>;
  t1RevealCount: number;
  t2RevealCount: number;
  activeTeam: FyveTeam;
}): RevealResult {
  const { key, cardIndex, assets, civilians, civilianAssignments, t1RevealCount, t2RevealCount, activeTeam } = args;
  const cardType = key[cardIndex]!;

  if (cardType === "T1" || cardType === "T2") {
    const currentCount = cardType === "T1" ? t1RevealCount : t2RevealCount;
    const asset = assets[currentCount];
    return {
      cardType,
      name: asset?.name ?? "ASSET",
      description: asset?.description ?? "",
      imageUrl: asset?.imageUrl ?? "",
      assetNumber: currentCount + 1,
    };
  }

  if (cardType === "N") {
    const civIdx = civilianAssignments[cardIndex];
    const civ = civIdx != null ? civilians[civIdx] : undefined;
    return {
      cardType,
      name: civ?.name ?? "CIVILIAN",
      description: civ?.description ?? "",
      imageUrl: civ?.imageUrl ?? "",
    };
  }

  // BOMB — per-element failure based on the active team's progress.
  const elementIndex = activeTeam === "syndicate1" ? t1RevealCount : t2RevealCount;
  const elementAsset = assets[elementIndex];
  return {
    cardType: "BOMB",
    name: HEIST_ELEMENT_LABELS[elementIndex] ?? "THE BOMB",
    description: elementAsset?.bombDescription || "",
    imageUrl: elementAsset?.bombImageUrl || "",
    bombSoundEffect: elementAsset?.bombSoundEffect || "",
  };
}

// ─── Turn / score / win outcome ──────────────────────────────

export interface RevealOutcome {
  /** New owning-team reveal counts (the non-owning count is unchanged). */
  t1RevealCount: number;
  t2RevealCount: number;
  t1Score: number;
  t2Score: number;
  /** Whose turn after this reveal. */
  activeTeam: FyveTeam;
  /** Null when the turn switches (clue consumed). */
  clearClue: boolean;
  guessesRemaining: number;
  guessesUsedThisTurn: number;
  /** "boss-clue" (switch), "operative-guess" (continue), or "game-over". */
  nextPhase: "boss-clue" | "operative-guess" | "game-over";
  winningTeam: FyveTeam | null;
  loseByBomb: boolean;
}

/**
 * Apply a reveal to the turn/score state. Mirrors the original host logic
 * (handleRevealCard + handleRevealDismissed) collapsed into one atomic step:
 * a correct own-asset with guesses left continues the turn; a wrong/neutral
 * card, an exhausted clue, the bomb, or a 5th asset ends the turn or the game.
 */
export function applyReveal(args: {
  cardType: CardType;
  activeTeam: FyveTeam;
  t1RevealCount: number;
  t2RevealCount: number;
  guessesRemaining: number;
  guessesUsedThisTurn: number;
}): RevealOutcome {
  const { cardType, activeTeam } = args;
  let t1RevealCount = args.t1RevealCount;
  let t2RevealCount = args.t2RevealCount;
  const opp = otherTeam(activeTeam);

  // 1) Increment the owning team's count + check that team's win.
  let winningTeam: FyveTeam | null = null;
  if (cardType === "T1") {
    t1RevealCount += 1;
    if (t1RevealCount >= ASSETS_PER_TEAM) winningTeam = "syndicate1";
  } else if (cardType === "T2") {
    t2RevealCount += 1;
    if (t2RevealCount >= ASSETS_PER_TEAM) winningTeam = "syndicate2";
  } else if (cardType === "BOMB") {
    winningTeam = opp; // the guessing team loses
  }

  const base: RevealOutcome = {
    t1RevealCount,
    t2RevealCount,
    t1Score: t1RevealCount,
    t2Score: t2RevealCount,
    activeTeam,
    clearClue: false,
    guessesRemaining: args.guessesRemaining,
    guessesUsedThisTurn: args.guessesUsedThisTurn,
    nextPhase: "operative-guess",
    winningTeam,
    loseByBomb: cardType === "BOMB",
  };

  if (winningTeam) {
    return { ...base, nextPhase: "game-over", clearClue: true, guessesRemaining: 0, guessesUsedThisTurn: 0 };
  }

  const isOwnAsset =
    (activeTeam === "syndicate1" && cardType === "T1") ||
    (activeTeam === "syndicate2" && cardType === "T2");

  if (isOwnAsset) {
    const newRemaining = args.guessesRemaining - 1;
    if (newRemaining > 0) {
      // Correct, clue not yet exhausted → keep guessing.
      return { ...base, guessesRemaining: newRemaining, guessesUsedThisTurn: args.guessesUsedThisTurn + 1 };
    }
    // Correct but clue exhausted → switch.
    return { ...base, activeTeam: opp, clearClue: true, guessesRemaining: 0, guessesUsedThisTurn: 0, nextPhase: "boss-clue" };
  }

  // Wrong (opponent asset) or neutral → switch.
  return { ...base, activeTeam: opp, clearClue: true, guessesRemaining: 0, guessesUsedThisTurn: 0, nextPhase: "boss-clue" };
}
