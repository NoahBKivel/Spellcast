import { swapTileLetter, type Board, type Coord } from "./board";
import type { Dictionary } from "./dictionary";
import type { Rng } from "./rng";
import { searchMoves, type Move } from "./solver";

export type BotAction =
  | { type: "skip" }
  | { type: "play"; path: Coord[] }
  | { type: "shuffle" }
  | { type: "swap"; coord: Coord; letter: string; path: Coord[] };

const SWAP_LETTERS = ["E", "A", "S", "R", "T"];

export function chooseBotAction(
  board: Board,
  dict: Dictionary,
  gems: number,
  round: number,
  rng: Rng,
  allowShuffle = true,
): BotAction {
  const top = searchMoves(board, dict, { limit: 12 }).top;
  if (top.length === 0) {
    if (allowShuffle && gems >= 1) return { type: "shuffle" };
    return { type: "skip" };
  }

  const best = top[0];
  if (allowShuffle && gems >= 1 && gems < 3 && best.score < 15) {
    return { type: "shuffle" };
  }

  if (round === 5 && gems >= 6 && best.score < 45) {
    const swapped = findSwap(board, dict, rng, best);
    if (swapped) return swapped;
  }

  return { type: "play", path: pickMove(top, gems, round, rng).path };
}

function pickMove(top: Move[], gems: number, round: number, rng: Rng): Move {
  if (round < 5 && gems < 3) {
    const gemmy = top.filter((move) => move.gems > 0 && move.score >= top[0].score - 12);
    if (gemmy.length > 0) {
      gemmy.sort((a, b) => b.gems - a.gems || b.score - a.score);
      return gemmy[0];
    }
  }
  const close = top.filter((move) => move.score >= top[0].score - 6).slice(0, 3);
  return close[Math.floor(rng() * close.length)] ?? top[0];
}

function findSwap(board: Board, dict: Dictionary, rng: Rng, best: Move): BotAction | null {
  let winner: { coord: Coord; letter: string; path: Coord[]; score: number } | null = null;
  const seen = new Set<string>();
  for (let n = 0; n < 6; n += 1) {
    const coord = { r: Math.floor(rng() * 5), c: Math.floor(rng() * 5) };
    const key = `${coord.r}${coord.c}`;
    if (seen.has(key)) continue;
    seen.add(key);
    for (const letter of SWAP_LETTERS) {
      if (board[coord.r][coord.c].letter === letter) continue;
      const next = swapTileLetter(board, coord, letter);
      const move = searchMoves(next, dict, { limit: 1 }).top[0];
      if (move && move.score >= best.score + 18 && (!winner || move.score > winner.score)) {
        winner = { coord, letter, path: move.path, score: move.score };
      }
    }
  }
  if (!winner) return null;
  return { type: "swap", coord: winner.coord, letter: winner.letter, path: winner.path };
}
