"use client";

import { uploadSketch } from "@/lib/game-sketches";
import { getPlayerQueue, type Chains, type ChainEntry, type PlayerTask } from "./chainEngine";
import { appendChainEntry } from "./useSketchinessSession";

const AI_DELAY_MS = 3000;

/**
 * Interpret a sketch image using Claude vision.
 */
async function aiGuess(imageUrl: string): Promise<string> {
  try {
    const res = await fetch("/api/games/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "vision", imageUrl }),
    });
    const data = await res.json();
    return data.text || "mysterious object";
  } catch {
    return "mysterious object";
  }
}

/**
 * Generate a sketch image via Replicate, download it, and return as a JPEG blob.
 */
async function aiSketch(subject: string): Promise<Blob> {
  try {
    const res = await fetch("/api/games/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "sketch", subject }),
    });
    const data = await res.json();
    const imageUrl = data.imageUrl;

    if (imageUrl) {
      const imgRes = await fetch(imageUrl);
      if (imgRes.ok) return imgRes.blob();
    }
  } catch {
    // fall through to fallback
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
): Promise<void> {
  const tasks = getPlayerQueue(aiPlayerId, chains, playOrder);
  if (tasks.length === 0) return;

  // Process one task at a time with a delay
  const task = tasks[0]!;
  await delay(AI_DELAY_MS);
  await processAiTask(task, aiPlayerId, sessionId, chains);
}

async function processAiTask(
  task: PlayerTask,
  aiPlayerId: string,
  sessionId: string,
  chains: Chains,
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
    const url = await uploadSketch(sessionId, task.elementIndex, task.stepIndex, blob);
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
