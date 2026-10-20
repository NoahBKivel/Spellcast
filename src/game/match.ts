import {
  createBoard,
  placeWordMultiplier,
  playWord,
  shuffleBoard,
  swapTileLetter,
  type Board,
  type Coord,
} from "./board";
import {
  GEM_CAP,
  ROUNDS,
  SHUFFLE_COST,
  STARTING_GEMS,
  SWAP_COST,
  HINT_COST,
  TIMER_COST,
  TIMER_MS,
} from "./letters";
import type { Rng } from "./rng";
import { scorePath, wordFrom } from "./scoring";

export const MAX_PLAYERS = 6;

export type Player = {
  id: string;
  name: string;
  isHuman: boolean;
  gems: number;
  score: number;
  gemBonus: number;
  lastWord: string | null;
  lastGain: number | null;
  bestWord: string | null;
  bestWordScore: number;
  fastestMs: number | null;
  color: number;
};

export type TimerState = {
  votes: string[];
  running: boolean;
  remainingMs: number;
};

export type Award = {
  playerId: string;
  word?: string;
  points?: number;
  ms?: number;
};

export type MatchResult = {
  winnerIds: string[];
  tie: boolean;
  letterrate: Award | null;
  fast: Award | null;
};

export type Match = {
  round: number;
  turnIndex: number;
  turnSerial: number;
  turnOrder: string[];
  players: Player[];
  board: Board;
  phase: "playing" | "ended";
  timer: TimerState;
  result: MatchResult | null;
};

export type MatchConfig = {
  humans: { id: string; name: string }[];
  botCount: number;
};

const BOT_NAMES = ["Jonas", "Alice", "Arame", "Graggle", "Renwil", "Puck", "Vesper", "Nim", "Bram", "Luma"];

function freshTimer(): TimerState {
  return { votes: [], running: false, remainingMs: TIMER_MS };
}

export function activePlayer(match: Match): Player {
  const id = match.turnOrder[match.turnIndex];
  const player = match.players.find((item) => item.id === id);
  if (!player) throw new Error("Active player is missing");
  return player;
}

export function votesNeeded(match: Match): number {
  return Math.max(match.players.length - 1, 1);
}

function blankPlayer(id: string, name: string, color: number, isHuman: boolean): Player {
  return {
    id,
    name,
    isHuman,
    gems: STARTING_GEMS,
    score: 0,
    gemBonus: 0,
    lastWord: null,
    lastGain: null,
    bestWord: null,
    bestWordScore: 0,
    fastestMs: null,
    color,
  };
}

export function createMatch(config: MatchConfig, rng: Rng): Match {
  const humans = config.humans.length > 0 ? config.humans : [{ id: "p0", name: "Player1" }];
  const players: Player[] = humans.map((human, index) =>
    blankPlayer(human.id, human.name.trim() || `Player${index + 1}`, index, true),
  );
  const count = Math.max(0, Math.min(MAX_PLAYERS - players.length, config.botCount));
  for (let i = 0; i < count; i += 1) {
    const index = players.length;
    players.push(blankPlayer(`p${index}`, BOT_NAMES[i % BOT_NAMES.length], index, false));
  }

  return {
    round: 1,
    turnIndex: 0,
    turnSerial: 1,
    turnOrder: players.map((player) => player.id),
    players,
    board: createBoard(rng),
    phase: "playing",
    timer: freshTimer(),
    result: null,
  };
}

function replacePlayer(match: Match, player: Player): Player[] {
  return match.players.map((item) => (item.id === player.id ? player : item));
}

function advance(match: Match, rng: Rng): Match {
  if (match.turnIndex + 1 < match.turnOrder.length) {
    return {
      ...match,
      turnIndex: match.turnIndex + 1,
      turnSerial: match.turnSerial + 1,
      timer: freshTimer(),
    };
  }
  if (match.round >= ROUNDS) return finishMatch(match);
  return {
    ...match,
    round: match.round + 1,
    turnIndex: 0,
    turnSerial: match.turnSerial + 1,
    timer: freshTimer(),
    board: placeWordMultiplier(match.board, 2, rng),
  };
}

export function submitWord(match: Match, path: Coord[], rng: Rng, elapsedMs: number): Match {
  if (match.phase !== "playing" || path.length < 2) return match;
  const player = activePlayer(match);
  const scored = scorePath(match.board, path);
  const played = playWord(match.board, path, rng);
  const gained = Math.min(played.gemsCollected, GEM_CAP - player.gems);
  const word = wordFrom(match.board, path);
  const nextPlayer: Player = {
    ...player,
    score: player.score + scored.points,
    gems: player.gems + gained,
    lastWord: word,
    lastGain: scored.points,
    bestWord: scored.points > player.bestWordScore ? word : player.bestWord,
    bestWordScore: Math.max(player.bestWordScore, scored.points),
    fastestMs:
      player.fastestMs === null || elapsedMs < player.fastestMs ? elapsedMs : player.fastestMs,
  };
  return advance(
    { ...match, board: played.board, players: replacePlayer(match, nextPlayer) },
    rng,
  );
}

export function skipTurn(match: Match, rng: Rng): Match {
  if (match.phase !== "playing") return match;
  const player = activePlayer(match);
  const nextPlayer: Player = { ...player, lastWord: "—", lastGain: 0 };
  return advance(
    {
      ...match,
      players: replacePlayer(match, nextPlayer),
      timer: { ...match.timer, running: false, remainingMs: 0 },
    },
    rng,
  );
}

export function voteTimer(match: Match, playerId: string): Match {
  if (match.phase !== "playing" || match.timer.running) return match;
  const active = activePlayer(match);
  const solo = match.players.length === 1;
  if (!solo && playerId === active.id) return match;
  if (match.timer.votes.includes(playerId)) return match;
  const voter = match.players.find((player) => player.id === playerId);
  if (!voter) return match;
  const votes = [...match.timer.votes, playerId];
  if (votes.length >= votesNeeded(match)) {
    return { ...match, timer: { votes, running: true, remainingMs: TIMER_MS } };
  }
  return { ...match, timer: { ...match.timer, votes } };
}

export function tickTimer(match: Match, dt: number, rng: Rng): Match {
  if (match.phase !== "playing" || !match.timer.running) return match;
  const remainingMs = match.timer.remainingMs - dt;
  if (remainingMs > 0) {
    return { ...match, timer: { ...match.timer, remainingMs } };
  }
  return skipTurn(match, rng);
}

export function extendTimer(match: Match): Match {
  if (match.phase !== "playing" || !match.timer.running) return match;
  const player = activePlayer(match);
  if (player.gems < TIMER_COST) return match;
  return {
    ...match,
    timer: { ...match.timer, remainingMs: TIMER_MS },
    players: replacePlayer(match, { ...player, gems: player.gems - TIMER_COST }),
  };
}

export function useShuffle(match: Match, rng: Rng): Match {
  if (match.phase !== "playing") return match;
  const player = activePlayer(match);
  if (player.gems < SHUFFLE_COST) return match;
  return {
    ...match,
    board: shuffleBoard(match.board, rng),
    players: replacePlayer(match, { ...player, gems: player.gems - SHUFFLE_COST }),
  };
}

export function useSwap(match: Match, coord: Coord, letter: string): Match {
  if (match.phase !== "playing") return match;
  const player = activePlayer(match);
  if (player.gems < SWAP_COST) return match;
  if (!/^[a-zA-Z]$/.test(letter)) return match;
  return {
    ...match,
    board: swapTileLetter(match.board, coord, letter),
    players: replacePlayer(match, { ...player, gems: player.gems - SWAP_COST }),
  };
}

export function spendForHint(match: Match): Match {
  if (match.phase !== "playing") return match;
  const player = activePlayer(match);
  if (player.gems < HINT_COST) return match;
  return {
    ...match,
    players: replacePlayer(match, { ...player, gems: player.gems - HINT_COST }),
  };
}

export function finishMatch(match: Match): Match {
  if (match.phase === "ended") return match;
  const players = match.players.map((player) => ({
    ...player,
    score: player.score + player.gems,
    gemBonus: player.gems,
  }));

  let letterrate: Award | null = null;
  let fast: Award | null = null;
  for (const player of players) {
    if (player.bestWord && player.bestWordScore > 0) {
      if (!letterrate || player.bestWordScore > (letterrate.points ?? 0)) {
        letterrate = { playerId: player.id, word: player.bestWord, points: player.bestWordScore };
      }
    }
    if (player.fastestMs !== null) {
      if (!fast || player.fastestMs < (fast.ms ?? Infinity)) {
        fast = { playerId: player.id, ms: player.fastestMs };
      }
    }
  }

  const best = Math.max(...players.map((player) => player.score));
  const winnerIds = players.filter((player) => player.score === best).map((player) => player.id);

  return {
    ...match,
    phase: "ended",
    players,
    timer: { ...match.timer, running: false },
    result: {
      winnerIds,
      tie: winnerIds.length > 1,
      letterrate,
      fast,
    },
  };
}
