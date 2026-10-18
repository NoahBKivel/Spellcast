import { BOARD_GEMS, LETTER_BAG } from "./letters";
import { pickIndex, shuffleInPlace, type Rng } from "./rng";

export const SIZE = 5;

export type LetterMult = 1 | 2 | 3;
export type WordMult = 1 | 2 | 3;

export type Tile = {
  id: string;
  letter: string;
  gem: boolean;
  letterMult: LetterMult;
  wordMult: WordMult;
  frozen: boolean;
};

export type Board = Tile[][];

export type Coord = { r: number; c: number };

let tileSeq = 1;

export function resetTileSeq(): void {
  tileSeq = 1;
}

function nextId(): string {
  const id = `t${tileSeq}`;
  tileSeq += 1;
  return id;
}

export function drawLetter(rng: Rng): string {
  return LETTER_BAG[pickIndex(rng, LETTER_BAG.length)];
}

export function emptyTile(letter: string, extras: Partial<Tile> = {}): Tile {
  return {
    id: nextId(),
    letter,
    gem: false,
    letterMult: 1,
    wordMult: 1,
    frozen: false,
    ...extras,
  };
}

export function makeBoard(rows: string[], extras?: (r: number, c: number, letter: string) => Partial<Tile>): Board {
  return rows.map((row, r) =>
    row.split("").map((letter, c) => emptyTile(letter, extras?.(r, c, letter))),
  );
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => row.map((tile) => ({ ...tile })));
}

export function allCoords(): Coord[] {
  const coords: Coord[] = [];
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      coords.push({ r, c });
    }
  }
  return coords;
}

export function adjacent(a: Coord, b: Coord): boolean {
  const dr = Math.abs(a.r - b.r);
  const dc = Math.abs(a.c - b.c);
  return dr <= 1 && dc <= 1 && dr + dc > 0;
}

export function sameCoord(a: Coord, b: Coord): boolean {
  return a.r === b.r && a.c === b.c;
}

export type CreateBoardOptions = {
  letterBoost?: LetterMult | "random";
};

export function createBoard(rng: Rng, options: CreateBoardOptions = {}): Board {
  const board: Board = [];
  for (let r = 0; r < SIZE; r += 1) {
    const row: Tile[] = [];
    for (let c = 0; c < SIZE; c += 1) {
      row.push(emptyTile(drawLetter(rng)));
    }
    board.push(row);
  }

  const spots = allCoords();
  for (let i = 0; i < BOARD_GEMS; i += 1) {
    const j = i + pickIndex(rng, spots.length - i);
    const swap = spots[i];
    spots[i] = spots[j];
    spots[j] = swap;
    board[spots[i].r][spots[i].c].gem = true;
  }

  const boostRoll = options.letterBoost ?? "random";
  const letterMult: LetterMult =
    boostRoll === "random" ? (rng() < 0.15 ? 3 : 2) : boostRoll === 1 ? 2 : boostRoll;
  const boostAt = allCoords()[pickIndex(rng, SIZE * SIZE)];
  board[boostAt.r][boostAt.c].letterMult = letterMult;
  return board;
}

export function gemCount(board: Board): number {
  return board.flat().filter((tile) => tile.gem).length;
}

export function letterBoosts(board: Board): { coord: Coord; mult: LetterMult }[] {
  const found: { coord: Coord; mult: LetterMult }[] = [];
  board.forEach((row, r) => {
    row.forEach((tile, c) => {
      if (tile.letterMult > 1) found.push({ coord: { r, c }, mult: tile.letterMult });
    });
  });
  return found;
}

export function wordBoosts(board: Board): { coord: Coord; mult: WordMult }[] {
  const found: { coord: Coord; mult: WordMult }[] = [];
  board.forEach((row, r) => {
    row.forEach((tile, c) => {
      if (tile.wordMult > 1) found.push({ coord: { r, c }, mult: tile.wordMult });
    });
  });
  return found;
}

export function placeWordMultiplier(board: Board, mult: 2 | 3, rng: Rng): Board {
  const next = cloneBoard(board);
  for (const row of next) {
    for (const tile of row) {
      if (tile.wordMult > 1) tile.wordMult = 1;
    }
  }
  const at = allCoords()[pickIndex(rng, SIZE * SIZE)];
  next[at.r][at.c].wordMult = mult;
  return next;
}

export type PlayWordResult = {
  board: Board;
  gemsCollected: number;
};

export function playWord(board: Board, path: Coord[], rng: Rng): PlayWordResult {
  const next = cloneBoard(board);
  let gemsCollected = 0;
  let consumedBoost: LetterMult = 1;

  for (const { r, c } of path) {
    const tile = next[r][c];
    if (tile.gem) gemsCollected += 1;
    if (tile.letterMult > 1) consumedBoost = tile.letterMult;
    next[r][c] = {
      ...tile,
      id: nextId(),
      letter: drawLetter(rng),
      gem: false,
      letterMult: 1,
      wordMult: 1,
      frozen: false,
    };
  }

  const replaced = path.map((coord) => ({ ...coord }));
  shuffleInPlace(replaced, rng);
  for (let i = 0; i < gemsCollected && i < replaced.length; i += 1) {
    next[replaced[i].r][replaced[i].c].gem = true;
  }

  if (consumedBoost > 1) {
    const at = allCoords()[pickIndex(rng, SIZE * SIZE)];
    next[at.r][at.c].letterMult = consumedBoost;
  }

  return { board: next, gemsCollected };
}

export function shuffleBoard(board: Board, rng: Rng): Board {
  const flat = board.flat().map((tile) => ({ ...tile }));
  shuffleInPlace(flat, rng);
  const next: Board = [];
  for (let r = 0; r < SIZE; r += 1) {
    next.push(flat.slice(r * SIZE, (r + 1) * SIZE));
  }
  return next;
}

export function swapTileLetter(board: Board, coord: Coord, letter: string): Board {
  const next = cloneBoard(board);
  const tile = next[coord.r][coord.c];
  next[coord.r][coord.c] = {
    ...tile,
    id: nextId(),
    letter: letter.toUpperCase(),
  };
  return next;
}

export function tileSignature(board: Board): string[] {
  return board
    .flat()
    .map((tile) => `${tile.letter}${tile.gem ? "!" : ""}${tile.letterMult}${tile.wordMult}${tile.frozen ? "#" : ""}`)
    .sort();
}

export function lettersOf(board: Board): string[] {
  return board.flat().map((tile) => tile.letter);
}
