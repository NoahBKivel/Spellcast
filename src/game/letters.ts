export const LETTER_VALUES: Record<string, number> = {
  A: 1, E: 1, I: 1, O: 1,
  N: 2, R: 2, S: 2, T: 2,
  D: 3, G: 3, L: 3,
  B: 4, H: 4, P: 4, M: 4, U: 4, Y: 4,
  C: 5, F: 5, V: 5, W: 5,
  K: 6,
  J: 7, X: 7,
  Q: 8, Z: 8,
};

/**
 * English-frequency bag. The original letter frequencies were never published;
 * uniform A–Z produces boards that do not look like the game.
 */
export const LETTER_WEIGHTS: Record<string, number> = {
  E: 12, A: 9, I: 9, O: 8,
  T: 7, N: 7, S: 6, R: 6,
  D: 4, L: 4, U: 3, G: 3,
  M: 2, H: 2, P: 2, B: 2, C: 2, F: 2, Y: 2, W: 2, V: 2,
  K: 1, J: 1, X: 1, Q: 1, Z: 1,
};

export const LETTER_BAG: string[] = Object.entries(LETTER_WEIGHTS).flatMap(
  ([letter, weight]) => Array.from({ length: weight }, () => letter),
);

export const SHUFFLE_COST = 1;
export const SWAP_COST = 3;
export const HINT_COST = 4;
export const TIMER_COST = 1;
export const TIMER_MS = 30_000;
export const GEM_CAP = 10;
export const BOARD_GEMS = 10;
export const ROUNDS = 5;
export const LONG_WORD_AT = 6;
export const LONG_WORD_BONUS = 10;
export const STARTING_GEMS = 3;

export const POINTS_TABLE: { letters: string; points: number }[] = [
  { letters: "A, E, I, O", points: 1 },
  { letters: "N, R, S, T", points: 2 },
  { letters: "D, G, L", points: 3 },
  { letters: "B, H, P, M, U, Y", points: 4 },
  { letters: "C, F, V, W", points: 5 },
  { letters: "K", points: 6 },
  { letters: "J, X", points: 7 },
  { letters: "Q, Z", points: 8 },
];
