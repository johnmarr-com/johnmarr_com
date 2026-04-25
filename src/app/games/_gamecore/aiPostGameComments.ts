// Post-game comments — one LLM call per AI player at game end.
//
// For procedural games (Boaty, Fyve) that don't narrate move-by-move, this
// produces a short in-character recap from the AI persona's POV. Heading:
// "{PersonaName}'s Post-Game Comments".
//
// The caller assembles a plain-text summary of what happened (an event log,
// scoreboard, whatever makes sense for the game) and passes it as
// `gameContext`. This module stays game-agnostic.

import { postGameComment } from "./AIPlayerManager";
import { getPersona, type AIPersona } from "./aiPersonas";

export interface PostGameCommentsInput {
  /** The AI persona to write in character. */
  persona: Pick<AIPersona, "id" | "name" | "prompt" | "voice" | "skillLevel" | "playStyle">;
  /** "won" | "lost" | "draw" — the outcome of the game from this AI's POV. */
  outcome: "won" | "lost" | "draw";
  /** Final score (this AI / opponent), if applicable. Free-form text. */
  score?: string;
  /** Plain-text summary of what happened during the game.
   * e.g. a numbered event log, scoreboard snapshot, notable moments. */
  gameContext: string;
  /** Name of the game for framing. e.g. "Boaty". */
  gameName: string;
}

/**
 * Generate a short post-game comment (a paragraph or two) from the persona's
 * POV. Returns an empty string if the LLM call fails — callers should handle
 * empty gracefully (don't render the card).
 */
export async function generatePostGameComments(
  input: PostGameCommentsInput,
): Promise<string> {
  const { persona, outcome, score, gameContext, gameName } = input;

  const lines: string[] = [];
  lines.push(
    `You just finished a game of ${gameName} as ${persona.name}.`,
  );
  lines.push(
    outcome === "won"
      ? `You WON.`
      : outcome === "lost"
        ? `You LOST.`
        : `The game ended in a draw.`,
  );
  if (score) lines.push(`Score: ${score}.`);
  lines.push("");
  lines.push(`Here is the full game, turn by turn:`);
  lines.push(gameContext);
  lines.push("");
  lines.push(
    `Write your Post-Game Comments — a short paragraph or two in character, ` +
      `reflecting on how the game went from your point of view. Reference ` +
      `specific moments from the game above that fit your voice. Do not ` +
      `list moves; react to them. Stay in character throughout. 2-4 sentences.`,
  );

  const prompt = lines.join("\n");
  const { comment } = await postGameComment(prompt, persona.prompt, persona.voice);
  return (comment ?? "").trim();
}

/**
 * Convenience: build input from a persona uid + the rest. Looks up persona.
 * Returns empty string if persona isn't found in the in-memory cache.
 */
export async function generatePostGameCommentsForUid(
  aiUid: string,
  input: Omit<PostGameCommentsInput, "persona">,
): Promise<string> {
  const persona = getPersona(aiUid);
  if (!persona) return "";
  return generatePostGameComments({ ...input, persona });
}
