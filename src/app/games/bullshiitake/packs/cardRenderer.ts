"use client";

/**
 * Print-ready Bull Shiitake card renderer.
 *
 * Composes a 900×1500 PNG on a client-side canvas:
 *   1. white background
 *   2. story banner at (112,113) 677×338
 *   3. full-card overlay PNG (public/games/bullshiitake/BS-Card-Overlay.png)
 *   4. card ID (e.g. "B-4") — bold, filling the (664,123) 114×53 box
 *   5. story text in the (200,500) 500×700 box — justified (last line of each
 *      paragraph left), auto-sized to fit, vertically centered, followed by a
 *      blank line and the bold question "True, Partly True, or Bull Shiitake?"
 *
 * The banner is drawn with crossOrigin=anonymous (Firebase Storage serves
 * CORS headers) so the canvas stays untainted and exportable.
 */

const CARD_W = 900;
const CARD_H = 1500;

const BANNER = { x: 112, y: 113, w: 677, h: 338 };
const ID_BOX = { x: 664, y: 123, w: 114, h: 53 };
const STORY_BOX = { x: 200, y: 500, w: 500, h: 700 };

const OVERLAY_SRC = "/games/bullshiitake/BS-Card-Overlay.png";
const QUESTION = "True, Partly True, or Bull Shiitake?";
const LINE_HEIGHT = 1.4;

// Crimson Pro — the site's body serif. Bundled as a variable-weight woff2 and
// registered under our own family name so renders don't depend on next/font's
// mangled names or on whatever fonts the generating machine has installed.
const FONT_FAMILY = '"Crimson Pro Card", "Crimson Pro", Georgia, serif';
const FONT_SRC = "/fonts/crimson-pro-latin.woff2";

let fontReady: Promise<void> | null = null;

/** Load the bundled card font once per session; falls back to serif on error. */
function ensureCardFont(): Promise<void> {
  fontReady ??= (async () => {
    try {
      const face = new FontFace("Crimson Pro Card", `url(${FONT_SRC})`, {
        weight: "400 700",
      });
      await face.load();
      document.fonts.add(face);
    } catch (err) {
      console.warn("[cards] card font failed to load — using fallback serif:", err);
    }
  })();
  return fontReady;
}

export interface CardRenderInput {
  /** Physical lookup ID rendered on the card, e.g. "B-4". */
  cardId: string;
  /** The story as presented (short form when available). */
  storyText: string;
  /** 2:1 banner URL; the slot stays blank when absent. */
  bannerURL?: string | undefined;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src.slice(0, 80)}`));
    img.src = src;
  });
}

/** Greedy word-wrap for the current ctx.font. */
function wrapWords(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[][] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[][] = [];
  let line: string[] = [];
  for (const word of words) {
    const candidate = [...line, word].join(" ");
    if (line.length > 0 && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = [word];
    } else {
      line.push(word);
    }
  }
  if (line.length) lines.push(line);
  return lines;
}

interface LaidOutBlock {
  fontSize: number;
  /** Story lines with a justify flag (last line of each paragraph stays left). */
  storyLines: { words: string[]; justify: boolean }[];
  questionLines: string[][];
}

/** Find the largest font size whose full block fits the story box. */
function layoutStory(ctx: CanvasRenderingContext2D, storyText: string): LaidOutBlock {
  const paragraphs = storyText
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  for (let size = 42; size >= 12; size--) {
    ctx.font = `${size}px ${FONT_FAMILY}`;
    const storyLines: { words: string[]; justify: boolean }[] = [];
    let tooWide = false;
    for (const para of paragraphs) {
      const lines = wrapWords(ctx, para, STORY_BOX.w);
      lines.forEach((words, i) => {
        if (words.length === 1 && ctx.measureText(words[0]!).width > STORY_BOX.w) tooWide = true;
        storyLines.push({ words, justify: i < lines.length - 1 });
      });
    }

    ctx.font = `bold ${size}px ${FONT_FAMILY}`;
    const questionLines = wrapWords(ctx, QUESTION, STORY_BOX.w);

    // Story rows + one blank row (the "two line breaks") + question rows.
    const rows = storyLines.length + 1 + questionLines.length;
    const blockHeight = rows * size * LINE_HEIGHT;
    if (!tooWide && blockHeight <= STORY_BOX.h) {
      return { fontSize: size, storyLines, questionLines };
    }
  }
  // Floor size — draw anyway rather than fail (extreme texts only).
  ctx.font = `12px ${FONT_FAMILY}`;
  return {
    fontSize: 12,
    storyLines: paragraphs.flatMap((p) =>
      wrapWords(ctx, p, STORY_BOX.w).map((words, i, all) => ({
        words,
        justify: i < all.length - 1,
      })),
    ),
    questionLines: wrapWords(ctx, QUESTION, STORY_BOX.w),
  };
}

/** Draw one line; justified lines distribute leftover width between words. */
function drawLine(
  ctx: CanvasRenderingContext2D,
  words: string[],
  x: number,
  y: number,
  justify: boolean,
): void {
  if (!justify || words.length < 2) {
    ctx.fillText(words.join(" "), x, y);
    return;
  }
  const naturalWidth = ctx.measureText(words.join(" ")).width;
  const spaceWidth = ctx.measureText(" ").width;
  const extra = (STORY_BOX.w - naturalWidth) / (words.length - 1);
  let cursor = x;
  for (const word of words) {
    ctx.fillText(word, cursor, y);
    cursor += ctx.measureText(word).width + spaceWidth + extra;
  }
}

/** Bold ID (e.g. "B-4") filling most of its box height, centered both ways. */
function drawCardId(ctx: CanvasRenderingContext2D, cardId: string): void {
  let size = Math.floor(ID_BOX.h * 0.85);
  ctx.font = `bold ${size}px ${FONT_FAMILY}`;
  while (size > 10 && ctx.measureText(cardId).width > ID_BOX.w - 6) {
    size--;
    ctx.font = `bold ${size}px ${FONT_FAMILY}`;
  }
  // Game-primary orange — the ID box sits on a black area of the overlay.
  ctx.fillStyle = "#F97316";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(cardId, ID_BOX.x + ID_BOX.w / 2, ID_BOX.y + ID_BOX.h / 2 + 1);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

/** Render the full card; resolves to a lossless PNG blob (900×1500). */
export async function renderBullshiitakeCard(input: CardRenderInput): Promise<Blob> {
  await ensureCardFont();
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  // 1. White base
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // 2. Banner (skipped cleanly when the story has none)
  if (input.bannerURL) {
    const banner = await loadImage(input.bannerURL);
    ctx.drawImage(banner, BANNER.x, BANNER.y, BANNER.w, BANNER.h);
  }

  // 3. Overlay frame
  const overlay = await loadImage(OVERLAY_SRC);
  ctx.drawImage(overlay, 0, 0, CARD_W, CARD_H);

  // 4. Card ID
  drawCardId(ctx, input.cardId);

  // 5. Story block — auto-sized, vertically centered
  const block = layoutStory(ctx, input.storyText);
  const { fontSize, storyLines, questionLines } = block;
  const lineStep = fontSize * LINE_HEIGHT;
  const rows = storyLines.length + 1 + questionLines.length;
  let y = STORY_BOX.y + (STORY_BOX.h - rows * lineStep) / 2 + fontSize; // first baseline

  ctx.fillStyle = "#000000";
  ctx.font = `${fontSize}px ${FONT_FAMILY}`;
  for (const line of storyLines) {
    drawLine(ctx, line.words, STORY_BOX.x, y, line.justify);
    y += lineStep;
  }
  y += lineStep; // the blank row
  ctx.font = `bold ${fontSize}px ${FONT_FAMILY}`;
  for (const words of questionLines) {
    drawLine(ctx, words, STORY_BOX.x, y, false);
    y += lineStep;
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Card export failed"))),
      "image/png",
    );
  });
}

// ─── Answer cards ───────────────────────────────────────────
// One card per 20-story block: the BS-Answers background, the covered range
// top-right, and a 2×10 answer table on the black panel (no cell chrome).

const ANSWERS_SRC = "/games/bullshiitake/BS-Answers.png";
const RANGE_BOX = { x: 485, y: 176, w: 280, h: 60 };
const TABLE = { x: 146, y: 288, w: 600, h: 900 };
const TABLE_COLS = 2;
const TABLE_ROWS = 10;
const CELL_PAD_X = 10;
const CELL_PAD_Y = 6;

const VERDICT: Record<string, { text: string; color: string }> = {
  true: { text: "TRUE", color: "#4ADE80" },
  partlytrue: { text: "PARTLY TRUE:", color: "#FACC15" },
  bullshiitake: { text: "BULL SHIITAKE", color: "#F97316" },
};

export interface AnswerEntry {
  /** Card ID as printed, e.g. "B-14". */
  label: string;
  bsType: "true" | "partlytrue" | "bullshiitake";
  /** Short correction (falls back to the long one) — Partly True only. */
  correction?: string | undefined;
}

export interface AnswerCardInput {
  /** Range headline, e.g. "B-1 to B-20". */
  rangeLabel: string;
  /** Up to 20 entries, in searchID order — filled column-first (1–10 left). */
  entries: AnswerEntry[];
}

/** One styled run of text; cells flow tokens inline with word-wrap. */
interface Token {
  text: string;
  color: string;
  bold: boolean;
  /** Font size multiplier (card IDs render larger). */
  scale: number;
}

function cellTokens(entry: AnswerEntry): Token[] {
  const verdict = VERDICT[entry.bsType] ?? VERDICT["bullshiitake"]!;
  const tokens: Token[] = [
    { text: entry.label, color: "#FFFFFF", bold: true, scale: 1.15 },
    { text: verdict.text, color: verdict.color, bold: true, scale: 1 },
  ];
  if (entry.bsType === "partlytrue" && entry.correction?.trim()) {
    for (const word of entry.correction.trim().split(/\s+/)) {
      tokens.push({ text: word, color: "#FFFFFF", bold: false, scale: 1 });
    }
  }
  return tokens;
}

function tokenFont(t: Token, size: number): string {
  return `${t.bold ? "bold " : ""}${Math.round(size * t.scale)}px ${FONT_FAMILY}`;
}

/** Greedy inline wrap of styled tokens at the given base size. */
function wrapTokens(
  ctx: CanvasRenderingContext2D,
  tokens: Token[],
  size: number,
  maxWidth: number,
): Token[][] {
  const lines: Token[][] = [];
  let line: Token[] = [];
  let lineWidth = 0;
  for (const token of tokens) {
    ctx.font = tokenFont(token, size);
    const w = ctx.measureText(token.text).width;
    const space = line.length ? ctx.measureText(" ").width : 0;
    if (line.length && lineWidth + space + w > maxWidth) {
      lines.push(line);
      line = [token];
      lineWidth = w;
    } else {
      line.push(token);
      lineWidth += space + w;
    }
  }
  if (line.length) lines.push(line);
  return lines;
}

/** Render one answer card; resolves to a 900×1500 PNG blob. */
export async function renderBullshiitakeAnswerCard(input: AnswerCardInput): Promise<Blob> {
  await ensureCardFont();
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  // Background
  const bg = await loadImage(ANSWERS_SRC);
  ctx.drawImage(bg, 0, 0, CARD_W, CARD_H);

  // Range headline — large bold orange, centered in its box
  let rangeSize = Math.floor(RANGE_BOX.h * 0.8);
  ctx.font = `bold ${rangeSize}px ${FONT_FAMILY}`;
  while (rangeSize > 12 && ctx.measureText(input.rangeLabel).width > RANGE_BOX.w - 8) {
    rangeSize--;
    ctx.font = `bold ${rangeSize}px ${FONT_FAMILY}`;
  }
  ctx.fillStyle = "#F97316";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(input.rangeLabel, RANGE_BOX.x + RANGE_BOX.w / 2, RANGE_BOX.y + RANGE_BOX.h / 2 + 1);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  // Answer table — find the largest base size where EVERY cell fits its slot.
  const cellW = TABLE.w / TABLE_COLS;
  const cellH = TABLE.h / TABLE_ROWS;
  const innerW = cellW - CELL_PAD_X * 2;
  const innerH = cellH - CELL_PAD_Y * 2;
  const cells = input.entries.slice(0, TABLE_COLS * TABLE_ROWS).map(cellTokens);

  let size = 30;
  let layouts: Token[][][] = [];
  for (; size >= 10; size--) {
    layouts = cells.map((tokens) => wrapTokens(ctx, tokens, size, innerW));
    const fits = layouts.every((lines) => lines.length * size * 1.25 <= innerH);
    if (fits) break;
  }
  const lineStep = size * 1.25;

  // Column-first: entries 0–9 fill the left column, 10–19 the right.
  cells.forEach((_, i) => {
    const col = Math.floor(i / TABLE_ROWS);
    const row = i % TABLE_ROWS;
    const lines = layouts[i]!;
    const cellX = TABLE.x + col * cellW + CELL_PAD_X;
    const cellY = TABLE.y + row * cellH;
    let y =
      cellY + (cellH - lines.length * lineStep) / 2 + size; // first baseline, centered
    for (const line of lines) {
      let x = cellX;
      for (const token of line) {
        ctx.font = tokenFont(token, size);
        ctx.fillStyle = token.color;
        ctx.fillText(token.text, x, y);
        x += ctx.measureText(token.text).width + ctx.measureText(" ").width;
      }
      y += lineStep;
    }
  });

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Answer card export failed"))),
      "image/png",
    );
  });
}
