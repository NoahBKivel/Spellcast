import { describe, expect, it } from "vitest";
import { lettersOf, wordBoosts } from "./board";
import { TIMER_MS } from "./letters";
import {
  createMatch,
  extendTimer,
  finishMatch,
  skipTurn,
  submitWord,
  tickTimer,
  useShuffle,
  useSwap,
  voteTimer,
} from "./match";
import { mulberry32 } from "./rng";
import { tileSignature } from "./board";

const path = [
  { r: 0, c: 0 },
  { r: 0, c: 1 },
];

describe("match", () => {
  it("starts round 1 with no 2x and adds one on the next round", () => {
    const rng = mulberry32(4);
    let match = createMatch({ humans: [{ id: "p0", name: "You" }], botCount: 0 }, rng);
    expect(match.round).toBe(1);
    expect(wordBoosts(match.board)).toHaveLength(0);
    expect(match.players[0].gems).toBe(3);
    match = submitWord(match, path, rng, 800);
    expect(match.round).toBe(2);
    expect(wordBoosts(match.board)).toHaveLength(1);
  });

  it("ignores the active player's vote unless they are alone", () => {
    let match = createMatch({ humans: [{ id: "p0", name: "You" }], botCount: 1 }, mulberry32(1));
    match = voteTimer(match, "p0");
    expect(match.timer.votes).toEqual([]);
    expect(match.timer.running).toBe(false);
    match = voteTimer(match, "p1");
    expect(match.timer.running).toBe(true);
    expect(match.timer.remainingMs).toBe(TIMER_MS);
  });

  it("skips a timed-out turn without changing the board", () => {
    const rng = mulberry32(8);
    let match = createMatch({ humans: [{ id: "p0", name: "You" }], botCount: 1 }, rng);
    const letters = lettersOf(match.board).join("");
    match = voteTimer(match, "p1");
    match = tickTimer(match, TIMER_MS, rng);
    expect(match.turnIndex).toBe(1);
    expect(match.players[0].score).toBe(0);
    expect(match.players[0].lastGain).toBe(0);
    expect(lettersOf(match.board).join("")).toBe(letters);
  });

  it("lets a solo player start their own timer and buy it back", () => {
    const rng = mulberry32(2);
    let match = createMatch({ humans: [{ id: "p0", name: "You" }], botCount: 0 }, rng);
    match = voteTimer(match, "p0");
    expect(match.timer.running).toBe(true);
    match = tickTimer(match, 10_000, rng);
    expect(match.timer.remainingMs).toBe(20_000);
    match = extendTimer(match);
    expect(match.players[0].gems).toBe(2);
    expect(match.timer.remainingMs).toBe(TIMER_MS);
  });

  it("caps stored gems at 10", () => {
    const rng = mulberry32(6);
    let match = createMatch({ humans: [{ id: "p0", name: "You" }], botCount: 0 }, rng);
    match.board[0][0].gem = true;
    match.board[0][1].gem = true;
    match.players[0].gems = 9;
    match = submitWord(match, path, rng, 400);
    expect(match.players[0].gems).toBe(10);
  });

  it("spends gems on shuffle and swap and keeps shuffle bonuses attached", () => {
    const rng = mulberry32(9);
    let match = createMatch({ humans: [{ id: "p0", name: "You" }], botCount: 0 }, rng);
    match.players[0].gems = 6;
    const before = tileSignature(match.board);
    match = useShuffle(match, rng);
    expect(match.players[0].gems).toBe(5);
    expect(tileSignature(match.board)).toEqual(before);
    const letter = match.board[2][2].letter;
    match = useSwap(match, { r: 2, c: 2 }, letter === "Q" ? "E" : "Q");
    expect(match.players[0].gems).toBe(2);
    expect(match.board[2][2].letter).toBe(letter === "Q" ? "E" : "Q");
    expect(useSwap(match, { r: 0, c: 0 }, "A")).toBe(match);
  });

  it("adds leftover gems and names the awards after five rounds", () => {
    const rng = mulberry32(12);
    let match = createMatch({ humans: [{ id: "p0", name: "Ada" }], botCount: 1 }, rng);
    match = {
      ...match,
      players: [
        { ...match.players[0], score: 40, gems: 4, bestWord: "WIZARD", bestWordScore: 50, fastestMs: 4200 },
        { ...match.players[1], score: 30, gems: 1, bestWord: "BEAR", bestWordScore: 18, fastestMs: 1500 },
      ],
    };
    const done = finishMatch(match);
    expect(done.phase).toBe("ended");
    expect(done.players[0].score).toBe(44);
    expect(done.players[0].gemBonus).toBe(4);
    expect(done.result?.winnerIds).toEqual(["p0"]);
    expect(done.result?.letterrate).toMatchObject({ playerId: "p0", word: "WIZARD", points: 50 });
    expect(done.result?.fast).toMatchObject({ playerId: "p1", ms: 1500 });
  });

  it("ends a solo match on the fifth word", () => {
    const rng = mulberry32(15);
    let match = createMatch({ humans: [{ id: "p0", name: "You" }], botCount: 0 }, rng);
    for (let turn = 0; turn < 4; turn += 1) {
      match = submitWord(match, path, rng, 1000);
      expect(match.phase).toBe("playing");
    }
    expect(match.round).toBe(5);
    match = submitWord(match, path, rng, 900);
    expect(match.phase).toBe("ended");
    expect(match.result?.letterrate).not.toBeNull();
  });

  it("does not change the board when the clock skips the last seat of a round", () => {
    const rng = mulberry32(16);
    let match = createMatch({ humans: [{ id: "p0", name: "You" }], botCount: 0 }, rng);
    const before = lettersOf(match.board).join("");
    match = skipTurn(match, rng);
    expect(match.round).toBe(2);
    expect(lettersOf(match.board).join("")).not.toBe("");
    expect(lettersOf(match.board).filter((_, index) => before[index] !== lettersOf(match.board)[index]).length).toBe(0);
    expect(wordBoosts(match.board)).toHaveLength(1);
  });
});
