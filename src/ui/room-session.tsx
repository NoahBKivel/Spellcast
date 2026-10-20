import { useEffect, useRef, useState } from "react";
import type { Dictionary } from "../game/dictionary";
import type { LobbyAction, RoomView } from "../game/lobby";
import { clearToken, roomSocketUrl, setJoinHash, type ClientMessage, type RoomMessage } from "../net/room";
import { LobbyScreen } from "./lobby-screen";
import { MatchScreen } from "./match-screen";

type Props = {
  code: string;
  token: string;
  dict: Dictionary;
  onExit: (message?: string) => void;
};

export function RoomSession({ code, token, dict, onExit }: Props) {
  const [room, setRoom] = useState<RoomView | null>(null);
  const [status, setStatus] = useState("Opening the lobby…");
  const socketRef = useRef<WebSocket | null>(null);
  const leaveRef = useRef(false);
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;

  function send(message: ClientMessage) {
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  }

  useEffect(() => {
    let cancelled = false;
    leaveRef.current = false;
    setJoinHash(code);
    let socket: WebSocket | null = null;
    let retry: number | null = null;
    let attempt = 0;

    const connect = () => {
      socket = new WebSocket(roomSocketUrl(code));
      socketRef.current = socket;
      socket.onopen = () => {
        attempt = 0;
        socket?.send(JSON.stringify({ type: "auth", token }));
      };
      socket.onmessage = (event) => {
        const message = JSON.parse(String(event.data)) as RoomMessage;
        if (message.type === "error") {
          cancelled = true;
          leaveRef.current = true;
          clearToken(code);
          onExitRef.current(message.message);
          socket?.close();
          return;
        }
        setRoom(message.room);
        setStatus("");
      };
      socket.onclose = () => {
        if (cancelled || leaveRef.current) return;
        attempt += 1;
        if (attempt > 5) {
          onExitRef.current("Lost the lobby connection");
          return;
        }
        retry = window.setTimeout(connect, 600);
      };
    };

    connect();
    return () => {
      cancelled = true;
      leaveRef.current = true;
      if (retry !== null) window.clearTimeout(retry);
      socket?.close();
    };
  }, [code, token]);

  function leave() {
    leaveRef.current = true;
    send({ type: "leave" });
    clearToken(code);
    socketRef.current?.close();
    onExit();
  }

  if (!room) {
    return (
      <p className="lobby-status" role="status">
        {status}
      </p>
    );
  }

  if (room.phase === "playing" && room.match) {
    return (
      <MatchScreen
        match={room.match}
        youId={room.youId}
        dict={dict}
        onExit={leave}
        onAction={(action: LobbyAction) => send(action)}
      />
    );
  }

  return (
    <LobbyScreen
      room={room}
      onBots={(count) => send({ type: "setBots", count })}
      onStart={() => send({ type: "start" })}
      onLeave={leave}
    />
  );
}
