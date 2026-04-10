"use client";

import { uploadSketch } from "@/lib/game-sketches";
import { getPlayerQueue, type Chains, type ChainEntry, type PlayerTask } from "./chainEngine";
import { appendChainEntry } from "./useSketchinessSession";

const AI_DELAY_MS = 3000;
const AI_TIMEOUT_MS = 20_000;

/**
 * Fire 2 identical AI requests in parallel and return the first valid result.
 * The `extract` function validates & extracts the desired value from the JSON
 * response — returning null signals an invalid response (triggering a retry
 * from the other call). Both AbortControllers are cleaned up once a winner
 * is determined.
 */
async function fetchAIRace<T>(
  body: Record<string, unknown>,
  extract: (data: Record<string, unknown>) => T | null,
): Promise<T | null> {
  const controllers: AbortController[] = [];

  const attempt = async (): Promise<T> => {
    const controller = new AbortController();
    controllers.push(controller);
    const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
    try {
      const res = await fetch("/api/games/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const data = await res.json();
      const result = extract(data);
      if (result === null) throw new Error("invalid response");
      return result;
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    const result = await Promise.any([attempt(), attempt()]);
    controllers.forEach((c) => c.abort());
    return result;
  } catch {
    controllers.forEach((c) => c.abort());
    return null;
  }
}

async function aiGuess(imageUrl: string): Promise<string> {
  const text = await fetchAIRace(
    { type: "vision", imageUrl },
    (data) => (typeof data["text"] === "string" && data["text"]) || null,
  );
  return text || "mysterious object";
}

async function aiSketch(subject: string): Promise<Blob> {
  const imageUrl = await fetchAIRace(
    { type: "sketch", subject },
    (data) => (typeof data["imageUrl"] === "string" && data["imageUrl"]) || null,
  );

  if (imageUrl) {
    try {
      const imgRes = await fetch(imageUrl);
      if (imgRes.ok) return imgRes.blob();
    } catch {
      // fall through to fallback
    }
  }

  return fallbackSketchBlob(subject);
}

function fallbackSketchBlob(subject: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = 720;
    canvas.height = 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return reject(new Error("No canvas context"));

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 720, 720);
    ctx.fillStyle = "#000000";
    ctx.font = "48px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(subject, 360, 360);
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/jpeg",
      0.85,
    );
  });
}

/**
 * Process all pending AI tasks in the queue.
 * Called by the host on each session update.
 */
export async function processAiQueue(
  aiPlayerId: string,
  sessionId: string,
  chains: Chains,
  playOrder: string[],
  round: number,
): Promise<void> {
  const tasks = getPlayerQueue(aiPlayerId, chains, playOrder);
  if (tasks.length === 0) return;

  const task = tasks[0]!;
  await delay(AI_DELAY_MS);
  await processAiTask(task, aiPlayerId, sessionId, chains, round);
}

async function processAiTask(
  task: PlayerTask,
  aiPlayerId: string,
  sessionId: string,
  chains: Chains,
  round: number,
): Promise<void> {
  let entry: ChainEntry;

  if (task.taskType === "guess") {
    const guess = await aiGuess(task.input.value);
    entry = {
      type: "text",
      value: guess,
      playerId: aiPlayerId,
      timestamp: Date.now(),
    };
  } else {
    const blob = await aiSketch(task.input.value);
    const url = await uploadSketch(sessionId, task.elementIndex, task.stepIndex, blob, round);
    entry = {
      type: "image",
      value: url,
      playerId: aiPlayerId,
      timestamp: Date.now(),
    };
  }

  const chain = chains[String(task.elementIndex)] ?? [];
  await appendChainEntry(sessionId, task.elementIndex, entry, chain);
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
