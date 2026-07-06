/**
 * FYVE reducer liveness tests (SYSTEM-REVIEW items 9 + 12).
 *
 * Exercises the turn-deadline behavior added so an AFK player can't wedge a
 * match: self-arming deadlines, auto-pass on expiry, streak-based game end
 * for the score leader, and streak reset on real actions.
 */
import { describe, expect, it } from "vitest";
import "../src/games/fyve/fyve.spec"; // side-effect: registers the reducer
import { getReducer } from "../src/engine/registry";
import type { EngineSession, ReduceContext } from "../src/engine/types";

const reducer = getReducer("fyve");
const NOW = 1_800_000_000_000;

function session(overrides: Record<string, unknown>): EngineSession {
  return {
    status: "playing",
    engineKey: "fyve",
    playerUids: ["boss1", "op1", "boss2", "op2"],
    teams: {
      syndicate1: { members: ["boss1", "op1"], bossUid: "boss1" },
      syndicate2: { members: ["boss2", "op2"], bossUid: "boss2" },
    },
    activeTeam: "syndicate1",
    selectedHeistId: "heist-1",
    ...overrides,
  } as EngineSession;
}

function ctx(s: EngineSession, now = NOW): ReduceContext {
  return { session: s, sessionId: "test-session", now, secrets: {} };
}

describe("fyve turn deadlines", () => {
  it("self-arms a deadline when an active phase has none", () => {
    const out = reducer.reduce(ctx(session({ svPhase: "boss-clue" })));
    expect(out).not.toBeNull();
    expect(out!.fields["phaseDeadlineAt"]).toBe(NOW + 4 * 60_000);
  });

  it("does not fire before the deadline", () => {
    const s = session({ svPhase: "boss-clue", phaseDeadlineAt: NOW + 60_000 });
    // No inbox events, deadline in the future → nothing to do.
    expect(reducer.reduce(ctx(s))).toBeNull();
  });

  it("auto-passes the turn when a deadline expires", () => {
    const s = session({
      svPhase: "operative-guess",
      phaseDeadlineAt: NOW - 1,
      svTimeoutStreak: 0,
    });
    const out = reducer.reduce(ctx(s));
    expect(out).not.toBeNull();
    expect(out!.gameOver).toBeUndefined();
    expect(out!.fields["activeTeam"]).toBe("syndicate2");
    expect(out!.fields["svPhase"]).toBe("boss-clue");
    expect(out!.fields["svTimeoutStreak"]).toBe(1);
    expect(out!.fields["phaseDeadlineAt"]).toBe(NOW + 4 * 60_000);
  });

  it("ends the game for the score leader after the timeout streak", () => {
    const s = session({
      svPhase: "boss-clue",
      phaseDeadlineAt: NOW - 1,
      svTimeoutStreak: 3,
      t1Score: 3,
      t2Score: 1,
    });
    const out = reducer.reduce(ctx(s));
    expect(out).not.toBeNull();
    expect(out!.gameOver).toBe(true);
    expect(out!.winner).toBe("syndicate1");
    expect(out!.winnerUids).toEqual(["boss1", "op1"]);
    expect(out!.fields["winningTeam"]).toBe("syndicate1");
  });

  it("breaks a tied timeout-streak end AGAINST the team that timed out", () => {
    const s = session({
      svPhase: "boss-clue",
      phaseDeadlineAt: NOW - 1,
      svTimeoutStreak: 3,
      t1Score: 2,
      t2Score: 2,
      activeTeam: "syndicate1", // syndicate1 just timed out
    });
    const out = reducer.reduce(ctx(s));
    expect(out!.gameOver).toBe(true);
    expect(out!.winner).toBe("syndicate2");
  });

  it("closes an abandoned boss-select session with no winner", () => {
    const s = session({ svPhase: "boss-select", phaseDeadlineAt: NOW - 1 });
    const out = reducer.reduce(ctx(s));
    expect(out!.gameOver).toBe(true);
    expect(out!.winner).toBeNull();
    expect(out!.winnerUids).toEqual([]);
  });

  it("a real clue resets the timeout streak and re-arms the deadline", () => {
    const s = session({
      svPhase: "boss-clue",
      phaseDeadlineAt: NOW + 60_000,
      svTimeoutStreak: 2,
      inbox: { clue: { boss1: { word: "heist", number: 2 } } },
    });
    const out = reducer.reduce(ctx(s));
    expect(out).not.toBeNull();
    expect(out!.fields["svPhase"]).toBe("operative-guess");
    expect(out!.fields["svTimeoutStreak"]).toBe(0);
    expect(out!.fields["phaseDeadlineAt"]).toBe(NOW + 4 * 60_000);
  });
});
