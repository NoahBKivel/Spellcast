import { describe, expect, it } from "vitest";
import { makeBoard } from "./board";
import { createDictionary } from "./dictionary";
import { TIMER_MS } from "./letters";
import {
  HOST_GRACE_MS,
  applyAction,
  codeFromRolls,
  connectSeat,
  createLobby,
  disconnect,
  joinLobby,
  pump,
  setBots,
  startMatch,
} from "./lobby";
import { activePlayer } from "./match";
import { scriptedRng } from "./rng";

const dict = createDictionary("bear\nbe\near\n");
const bear = makeBoard(["BEARX", "XXXXX", "XXXXX", "XXXXX", "XXXXX"]);

describe("lobby", () => {
  it("names a blank host Player1 and the next blank guest Player2", () => {
    const lobby = createLobby("K7MQ", "", "host-token", 1);
    expect(lobby.seats[0].name).toBe("Player1");
    expect(lobby.bots).toBe(0);
    const joined = joinLobby(lobby, "   ", "guest-token");
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;
    expect(joined.lobby.seats.map((seat) => seat.name)).toEqual(["Player1", "Player2"]);
  });

  it("keeps a typed name and gives the next blank guest Player1", () => {
    const lobby = createLobby("K7MQ", " Noah ", "host-token", 1);
    const joined = joinLobby(lobby, "", "guest-token");
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;
    expect(joined.lobby.seats.map((seat) => seat.name)).toEqual(["Noah", "Player1"]);
  });

  it("refuses a full room, a started match, and a closed lobby", () => {
    let lobby = createLobby("K7MQ", "Noah", "host", 1);
    lobby = setBots(lobby, "p0", 5);
    const full = joinLobby(lobby, "Ada", "guest");
    expect(full).toEqual({ ok: false, error: "That lobby is full" });

    lobby = setBots(lobby, "p0", 0);
    lobby = startMatch(lobby, "p0", 0);
    expect(joinLobby(lobby, "Ada", "guest")).toEqual({ ok: false, error: "That match has already started" });

    const left = disconnect(createLobby("K7MQ", "Noah", "host", 1), "p0", 0);
    const closed = pump(left, HOST_GRACE_MS, dict);
    expect(closed.phase).toBe("closed");
    expect(joinLobby(closed, "Ada", "guest").ok).toBe(false);
  });

  it("lets only the host set bots and start, capping humans and bots at six", () => {
    let lobby = createLobby("K7MQ", "Noah", "host", 4);
    const guest = joinLobby(lobby, "Ada", "guest");
    if (!guest.ok) throw new Error(guest.error);
    lobby = guest.lobby;
    expect(setBots(lobby, guest.seatId, 3).bots).toBe(0);
    lobby = setBots(lobby, "p0", 9);
    expect(lobby.bots).toBe(4);
    expect(startMatch(lobby, guest.seatId, 0).phase).toBe("open");
    const started = startMatch(lobby, "p0", 0);
    expect(started.phase).toBe("playing");
    expect(started.match?.players.filter((player) => player.isHuman).map((player) => player.name)).toEqual([
      "Noah",
      "Ada",
    ]);
    expect(started.match?.players.filter((player) => !player.isHuman)).toHaveLength(4);
  });

  it("plays a legal word for the active player and ignores anyone else", () => {
    let lobby = startMatch(createLobby("K7MQ", "Noah", "host", 1), "p0", 0);
    lobby = {
      ...lobby,
      match: lobby.match ? { ...lobby.match, board: bear } : null,
    };
    const ignored = applyAction(lobby, "p0", { type: "play", path: [{ r: 0, c: 0 }], elapsedMs: 100 }, dict, 0);
    expect(ignored.match?.round).toBe(1);
    const guest = joinLobby(createLobby("K7MQ", "Noah", "host", 1), "Ada", "guest");
    if (!guest.ok) throw new Error(guest.error);
    let shared = startMatch(guest.lobby, "p0", 0);
    shared = { ...shared, match: shared.match ? { ...shared.match, board: bear } : null };
    const stolen = applyAction(
      shared,
      guest.seatId,
      { type: "play", path: [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }, { r: 0, c: 3 }], elapsedMs: 100 },
      dict,
      0,
    );
    expect(activePlayer(stolen.match!).id).toBe("p0");
    const played = applyAction(
      shared,
      "p0",
      { type: "play", path: [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }, { r: 0, c: 3 }], elapsedMs: 500 },
      dict,
      0,
    );
    expect(played.match?.players[0].lastWord).toBe("BEAR");
    expect(played.match?.players[0].score).toBeGreaterThan(0);
  });

  it("skips a turn when the server timer deadline passes", () => {
    let lobby = startMatch(createLobby("K7MQ", "Noah", "host", 1), "p0", 0);
    lobby = applyAction(lobby, "p0", { type: "vote" }, dict, 1_000);
    expect(lobby.timerDeadline).toBe(1_000 + TIMER_MS);
    lobby = pump(lobby, 1_000 + TIMER_MS, dict);
    expect(lobby.match?.round).toBe(2);
    expect(lobby.match?.players[0].lastWord).toBe("—");
  });

  it("returns the host to the lobby when they reconnect before the grace period", () => {
    let lobby = disconnect(createLobby("K7MQ", "Noah", "host", 1), "p0", 1_000);
    lobby = connectSeat(lobby, "p0");
    lobby = pump(lobby, 1_000 + HOST_GRACE_MS, dict);
    expect(lobby.phase).toBe("open");
  });

  it("takes a bot turn when its delay has passed", () => {
    const guest = joinLobby(createLobby("K7MQ", "Noah", "host", 1), "Ada", "guest");
    if (!guest.ok) throw new Error(guest.error);
    let lobby = setBots(guest.lobby, "p0", 1);
    lobby = startMatch(lobby, "p0", 0);
    lobby = applyAction(lobby, "p0", { type: "skip" }, dict, 0);
    lobby = applyAction(lobby, guest.seatId, { type: "skip" }, dict, 0);
    expect(activePlayer(lobby.match!).isHuman).toBe(false);
    const before = lobby.match?.turnSerial;
    lobby = pump(lobby, 699, createDictionary(""));
    expect(lobby.match?.turnSerial).toBe(before);
    lobby = pump(lobby, 700, createDictionary(""));
    expect(activePlayer(lobby.match!).isHuman).toBe(true);
    expect(lobby.match?.round).toBe(2);
  });

  it("builds codes from the readable alphabet", () => {
    expect(codeFromRolls(scriptedRng([0, 0, 0, 0]))).toBe("AAAA");
    expect(codeFromRolls(scriptedRng([0.999, 0.999, 0.999, 0.999]))).toMatch(/^[A-Z2-9]{4}$/);
    expect(codeFromRolls(scriptedRng([0.999, 0.999, 0.999, 0.999]))).not.toMatch(/[01IO]/);
  });
});
