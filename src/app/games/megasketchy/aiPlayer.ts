"use client";

import { uploadSketch } from "@/lib/game-sketches";
import { getPlayerQueue, type Chains, type ChainEntry, type PlayerTask } from "./chainEngine";
import { appendChainEntry } from "./useMegaSketchySession";

const AI_DELAY_MS = 2000;
const AI_STAGGER_MS = 1500;
const AI_TIMEOUT_MS = 20_000;

/**
 * Fire AI request(s) and return the first valid result.
 * When `parallel` is true (default), fires 2 calls via Promise.any for speed.
 * When false, fires a single call to reduce API load (used when many AI are active).
 */
async function fetchAIRace<T>(
  body: Record<string, unknown>,
  extract: (data: Record<string, unknown>) => T | null,
  parallel = true,
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

  const calls = parallel ? [attempt(), attempt()] : [attempt()];

  try {
    const result = await Promise.any(calls);
    controllers.forEach((c) => c.abort());
    return result;
  } catch {
    controllers.forEach((c) => c.abort());
    return null;
  }
}

async function aiGuess(imageUrl: string, parallel: boolean): Promise<string> {
  const text = await fetchAIRace(
    { type: "vision", imageUrl },
    (data) => (typeof data["text"] === "string" && data["text"]) || null,
    parallel,
  );
  return text || "mysterious object";
}

async function aiSketch(subject: string, parallel: boolean): Promise<Blob> {
  const imageUrl = await fetchAIRace(
    { type: "sketch", subject },
    (data) => (typeof data["imageUrl"] === "string" && data["imageUrl"]) || null,
    parallel,
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

interface AiTask extends PlayerTask {
  aiId: string;
}

/**
 * Drain all pending AI tasks sequentially with staggered delays.
 * When multiple AI players are active, each call is single-fire (no parallel
 * race) to avoid overwhelming the API. A 1-player AI game still double-fires
 * for speed. Tasks are processed one at a time with a short stagger between
 * them to spread the load.
 */
export async function processAiQueue(
  aiPlayerIds: string[],
  sessionId: string,
  chains: Chains,
  playOrder: string[],
  round: number,
): Promise<void> {
  const allTasks: AiTask[] = [];
  for (const aiId of aiPlayerIds) {
    for (const task of getPlayerQueue(aiId, chains, playOrder)) {
      allTasks.push({ ...task, aiId });
    }
  }

  if (allTasks.length === 0) return;

  const useParallel = aiPlayerIds.length <= 1;

  for (let i = 0; i < allTasks.length; i++) {
    const task = allTasks[i]!;
    await delay(i === 0 ? AI_DELAY_MS : AI_STAGGER_MS);

    let entry: ChainEntry;

    if (task.taskType === "guess") {
      const guess = await aiGuess(task.input.value, useParallel);
      entry = {
        type: "text",
        value: guess,
        playerId: task.aiId,
        timestamp: Date.now(),
      };
    } else {
      const blob = await aiSketch(task.input.value, useParallel);
      const url = await uploadSketch(sessionId, task.elementIndex, task.stepIndex, blob, round);
      entry = {
        type: "image",
        value: url,
        playerId: task.aiId,
        timestamp: Date.now(),
      };
    }

    const chain = chains[String(task.elementIndex)] ?? [];
    await appendChainEntry(sessionId, task.elementIndex, entry, chain);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
