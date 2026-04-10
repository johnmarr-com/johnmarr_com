const CLIENT_TIMEOUT_MS = 20_000;

export interface AIMoveResult {
  action: string;
  reason: string;
}

export interface AICommentResult {
  comment: string;
}

/**
 * Fire 2 identical AI requests in parallel and return the first valid response.
 * Aborts the loser. Falls back to { text: "" } if both fail.
 */
async function fetchAIRace(body: Record<string, unknown>): Promise<{ text: string }> {
  const controllers: AbortController[] = [];

  const attempt = async (): Promise<{ text: string }> => {
    const controller = new AbortController();
    controllers.push(controller);
    const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
    try {
      const res = await fetch("/api/games/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!data.text) throw new Error("empty response");
      return { text: data.text };
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
    return { text: "" };
  }
}

/**
 * Sends a prompt to the AI and parses a structured move response.
 * Fires 2 parallel requests and takes the first valid one.
 */
export async function simpleMove(prompt: string): Promise<AIMoveResult> {
  try {
    const { text } = await fetchAIRace({ prompt, type: "move" });
    if (!text) return { action: "", reason: "" };

    const reasonMatch = text.match(/REASONING:\s*([\s\S]+?)(?=\nACTION:)/i);
    const reason = reasonMatch ? reasonMatch[1]!.trim() : "";

    const actionMatch = text.match(/ACTION:\s*(.+)/i);
    const action = actionMatch ? actionMatch[1]!.trim() : "";

    return { action, reason };
  } catch {
    return { action: "", reason: "" };
  }
}

/**
 * Sends a prompt to the AI for a post-game comment.
 * Fires 2 parallel requests and takes the first valid one.
 */
export async function postGameComment(prompt: string): Promise<AICommentResult> {
  try {
    const { text } = await fetchAIRace({ prompt, type: "comment" });
    return { comment: text || "" };
  } catch {
    return { comment: "" };
  }
}
