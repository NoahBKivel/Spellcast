import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { makeBoard } from "./board";
import { createDictionary } from "./dictionary";
import { scriptedRng } from "./rng";
import { searchMoves } from "./solver";

describe("dictionary and search", () => {
  it("loads ENABLE and recognizes the screenshot words", () => {
    const text = readFileSync("public/dictionary/enable1.txt", "utf8");
    const dict = createDictionary(text);
    expect(dict.size).toBeGreaterThan(100_000);
    expect(dict.has("bear")).toBe(true);
    expect(dict.has("wizard")).toBe(true);
    expect(dict.has("asdfgh")).toBe(false);
  });

  it("finds BEAR and prefers the 2x path score", () => {
    const dict = createDictionary("be\nbear\near\ncat\n");
    const board = makeBoard(["BEARX", "XXXXX", "XXXXX", "XXXXX", "XXXXX"]);
    board[0][3].wordMult = 2;
    const { top } = searchMoves(board, dict);
    expect(top[0].word).toBe("BEAR");
    expect(top[0].score).toBe(16);
  });

  it("hints a word of at least four letters and skips frozen tiles", () => {
    const dict = createDictionary("cat\nca\nat\nbear\nbe\n");
    const board = makeBoard(["BEARX", "CATXX", "XXXXX", "XXXXX", "XXXXX"]);
    board[1][1].frozen = true;
    const { hint, top } = searchMoves(board, dict, { hintRng: scriptedRng([0]) });
    expect(top.some((move) => move.word === "CAT")).toBe(false);
    expect(top.some((move) => move.word === "BEAR")).toBe(true);
    expect(hint?.word.length).toBeGreaterThanOrEqual(4);
  });
});
