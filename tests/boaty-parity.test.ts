/**
 * Boaty client/server parity test (SYSTEM-REVIEW item 12).
 *
 * The server reducer's pure logic (`functions/src/games/boaty/logic.ts`) is a
 * copy of the client's (`src/app/games/boaty/boatyLogic.ts`) because the
 * functions package can't import the app's `src/`. Both files promise "kept in
 * sync with a parity test" — this is that test: every deterministic function
 * is exercised over exhaustive/representative fixtures on both sides and must
 * agree exactly. If you change game rules on one side, this fails until you
 * port the change.
 */
import { describe, expect, it } from "vitest";
import * as client from "@/app/games/boaty/boatyLogic";
import * as server from "../functions/src/games/boaty/logic";
import type {
  AttackRecord,
  PlayerBoard,
  Position,
  RaftDef,
  RaftType,
  Rotation,
} from "../functions/src/games/boaty/types";

const RAFT_TYPES: RaftType[] = ["square", "lshape", "shorty"];
const ROTATIONS: Rotation[] = [0, 90, 180, 270];

/** Every raft definition anchored anywhere on (and hanging off) the grid. */
function allRaftDefs(): RaftDef[] {
  const defs: RaftDef[] = [];
  for (const type of RAFT_TYPES) {
    for (const rotation of ROTATIONS) {
      for (let row = -1; row <= server.GRID_SIZE; row++) {
        for (let col = -1; col <= server.GRID_SIZE; col++) {
          defs.push({ type, rotation, anchor: { row, col } });
        }
      }
    }
  }
  return defs;
}

/** A fixed, valid board used for attack-resolution fixtures. */
const FIXED_BOARD: PlayerBoard = {
  rafts: [
    { type: "square", rotation: 0, anchor: { row: 0, col: 0 } },
    { type: "lshape", rotation: 90, anchor: { row: 2, col: 2 } },
    { type: "shorty", rotation: 0, anchor: { row: 4, col: 0 } },
  ],
  gator: { row: 4, col: 4 },
};

const allCells = (): Position[] => {
  const cells: Position[] = [];
  for (let row = 0; row < server.GRID_SIZE; row++) {
    for (let col = 0; col < server.GRID_SIZE; col++) {
      cells.push({ row, col });
    }
  }
  return cells;
};

describe("boaty client/server logic parity", () => {
  it("agrees on constants", () => {
    expect(server.GRID_SIZE).toBe(client.GRID_SIZE);
    expect(server.TOTAL_RAFT_SQUARES).toBe(client.TOTAL_RAFT_SQUARES);
    expect(server.RAFT_OFFSETS).toEqual(client.RAFT_OFFSETS);
  });

  it("agrees on occupied squares for every raft placement", () => {
    for (const def of allRaftDefs()) {
      expect(server.getOccupiedSquares(def)).toEqual(client.getOccupiedSquares(def));
    }
  });

  it("agrees on bounds checks for every raft placement", () => {
    for (const def of allRaftDefs()) {
      expect(server.isRaftInBounds(def)).toBe(client.isRaftInBounds(def));
    }
  });

  it("agrees on placement validity against a real occupied set", () => {
    const otherOccupiedServer = server.buildOccupiedSet(FIXED_BOARD.rafts);
    const otherOccupiedClient = client.buildOccupiedSet(FIXED_BOARD.rafts);
    expect([...otherOccupiedServer].sort()).toEqual([...otherOccupiedClient].sort());
    for (const def of allRaftDefs()) {
      expect(server.isValidPlacement(def, otherOccupiedServer)).toBe(
        client.isValidPlacement(def, otherOccupiedClient),
      );
    }
  });

  it("agrees on attack resolution for every cell of a fixed board", () => {
    for (const cell of allCells()) {
      expect(server.resolveAttack(cell.row, cell.col, FIXED_BOARD)).toBe(
        client.resolveAttack(cell.row, cell.col, FIXED_BOARD),
      );
    }
    // Sanity: the fixture actually produces all three results.
    const results = new Set(
      allCells().map((c) => server.resolveAttack(c.row, c.col, FIXED_BOARD)),
    );
    expect(results).toEqual(new Set(["hit", "miss", "gator"]));
  });

  it("agrees on win detection", () => {
    const hits: Position[] = [];
    for (const cell of allCells()) {
      const record: AttackRecord = { hits: [...hits], misses: [], gatorHits: [] };
      expect(server.checkWin(record)).toBe(client.checkWin(record));
      hits.push(cell);
    }
    const nineHits: AttackRecord = { hits: allCells().slice(0, 9), misses: [], gatorHits: [] };
    expect(server.checkWin(nineHits)).toBe(true);
    expect(client.checkWin(nineHits)).toBe(true);
  });

  it("agrees on raft destruction and raft lookup", () => {
    for (const raft of FIXED_BOARD.rafts) {
      const squares = server.getOccupiedSquares(raft);
      // Progressive hits: destroyed only when every square is hit.
      for (let n = 0; n <= squares.length; n++) {
        const hits = squares.slice(0, n);
        expect(server.isRaftDestroyed(raft, hits)).toBe(client.isRaftDestroyed(raft, hits));
        expect(server.isRaftDestroyed(raft, hits)).toBe(n === squares.length);
      }
    }
    for (const cell of allCells()) {
      expect(server.findRaftAt(FIXED_BOARD.rafts, cell.row, cell.col)?.type).toBe(
        client.findRaftAt(FIXED_BOARD.rafts, cell.row, cell.col)?.type,
      );
    }
  });

  it("random placement obeys the shared invariants on both sides", () => {
    for (const impl of [server, client]) {
      for (let i = 0; i < 50; i++) {
        const rafts = impl.randomPlacement();
        expect(rafts).toHaveLength(3);
        const squares = rafts.flatMap((r: RaftDef) => impl.getOccupiedSquares(r));
        expect(squares).toHaveLength(server.TOTAL_RAFT_SQUARES);
        // No overlaps, all in bounds.
        expect(new Set(squares.map((s: Position) => `${s.row},${s.col}`)).size).toBe(
          server.TOTAL_RAFT_SQUARES,
        );
        for (const s of squares) expect(impl.isInBounds(s)).toBe(true);
      }
    }
  });

  it("AI target selection only ever picks unexplored in-bounds cells", () => {
    for (const impl of [server, client]) {
      const attacks: AttackRecord = {
        hits: [{ row: 2, col: 2 }],
        misses: [
          { row: 1, col: 2 },
          { row: 2, col: 1 },
        ],
        gatorHits: [{ row: 3, col: 2 }],
      };
      const explored = new Set(
        [...attacks.hits, ...attacks.misses, ...attacks.gatorHits].map(
          (p) => `${p.row},${p.col}`,
        ),
      );
      for (let i = 0; i < 100; i++) {
        const pick = impl.aiPickTarget(attacks);
        expect(impl.isInBounds(pick)).toBe(true);
        expect(explored.has(`${pick.row},${pick.col}`)).toBe(false);
      }
    }
  });
});
