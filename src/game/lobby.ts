import { adjacent, type Board, type Coord } from "./board";
import { chooseBotAction } from "./bots";
import type { Dictionary } from "./dictionary";
import {
  MAX_PLAYERS,
  activePlayer,
  createMatch,
  extendTimer,
  skipTurn,
  spendForHint,
  submitWord,
  useShuffle,
  useSwap,
  voteTimer,
  type Match,
} from "./match";
import { statefulRng, type Rng } from "./rng";
import { wordFrom } from "./scoring";

export const HOST_GRACE_MS = 12_000;
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const BOT_DELAY_MS = 700;

export type Seat = {
  id: string;
  name: string;
  token: string;
  host: boolean;
};

export type LobbyAction =
  | { type: "play"; path: Coord[]; elapsedMs: number }
  | { type: "skip" }
  | { type: "vote" }
  | { type: "extend" }
  | { type: "shuffle" }
  | { type: "swap"; coord: Coord; letter: string }
  | { type: "hint" };

export type Lobby = {
  code: string;
  phase: "open" | "playing" | "closed";
  seats: Seat[];
  bots: number;
  match: Match | null;
  rngState: number;
  hostLeftAt: number | null;
  closeReason: string | null;
  timerDeadline: number | null;
  botActAt: number | null;
  botVoteAt: Record<string, number>;
};

export type RoomSeat = {
  id: string;
  name: string;
  host: boolean;
  connected: boolean;
};

export type RoomView = {
  code: string;
  phase: Lobby["phase"];
  youId: string;
  hostId: string;
  seats: RoomSeat[];
  bots: number;
  maxBots: number;
  match: Match | null;
  closeReason: string | null;
};

export function displayName(requested: string, taken: string[]): string {
  const trimmed = requested.trim().slice(0, 16);
  if (trimmed) return trimmed;
  let n = 1;
  while (taken.includes(`Player${n}`)) n += 1;
  return `Player${n}`;
}

export function codeFromRolls(rng: Rng, length = 4): string {
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += CODE_ALPHABET[Math.floor(rng() * CODE_ALPHABET.length)];
  }
  return code;
}

function nextSeatId(seats: Seat[]): string {
  let n = 0;
  const used = new Set(seats.map((seat) => seat.id));
  while (used.has(`p${n}`)) n += 1;
  return `p${n}`;
}

export function createLobby(code: string, name: string, token: string, rngSeed: number): Lobby {
  return {
    code,
    phase: "open",
    seats: [{ id: "p0", name: displayName(name, []), token, host: true }],
    bots: 0,
    match: null,
    rngState: rngSeed >>> 0,
    hostLeftAt: null,
    closeReason: null,
    timerDeadline: null,
    botActAt: null,
    botVoteAt: {},
  };
}

export type JoinResult = { ok: true; lobby: Lobby; seatId: string } | { ok: false; error: string };

export function joinLobby(lobby: Lobby, name: string, token: string): JoinResult {
  if (lobby.phase === "closed") return { ok: false, error: lobby.closeReason ?? "The host left the lobby." };
  if (lobby.phase === "playing") return { ok: false, error: "That match has already started" };
  if (lobby.seats.length + lobby.bots >= MAX_PLAYERS) return { ok: false, error: "That lobby is full" };
  const seat: Seat = {
    id: nextSeatId(lobby.seats),
    name: displayName(name, lobby.seats.map((item) => item.name)),
    token,
    host: false,
  };
  return {
    ok: true,
    seatId: seat.id,
    lobby: {
      ...lobby,
      seats: [...lobby.seats, seat],
      bots: Math.min(lobby.bots, MAX_PLAYERS - lobby.seats.length - 1),
    },
  };
}

export function maxBots(lobby: Lobby): number {
  return Math.max(0, MAX_PLAYERS - lobby.seats.length);
}

export function setBots(lobby: Lobby, seatId: string, count: number): Lobby {
  const seat = lobby.seats.find((item) => item.id === seatId);
  if (!seat?.host || lobby.phase !== "open") return lobby;
  return { ...lobby, bots: Math.max(0, Math.min(maxBots(lobby), Math.floor(count))) };
}

export function startMatch(lobby: Lobby, seatId: string, now: number): Lobby {
  const seat = lobby.seats.find((item) => item.id === seatId);
  if (!seat?.host || lobby.phase !== "open") return lobby;
  const { rng, getState } = statefulRng(lobby.rngState);
  const match = createMatch(
    { humans: lobby.seats.map((item) => ({ id: item.id, name: item.name })), botCount: lobby.bots },
    rng,
  );
  return arm({ ...lobby, phase: "playing", match, rngState: getState() }, now);
}

export function disconnect(lobby: Lobby, seatId: string, now: number): Lobby {
  const seat = lobby.seats.find((item) => item.id === seatId);
  if (!seat?.host || lobby.phase !== "open") return lobby;
  return { ...lobby, hostLeftAt: now };
}

export function connectSeat(lobby: Lobby, seatId: string): Lobby {
  const seat = lobby.seats.find((item) => item.id === seatId);
  if (!seat?.host) return lobby;
  return { ...lobby, hostLeftAt: null };
}

export function leaveSeat(lobby: Lobby, seatId: string): Lobby {
  const seat = lobby.seats.find((item) => item.id === seatId);
  if (!seat) return lobby;
  if (lobby.phase === "open" && seat.host) {
    return { ...lobby, phase: "closed", closeReason: "The host left the lobby.", hostLeftAt: null };
  }
  if (lobby.phase === "open") {
    const seats = lobby.seats.filter((item) => item.id !== seatId);
    return { ...lobby, seats, bots: Math.min(lobby.bots, MAX_PLAYERS - seats.length) };
  }
  return lobby;
}

export function seatForToken(lobby: Lobby, token: string): Seat | null {
  return lobby.seats.find((seat) => seat.token === token) ?? null;
}

export function roomView(lobby: Lobby, youId: string, connected: Iterable<string>): RoomView {
  const online = new Set(connected);
  const host = lobby.seats.find((seat) => seat.host);
  return {
    code: lobby.code,
    phase: lobby.phase,
    youId,
    hostId: host?.id ?? "",
    seats: lobby.seats.map((seat) => ({
      id: seat.id,
      name: seat.name,
      host: seat.host,
      connected: online.has(seat.id),
    })),
    bots: lobby.bots,
    maxBots: maxBots(lobby),
    match: lobby.match,
    closeReason: lobby.closeReason,
  };
}

export function present(lobby: Lobby, now: number): Lobby {
  if (!lobby.match?.timer.running || lobby.timerDeadline === null) return lobby;
  const remainingMs = Math.max(0, lobby.timerDeadline - now);
  return { ...lobby, match: { ...lobby.match, timer: { ...lobby.match.timer, remainingMs } } };
}

export function nextWake(lobby: Lobby, now: number): number | null {
  const times: number[] = [];
  if (lobby.phase === "open" && lobby.hostLeftAt !== null) times.push(lobby.hostLeftAt + HOST_GRACE_MS);
  if (lobby.phase === "playing" && lobby.match?.phase === "playing") {
    if (lobby.timerDeadline !== null) times.push(lobby.timerDeadline);
    if (lobby.botActAt !== null) times.push(lobby.botActAt);
    for (const at of Object.values(lobby.botVoteAt)) times.push(at);
  }
  const future = times.filter((time) => time >= now);
  if (future.length === 0) return null;
  return Math.min(...future);
}

function useRng<T>(lobby: Lobby, fn: (rng: Rng) => T): { lobby: Lobby; result: T } {
  const { rng, getState } = statefulRng(lobby.rngState);
  const result = fn(rng);
  return { result, lobby: { ...lobby, rngState: getState() } };
}

function arm(lobby: Lobby, now: number): Lobby {
  const match = lobby.match;
  if (!match || match.phase !== "playing") {
    return { ...lobby, botActAt: null, botVoteAt: {}, timerDeadline: null };
  }
  const active = activePlayer(match);
  if (!active.isHuman) {
    return {
      ...lobby,
      botVoteAt: {},
      botActAt: lobby.botActAt ?? now + BOT_DELAY_MS,
    };
  }
  const botVoteAt: Record<string, number> = {};
  if (!match.timer.running) {
    match.players.forEach((player, index) => {
      if (player.isHuman || match.timer.votes.includes(player.id)) return;
      botVoteAt[player.id] = now + 12_000 + index * 1_800;
    });
  }
  return { ...lobby, botActAt: null, botVoteAt };
}

function commitMatch(lobby: Lobby, match: Match, now: number): Lobby {
  const previous = lobby.match;
  const restarted =
    match.timer.running &&
    (!previous?.timer.running || match.timer.remainingMs !== previous.timer.remainingMs);
  const timerDeadline = match.timer.running
    ? restarted
      ? now + match.timer.remainingMs
      : lobby.timerDeadline
    : null;
  return arm({ ...lobby, match, timerDeadline }, now);
}

function legalPath(board: Board, path: Coord[], dict: Dictionary): boolean {
  if (path.length < 2) return false;
  const seen = new Set<string>();
  for (let i = 0; i < path.length; i += 1) {
    const coord = path[i];
    if (!Number.isInteger(coord.r) || !Number.isInteger(coord.c)) return false;
    if (coord.r < 0 || coord.c < 0 || coord.r >= board.length || coord.c >= board[0].length) return false;
    const key = `${coord.r},${coord.c}`;
    if (seen.has(key)) return false;
    seen.add(key);
    if (i > 0 && !adjacent(path[i - 1], coord)) return false;
  }
  return dict.has(wordFrom(board, path));
}

export function applyAction(
  lobby: Lobby,
  seatId: string,
  action: LobbyAction,
  dict: Dictionary,
  now: number,
): Lobby {
  if (lobby.phase !== "playing" || !lobby.match || lobby.match.phase !== "playing") return lobby;
  const active = activePlayer(lobby.match);
  if (active.id !== seatId || !active.isHuman) return lobby;

  if (action.type === "play") {
    if (!legalPath(lobby.match.board, action.path, dict)) return lobby;
    const { result, lobby: next } = useRng(lobby, (rng) => submitWord(lobby.match!, action.path, rng, action.elapsedMs));
    return commitMatch(next, result, now);
  }
  if (action.type === "skip") {
    const { result, lobby: next } = useRng(lobby, (rng) => skipTurn(lobby.match!, rng));
    return commitMatch(next, result, now);
  }
  if (action.type === "vote") return commitMatch(lobby, voteTimer(lobby.match, seatId), now);
  if (action.type === "extend") return commitMatch(lobby, extendTimer(lobby.match), now);
  if (action.type === "shuffle") {
    const { result, lobby: next } = useRng(lobby, (rng) => useShuffle(lobby.match!, rng));
    return commitMatch(next, result, now);
  }
  if (action.type === "swap") return commitMatch(lobby, useSwap(lobby.match, action.coord, action.letter), now);
  if (action.type === "hint") return commitMatch(lobby, spendForHint(lobby.match), now);
  return lobby;
}

function runBot(lobby: Lobby, dict: Dictionary, now: number): Lobby {
  const { result, lobby: next } = useRng(lobby, (rng) => {
    let match = lobby.match!;
    let action = chooseBotAction(match.board, dict, activePlayer(match).gems, match.round, rng);
    if (action.type === "shuffle") {
      match = useShuffle(match, rng);
      action = chooseBotAction(match.board, dict, activePlayer(match).gems, match.round, rng, false);
    }
    if (action.type === "swap") {
      match = useSwap(match, action.coord, action.letter);
      return submitWord(match, action.path, rng, 2_000);
    }
    if (action.type === "play") return submitWord(match, action.path, rng, 2_000);
    return skipTurn(match, rng);
  });
  return commitMatch({ ...next, botActAt: null }, result, now);
}

function stepDue(lobby: Lobby, now: number, dict: Dictionary): Lobby {
  if (lobby.phase !== "playing" || !lobby.match || lobby.match.phase !== "playing") return lobby;
  if (lobby.match.timer.running && lobby.timerDeadline !== null && now >= lobby.timerDeadline) {
    const { result, lobby: next } = useRng(lobby, (rng) => skipTurn(lobby.match!, rng));
    return commitMatch({ ...next, timerDeadline: null }, result, now);
  }
  const active = activePlayer(lobby.match);
  if (!active.isHuman) {
    if (lobby.botActAt === null || now < lobby.botActAt) return lobby;
    return runBot(lobby, dict, now);
  }
  const due = lobby.match.players.filter(
    (player) => !player.isHuman && (lobby.botVoteAt[player.id] ?? Infinity) <= now,
  );
  if (due.length === 0) return lobby;
  let match = lobby.match;
  for (const player of due) match = voteTimer(match, player.id);
  const botVoteAt = { ...lobby.botVoteAt };
  for (const player of due) delete botVoteAt[player.id];
  return commitMatch({ ...lobby, botVoteAt }, match, now);
}

export function pump(lobby: Lobby, now: number, dict: Dictionary): Lobby {
  let next = lobby;
  if (next.phase === "open" && next.hostLeftAt !== null && now - next.hostLeftAt >= HOST_GRACE_MS) {
    next = { ...next, phase: "closed", closeReason: "The host left the lobby." };
  }
  for (let step = 0; step < 8; step += 1) {
    const advanced = stepDue(next, now, dict);
    if (advanced === next) break;
    next = advanced;
  }
  return next;
}
