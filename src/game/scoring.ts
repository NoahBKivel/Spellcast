import { LETTER_VALUES, LONG_WORD_AT, LONG_WORD_BONUS } from "./letters";
import type { Board, Coord } from "./board";

export type ScoredTile = {
  letter: string;
  base: number;
  letterMult: number;
  wordMult: number;
  gem: boolean;
};

export type ScoreResult = {
  points: number;
  letterSum: number;
  wordMult: number;
  long: boolean;
  gems: number;
  tiles: ScoredTile[];
};

export function scorePath(board: Board, path: Coord[]): ScoreResult {
  let letterSum = 0;
  let wordMult = 1;
  let gems = 0;
  const tiles: ScoredTile[] = [];

  for (const { r, c } of path) {
    const tile = board[r][c];
    const base = LETTER_VALUES[tile.letter];
    letterSum += base * tile.letterMult;
    wordMult *= tile.wordMult;
    if (tile.gem) gems += 1;
    tiles.push({
      letter: tile.letter,
      base,
      letterMult: tile.letterMult,
      wordMult: tile.wordMult,
      gem: tile.gem,
    });
  }

  const long = path.length >= LONG_WORD_AT;
  return {
    points: letterSum * wordMult + (long ? LONG_WORD_BONUS : 0),
    letterSum,
    wordMult,
    long,
    gems,
    tiles,
  };
}

export function wordFrom(board: Board, path: Coord[]): string {
  return path.map(({ r, c }) => board[r][c].letter).join("");
}
