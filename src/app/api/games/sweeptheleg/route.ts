import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env["ANTHROPIC_API_KEY"],
});

interface MoveRecord {
  player: "H" | "M" | "L";
  opponent: "H" | "M" | "L";
  winner: "player" | "opponent" | "tie";
}

function buildSystemPrompt(aiSide: "red" | "white"): string {
  const playerSide = aiSide === "red" ? "White" : "Red";
  return `You are the ${aiSide.toUpperCase()} fighter in a martial-arts game. The human player is ${playerSide}. Each round both fighters simultaneously choose High, Mid, or Low.

WHAT BEATS WHAT:
- High beats Low (if opponent plays Low, you win with High)
- Mid beats High (if opponent plays High, you win with Mid)
- Low beats Mid (if opponent plays Mid, you win with Low)
- Same attack = tie

BONUS POINTS:
- Red scores 2 points (instead of 1) when Red plays Low and White plays Mid.
- White scores 2 points (instead of 1) when White plays Low and Red plays High.

First to 5 points wins. Study the player's patterns and choose the move most likely to beat them. Look for tendencies, repeats, sequences, and post-win/post-loss habits.

CRITICAL: Your ATTACK must match your reasoning. If you reason that you should counter their Low, your ATTACK must be High. If you reason that you should counter their High, your ATTACK must be Mid. If you reason you should counter their Mid, your ATTACK must be Low.

Format your response EXACTLY as:
REASONING: <1 brief sentence for the player to read after the game>
ATTACK: <High, Mid, or Low>`;
}

const ATTACK_NAMES: Record<string, "H" | "M" | "L"> = {
  high: "H",
  mid: "M",
  low: "L",
};

export async function POST(request: NextRequest) {
  try {
    const { history, playerSide, gameOver, aiWon } = (await request.json()) as {
      history: MoveRecord[];
      playerSide?: "red" | "white";
      gameOver?: boolean;
      aiWon?: boolean;
    };
    const aiSide = playerSide === "white" ? "red" : "white";
    const nameMap: Record<string, string> = { H: "High", M: "Mid", L: "Low" };

    const historyLines = (history || []).map((move, i) => {
      const result =
        move.winner === "tie" ? "Tie" : move.winner === "player" ? "Player won" : "You won";
      return `Round ${i + 1}: Player=${nameMap[move.player]}, You=${nameMap[move.opponent]} → ${result}`;
    });

    if (gameOver) {
      const summaryPrompt = `${buildSystemPrompt(aiSide)}

Full match history:
${historyLines.join("\n")}

The game is over. ${aiWon ? "You won!" : "You lost."} Give a brief post-game comment (1-2 sentences) reflecting on the match — what patterns you noticed, what worked or didn't, and whether the player surprised you. Be conversational and a good sport. Reply with ONLY your comment, nothing else.`;

      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        temperature: 0.7,
        messages: [{ role: "user", content: summaryPrompt }],
      });

      const content = response.content[0];
      const comment = content?.type === "text" ? content.text.trim() : "";
      console.log(`[AI] Post-game: ${comment}`);
      return NextResponse.json({ comment });
    }

    let prompt: string;
    if (!history || history.length === 0) {
      prompt = "This is the first round — no history yet. Pick your opening move.";
    } else {
      prompt = `Move history:\n${historyLines.join("\n")}\n\nRound ${history.length + 1} — what do you play?`;
    }

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      temperature: 0.3,
      messages: [{ role: "user", content: buildSystemPrompt(aiSide) + "\n\n" + prompt }],
    });

    const content = response.content[0];
    if (!content || content.type !== "text") {
      console.log("[AI] No text response, falling back to random");
      return NextResponse.json({ attack: randomFallback(), reasoning: "" });
    }

    const text = content.text.trim();
    console.log(`[AI] (${aiSide}) ${text}`);

    const reasoningMatch = text.match(/REASONING:\s*([\s\S]+?)(?=\nATTACK:)/i);
    const reasoning = reasoningMatch ? reasoningMatch[1]!.trim() : "";

    const attackMatch = text.match(/ATTACK:\s*(High|Mid|Low)/i);
    if (attackMatch) {
      const attack = ATTACK_NAMES[attackMatch[1]!.toLowerCase()]!;
      console.log(`[AI] → chose ${attackMatch[1]} (${attack})`);
      return NextResponse.json({ attack, reasoning });
    }

    const lastWord = text.split(/\s+/).pop()?.toLowerCase().replace(/[^a-z]/g, "");
    if (lastWord && lastWord in ATTACK_NAMES) {
      const attack = ATTACK_NAMES[lastWord]!;
      console.log(`[AI] → parsed fallback: ${attack}`);
      return NextResponse.json({ attack, reasoning });
    }

    console.log("[AI] Could not parse response, falling back to random");
    return NextResponse.json({ attack: randomFallback(), reasoning: "" });
  } catch (err) {
    console.error("[AI] Error:", err);
    return NextResponse.json({ attack: randomFallback(), reasoning: "" });
  }
}

function randomFallback(): "H" | "M" | "L" {
  const attacks: ("H" | "M" | "L")[] = ["H", "M", "L"];
  return attacks[Math.floor(Math.random() * 3)]!;
}
