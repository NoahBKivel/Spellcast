import { describe, expect, it } from "vitest";
import { makeBoard } from "./board";
import { scorePath } from "./scoring";

function row(letters: string) {
  return makeBoard([
    letters.padEnd(5, "X").slice(0, 5),
    "XXXXX",
    "XXXXX",
    "XXXXX",
    "XXXXX",
  ]);
}

describe("scorePath", () => {
  it("scores BEAR as 8", () => {
    const board = row("BEARX");
    const path = [0, 1, 2, 3].map((c) => ({ r: 0, c }));
    expect(scorePath(board, path).points).toBe(8);
  });

  it("scores WIZARD with a 2x and the long-word bonus as 50", () => {
    const board = makeBoard(["WIZAR", "XXXXD", "XXXXX", "XXXXX", "XXXXX"], (r, c) =>
      r === 1 && c === 4 ? { wordMult: 2 } : {},
    );
    const path = [
      { r: 0, c: 0 },
      { r: 0, c: 1 },
      { r: 0, c: 2 },
      { r: 0, c: 3 },
      { r: 0, c: 4 },
      { r: 1, c: 4 },
    ];
    const scored = scorePath(board, path);
    expect(scored.long).toBe(true);
    expect(scored.wordMult).toBe(2);
    expect(scored.points).toBe(50);
  });

  it("does not multiply the long-word bonus", () => {
    const board = row("AAAAAA");
    board[0][0].wordMult = 2;
    const path = [0, 1, 2, 3, 4].map((c) => ({ r: 0, c }));
    path.push({ r: 1, c: 4 });
    board[1][4].letter = "A";
    const scored = scorePath(board, path);
    expect(scored.letterSum).toBe(6);
    expect(scored.points).toBe(22);
  });

  it("applies a double letter before the word multiplier", () => {
    const board = row("BEAXX");
    board[0][0].letterMult = 2;
    board[0][2].wordMult = 2;
    const scored = scorePath(board, [0, 1, 2].map((c) => ({ r: 0, c })));
    expect(scored.letterSum).toBe(4 * 2 + 1 + 1);
    expect(scored.points).toBe(20);
  });

  it("triples a letter and stacks word multipliers", () => {
    const board = row("KXXXX");
    board[0][0].letterMult = 3;
    board[0][0].wordMult = 2;
    board[0][1].wordMult = 3;
    board[0][1].letter = "A";
    const scored = scorePath(board, [
      { r: 0, c: 0 },
      { r: 0, c: 1 },
    ]);
    expect(scored.letterSum).toBe(18 + 1);
    expect(scored.wordMult).toBe(6);
    expect(scored.points).toBe(114);
  });
});
