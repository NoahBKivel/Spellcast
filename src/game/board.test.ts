import { describe, expect, it } from "vitest";
import {
  createBoard,
  gemCount,
  letterBoosts,
  makeBoard,
  playWord,
  shuffleBoard,
  swapTileLetter,
  tileSignature,
  wordBoosts,
} from "./board";
import { mulberry32, scriptedRng } from "./rng";

const zero = scriptedRng([0]);

describe("board", () => {
  it("deals 25 tiles, 10 gems, one letter boost, and no 2x", () => {
    const board = createBoard(mulberry32(7));
    expect(board.flat()).toHaveLength(25);
    expect(gemCount(board)).toBe(10);
    expect(letterBoosts(board)).toHaveLength(1);
    expect(wordBoosts(board)).toHaveLength(0);
  });

  it("can place a triple letter boost", () => {
    const board = createBoard(mulberry32(3), { letterBoost: 3 });
    expect(letterBoosts(board)[0].mult).toBe(3);
  });

  it("replaces used letters, keeps 10 gems, and relocates a claimed DL", () => {
    const board = makeBoard(["QQQQQ", "AAAAA", "AAAAA", "AAAAA", "AAAAA"]);
    for (let c = 0; c < 5; c += 1) board[2][c].gem = true;
    board[3][0].gem = true;
    board[3][1].gem = true;
    board[0][0].gem = true;
    board[0][1].gem = true;
    board[0][2].gem = true;
    board[0][0].letterMult = 2;
    const path = [0, 1, 2].map((c) => ({ r: 0, c }));
    const played = playWord(board, path, zero);
    expect(played.gemsCollected).toBe(3);
    expect(gemCount(played.board)).toBe(10);
    expect(played.board[0][0].letter).toBe("E");
    expect(played.board[0][1].letter).toBe("E");
    expect(played.board[0][2].letter).toBe("E");
    expect(letterBoosts(played.board)).toHaveLength(1);
    expect(played.board[0][0].wordMult).toBe(1);
  });

  it("leaves an unclaimed DL where it is and clears a used 2x", () => {
    const board = makeBoard(["ABCDX", "XXXXX", "XXXXX", "XXXXX", "XXXXX"]);
    board[4][4].letterMult = 2;
    board[0][1].wordMult = 2;
    const played = playWord(board, [
      { r: 0, c: 0 },
      { r: 0, c: 1 },
    ], zero);
    expect(played.board[4][4].letterMult).toBe(2);
    expect(wordBoosts(played.board)).toHaveLength(0);
  });

  it("keeps a 2x that was not played", () => {
    const board = makeBoard(["ABCDX", "XXXXX", "XXXXX", "XXXXX", "XXXXX"]);
    board[3][3].wordMult = 2;
    const played = playWord(board, [
      { r: 0, c: 0 },
      { r: 0, c: 1 },
    ], zero);
    expect(wordBoosts(played.board)).toEqual([{ coord: { r: 3, c: 3 }, mult: 2 }]);
  });

  it("shuffles tiles without changing letters or bonuses", () => {
    const board = createBoard(mulberry32(11));
    const before = tileSignature(board);
    const shuffled = shuffleBoard(board, mulberry32(99));
    expect(tileSignature(shuffled)).toEqual(before);
  });

  it("swaps only the letter", () => {
    const board = makeBoard(["AAAAA", "AAAAA", "AAAAA", "AAAAA", "AAAAA"]);
    board[1][1].gem = true;
    board[1][1].letterMult = 2;
    board[1][1].wordMult = 2;
    const next = swapTileLetter(board, { r: 1, c: 1 }, "z");
    expect(next[1][1].letter).toBe("Z");
    expect(next[1][1].gem).toBe(true);
    expect(next[1][1].letterMult).toBe(2);
    expect(next[1][1].wordMult).toBe(2);
    expect(board[1][1].letter).toBe("A");
  });
});
