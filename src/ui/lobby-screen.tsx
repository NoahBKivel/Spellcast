import { useState } from "react";
import type { RoomView } from "../game/lobby";
import { joinLink } from "../net/room";
import { MenuFrame } from "./menu";

type Props = {
  room: RoomView;
  onBots: (count: number) => void;
  onStart: () => void;
  onLeave: () => void;
};

export function LobbyScreen({ room, onBots, onStart, onLeave }: Props) {
  const [copied, setCopied] = useState(false);
  const host = room.youId === room.hostId;
  const closed = room.phase === "closed";

  async function copyLink() {
    await navigator.clipboard.writeText(joinLink(room.code));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <MenuFrame>
      <section className="menu-card">
        <p className="eyebrow">{closed ? "Lobby closed" : "Lobby"}</p>
        <div className="code-row">
          <h1>{room.code}</h1>
          {!closed && (
            <button type="button" className="link-button" onClick={() => void copyLink()}>
              {copied ? "Copied" : "Copy link"}
            </button>
          )}
        </div>
        {closed ? (
          <p className="form-error">{room.closeReason ?? "The host left the lobby."}</p>
        ) : (
          <>
            <ul className="roster">
              {room.seats.map((seat) => (
                <li key={seat.id}>
                  <span>{seat.name}</span>
                  {seat.host && <small>Host</small>}
                </li>
              ))}
              {room.bots > 0 && (
                <li>
                  <span>Bots</span>
                  <small>{room.bots}</small>
                </li>
              )}
            </ul>
            {host ? (
              <div className="stepper">
                <span>Bots</span>
                <button type="button" onClick={() => onBots(room.bots - 1)} aria-label="Fewer bots" disabled={room.bots <= 0}>
                  −
                </button>
                <strong>{room.bots}</strong>
                <button
                  type="button"
                  onClick={() => onBots(room.bots + 1)}
                  aria-label="More bots"
                  disabled={room.bots >= room.maxBots}
                >
                  +
                </button>
              </div>
            ) : (
              <p className="wait-line">Waiting for the host…</p>
            )}
            {host && (
              <button type="button" className="menu-button" onClick={onStart}>
                Start
              </button>
            )}
          </>
        )}
        <button type="button" className="link-button leave-link" onClick={onLeave}>
          {closed ? "Back to menu" : "Leave"}
        </button>
      </section>
    </MenuFrame>
  );
}
