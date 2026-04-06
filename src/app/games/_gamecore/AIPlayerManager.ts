export interface AIMoveResult {
  action: string;
  reason: string;
}

export interface AICommentResult {
  comment: string;
}

/**
 * Sends a prompt to the AI and parses a structured move response.
 * Expects the AI to respond with:
 *   REASONING: <brief explanation>
 *   ACTION: <the move>
 *
 * Returns { action, reason }. On failure returns { action: "", reason: "" }.
 */
export async function simpleMove(prompt: string): Promise<AIMoveResult> {
  try {
    const res = await fetch("/api/games/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, type: "move" }),
    });
    const { text } = (await res.json()) as { text: string };
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
 * Expects the AI to respond with free-form text (no structured format).
 *
 * Returns { comment }. On failure returns { comment: "" }.
 */
export async function postGameComment(prompt: string): Promise<AICommentResult> {
  try {
    const res = await fetch("/api/games/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, type: "comment" }),
    });
    const { text } = (await res.json()) as { text: string };
    return { comment: text || "" };
  } catch {
    return { comment: "" };
  }
}
