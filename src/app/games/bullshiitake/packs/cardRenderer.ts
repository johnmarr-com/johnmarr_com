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
const FONT_FAMILY = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const QUESTION = "True, Partly True, or Bull Shiitake?";
const LINE_HEIGHT = 1.4;

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
  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(cardId, ID_BOX.x + ID_BOX.w / 2, ID_BOX.y + ID_BOX.h / 2 + 1);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

/** Render the full card; resolves to a lossless PNG blob (900×1500). */
export async function renderBullshiitakeCard(input: CardRenderInput): Promise<Blob> {
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
