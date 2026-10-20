import { getServerByName, routePartykitRequest, Server, type Connection } from "partyserver";
import wordList from "../public/dictionary/enable1.txt";
import { createDictionary, type Dictionary } from "../src/game/dictionary";
import {
  applyAction,
  codeFromRolls,
  connectSeat,
  createLobby,
  disconnect,
  joinLobby,
  leaveSeat,
  nextWake,
  present,
  pump,
  roomView,
  seatForToken,
  setBots,
  startMatch,
  CODE_ALPHABET,
  type Lobby,
  type LobbyAction,
} from "../src/game/lobby";
import type { Rng } from "../src/game/rng";
import type { Coord } from "../src/game/board";

type Env = {
  SpellRoom: DurableObjectNamespace<SpellRoom>;
};

let dictionaryValue: Dictionary | null = null;

function dictionary(): Dictionary {
  dictionaryValue ??= createDictionary(wordList);
  return dictionaryValue;
}

function cors(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

function makeCode(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const rolls = [...bytes].map((byte) => byte / 256);
  let index = 0;
  const rng: Rng = () => rolls[index++] ?? 0;
  return codeFromRolls(rng);
}

function randomSeed(): number {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return bytes[0] ?? 1;
}

async function readBody(request: Request): Promise<{ name: string; token: string }> {
  const body = (await request.json()) as { name?: unknown; token?: unknown };
  return {
    name: typeof body.name === "string" ? body.name : "",
    token: typeof body.token === "string" ? body.token : crypto.randomUUID(),
  };
}

export class SpellRoom extends Server<Env> {
  static options = { hibernate: false };

  private sockets = new Map<string, string>();

  private async read(): Promise<Lobby | null> {
    return (await this.ctx.storage.get<Lobby>("lobby")) ?? null;
  }

  private async commit(lobby: Lobby, now = Date.now()): Promise<void> {
    const next = pump(lobby, now, dictionary());
    await this.ctx.storage.put("lobby", next);
    this.sendState(next, now);
    const wake = nextWake(next, now);
    if (wake === null) await this.ctx.storage.deleteAlarm();
    else await this.ctx.storage.setAlarm(Math.max(wake, Date.now() + 20));
    if (next.phase === "closed") {
      for (const connection of this.getConnections()) connection.close(1000, next.closeReason ?? "closed");
    }
  }

  private sendState(lobby: Lobby, now: number): void {
    const shown = present(lobby, now);
    const connected = [...this.sockets.values()];
    for (const connection of this.getConnections()) {
      const seatId = this.sockets.get(connection.id);
      if (!seatId) continue;
      connection.send(JSON.stringify({ type: "state", room: roomView(shown, seatId, connected) }));
    }
  }

  private fail(connection: Connection, message: string): void {
    connection.send(JSON.stringify({ type: "error", message }));
    connection.close(1008, message);
  }

  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/create") {
      if (await this.read()) return json({ error: "That code is taken" }, 409);
      const { name, token } = await readBody(request);
      const lobby = createLobby(this.name, name, token, randomSeed());
      await this.ctx.storage.put("lobby", lobby);
      return json({ code: this.name, token });
    }
    if (request.method === "POST" && url.pathname === "/join") {
      const existing = await this.read();
      if (!existing) return json({ error: "That lobby does not exist" }, 404);
      const { name, token } = await readBody(request);
      const joined = joinLobby(existing, name, token);
      if (!joined.ok) return json({ error: joined.error }, 409);
      await this.commit(joined.lobby);
      return json({ code: this.name, token });
    }
    return json({ error: "Not found" }, 404);
  }

  async onMessage(connection: Connection, message: ArrayBuffer | ArrayBufferView | string): Promise<void> {
    const text = typeof message === "string" ? message : new TextDecoder().decode(message);
    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      return;
    }
    if (!payload || typeof payload !== "object") return;
    const data = payload as { type?: string; token?: unknown; count?: unknown };

    if (data.type === "auth") {
      const lobby = await this.read();
      const token = typeof data.token === "string" ? data.token : "";
      const seat = lobby ? seatForToken(lobby, token) : null;
      if (!lobby || !seat) {
        this.fail(connection, "That lobby does not exist");
        return;
      }
      this.sockets.set(connection.id, seat.id);
      await this.commit(connectSeat(lobby, seat.id));
      return;
    }

    const seatId = this.sockets.get(connection.id);
    const lobby = await this.read();
    if (!seatId || !lobby) {
      this.fail(connection, "Join the lobby first");
      return;
    }
    const now = Date.now();
    if (data.type === "setBots" && typeof data.count === "number") {
      await this.commit(setBots(lobby, seatId, data.count), now);
      return;
    }
    if (data.type === "start") {
      await this.commit(startMatch(lobby, seatId, now), now);
      return;
    }
    if (data.type === "leave") {
      this.sockets.delete(connection.id);
      await this.commit(leaveSeat(lobby, seatId), now);
      return;
    }
    const action = readAction(data);
    if (!action) return;
    await this.commit(applyAction(lobby, seatId, action, dictionary(), now), now);
  }

  async onClose(connection: Connection): Promise<void> {
    const seatId = this.sockets.get(connection.id);
    this.sockets.delete(connection.id);
    if (!seatId || [...this.sockets.values()].includes(seatId)) return;
    const lobby = await this.read();
    if (!lobby || lobby.phase === "closed") return;
    await this.commit(disconnect(lobby, seatId, Date.now()));
  }

  async onAlarm(): Promise<void> {
    const lobby = await this.read();
    if (!lobby) return;
    await this.commit(lobby);
  }
}

function readAction(data: { type?: string; path?: unknown; elapsedMs?: unknown; coord?: unknown; letter?: unknown }): LobbyAction | null {
  if (data.type === "skip" || data.type === "vote" || data.type === "extend" || data.type === "shuffle" || data.type === "hint") {
    return { type: data.type };
  }
  if (data.type === "play" && Array.isArray(data.path)) {
    const path: Coord[] = [];
    for (const item of data.path) {
      if (!item || typeof item !== "object") return null;
      const coord = item as { r?: unknown; c?: unknown };
      if (typeof coord.r !== "number" || typeof coord.c !== "number") return null;
      path.push({ r: coord.r, c: coord.c });
    }
    return { type: "play", path, elapsedMs: typeof data.elapsedMs === "number" ? data.elapsedMs : 0 };
  }
  if (data.type === "swap" && data.coord && typeof data.coord === "object" && typeof data.letter === "string") {
    const coord = data.coord as { r?: unknown; c?: unknown };
    if (typeof coord.r !== "number" || typeof coord.c !== "number") return null;
    return { type: "swap", coord: { r: coord.r, c: coord.c }, letter: data.letter };
  }
  return null;
}

function validCode(code: string): boolean {
  return code.length === 4 && [...code].every((character) => CODE_ALPHABET.includes(character));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/api/lobbies") {
      const { name } = await readBody(request);
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const code = makeCode();
        const token = crypto.randomUUID();
        const stub = await getServerByName(env.SpellRoom, code);
        const response = await stub.fetch("https://spellcast.local/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, token }),
        });
        if (response.status === 409) continue;
        if (!response.ok) return cors(response);
        return cors(json({ code, token }));
      }
      return cors(json({ error: "Could not create a lobby" }, 503));
    }

    const join = url.pathname.match(/^\/api\/lobbies\/([A-Z0-9]{4})\/join$/i);
    if (request.method === "POST" && join) {
      const code = join[1].toUpperCase();
      if (!validCode(code)) return cors(json({ error: "That lobby does not exist" }, 404));
      const { name } = await readBody(request);
      const token = crypto.randomUUID();
      const stub = await getServerByName(env.SpellRoom, code);
      const response = await stub.fetch("https://spellcast.local/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, token }),
      });
      if (!response.ok) return cors(response);
      return cors(json({ code, token }));
    }

    return (
      (await routePartykitRequest(request, env, { cors: true })) ??
      cors(json({ error: "Not found" }, 404))
    );
  },
};
