import type { LobbyAction, RoomView } from "../game/lobby";

const ROOM_HOST = import.meta.env.VITE_ROOM_HOST ?? "http://localhost:8787";

export function seatKey(code: string): string {
  return `spellcast-seat:${code}`;
}

export function loadToken(code: string): string | null {
  return sessionStorage.getItem(seatKey(code));
}

export function saveToken(code: string, token: string): void {
  sessionStorage.setItem(seatKey(code), token);
}

export function clearToken(code: string): void {
  sessionStorage.removeItem(seatKey(code));
}

export function codeFromHash(): string {
  const match = window.location.hash.match(/^#\/j\/([A-HJ-NP-Z2-9]{4})$/i);
  return match ? match[1].toUpperCase() : "";
}

export function setJoinHash(code: string): void {
  const next = `${window.location.pathname}${window.location.search}#/j/${code}`;
  window.history.replaceState(null, "", next);
}

export function clearJoinHash(): void {
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
}

export function joinLink(code: string): string {
  return `${window.location.origin}${window.location.pathname}${window.location.search}#/j/${code}`;
}

export function normalizeCode(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-HJ-NP-Z2-9]/g, "")
    .slice(0, 4);
}

function roomHttp(path: string): string {
  return new URL(path, ROOM_HOST).toString();
}

export function roomSocketUrl(code: string): string {
  const url = new URL(ROOM_HOST);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `/parties/spell-room/${code}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(roomHttp(path), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("The lobby server is not running");
  }
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || "The lobby could not be reached");
  return payload;
}

export function createLobby(name: string): Promise<{ code: string; token: string }> {
  return postJson("/api/lobbies", { name });
}

export function joinLobby(code: string, name: string): Promise<{ code: string; token: string }> {
  return postJson(`/api/lobbies/${code}/join`, { name });
}

export type RoomMessage =
  | { type: "state"; room: RoomView }
  | { type: "error"; message: string };

export type ClientMessage =
  | { type: "auth"; token: string }
  | { type: "setBots"; count: number }
  | { type: "start" }
  | { type: "leave" }
  | LobbyAction;
