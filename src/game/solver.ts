import type { Board, Coord } from "./board";
import type { Dictionary, TrieNode } from "./dictionary";
import { LETTER_VALUES } from "./letters";
import type { Rng } from "./rng";
import { wordFrom } from "./scoring";

export type Move = {
  path: Coord[];
  word: string;
  score: number;
  gems: number;
  long: boolean;
};

export type SearchResult = {
  top: Move[];
  hint: Move | null;
};

const DIRS = [-1, 0, 1];

export function searchMoves(
  board: Board,
  dict: Dictionary,
  options: { limit?: number; hintRng?: Rng } = {},
): SearchResult {
  const limit = options.limit ?? 12;
  const top: Move[] = [];
  let hint: Move | null = null;
  let hintSeen = 0;
  const height = board.length;
  const width = board[0]?.length ?? 0;
  const visited: boolean[][] = Array.from({ length: height }, () => Array.from({ length: width }, () => false));
  const path: Coord[] = [];

  const consider = (move: Move) => {
    const existing = top.find((item) => item.word === move.word);
    if (existing) {
      if (move.score > existing.score) {
        existing.path = move.path;
        existing.score = move.score;
        existing.gems = move.gems;
        existing.long = move.long;
      }
      return;
    }
    if (top.length < limit) {
      top.push(move);
      return;
    }
    let worst = 0;
    for (let i = 1; i < top.length; i += 1) {
      if (top[i].score < top[worst].score) worst = i;
    }
    if (move.score > top[worst].score) top[worst] = move;
  };

  const walk = (
    r: number,
    c: number,
    node: TrieNode,
    letterSum: number,
    wordMult: number,
    gems: number,
  ) => {
    if (visited[r][c] || board[r][c].frozen) return;
    const tile = board[r][c];
    const child = node.c[tile.letter.toLowerCase()];
    if (!child) return;

    visited[r][c] = true;
    path.push({ r, c });
    const nextSum = letterSum + tile.letterMult * LETTER_VALUES[tile.letter];
    const nextMult = wordMult * tile.wordMult;
    const nextGems = gems + (tile.gem ? 1 : 0);

    if (child.end && path.length >= 2) {
      const long = path.length >= 6;
      const move: Move = {
        path: path.slice(),
        word: wordFrom(board, path),
        score: nextSum * nextMult + (long ? 10 : 0),
        gems: nextGems,
        long,
      };
      consider(move);
      if (options.hintRng && path.length >= 4) {
        hintSeen += 1;
        if (options.hintRng() < 1 / hintSeen) hint = move;
      }
    }

    for (const dr of DIRS) {
      for (const dc of DIRS) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= height || nc >= width) continue;
        walk(nr, nc, child, nextSum, nextMult, nextGems);
      }
    }

    path.pop();
    visited[r][c] = false;
  };

  for (let r = 0; r < height; r += 1) {
    for (let c = 0; c < width; c += 1) {
      if (!board[r][c].frozen) walk(r, c, dict.trie, 0, 1, 0);
    }
  }

  top.sort((a, b) => b.score - a.score || b.gems - a.gems || b.word.length - a.word.length);
  return { top, hint };
}

export function randomHint(board: Board, dict: Dictionary, rng: Rng): Move | null {
  return searchMoves(board, dict, { limit: 1, hintRng: rng }).hint;
}
