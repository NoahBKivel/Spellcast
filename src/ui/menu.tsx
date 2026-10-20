import { useState, type ReactNode } from "react";
import { normalizeCode } from "../net/room";
import { Mascot, Wizard } from "./characters";
import { HelpModal } from "./help";

type Props = {
  loading?: boolean;
  error?: string | null;
  initialCode?: string;
  onCreate?: (name: string) => Promise<void>;
  onJoin?: (name: string, code: string) => Promise<void>;
};

export function MenuFrame({ children }: { children: ReactNode }) {
  return (
    <div className="menu-layout">
      <img className="logo-wordmark" src="/art/logo-wordmark.png" alt="Spellcast" />
      <div className="menu-row">
        <Wizard />
        {children}
        <Mascot />
      </div>
    </div>
  );
}

export function Menu({ loading = false, error = null, initialCode = "", onCreate, onJoin }: Props) {
  const [name, setName] = useState("");
  const [code, setCode] = useState(initialCode);
  const [help, setHelp] = useState(false);
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  async function createLobby() {
    if (!onCreate || busy) return;
    setBusy("create");
    setLocalError(null);
    try {
      await onCreate(name);
    } catch (reason) {
      setLocalError(reason instanceof Error ? reason.message : "Could not create a lobby");
    } finally {
      setBusy(null);
    }
  }

  async function joinLobby() {
    if (!onJoin || busy || code.length < 4) return;
    setBusy("join");
    setLocalError(null);
    try {
      await onJoin(name, code);
    } catch (reason) {
      setLocalError(reason instanceof Error ? reason.message : "Could not join that lobby");
    } finally {
      setBusy(null);
    }
  }

  const shownError = localError ?? error;

  return (
    <>
      <button type="button" className="icon-button help-button" onClick={() => setHelp(true)} aria-label="How to play">
        ?
      </button>
      <MenuFrame>
        <section className="menu-card">
          <p className="eyebrow">Five rounds · shared board</p>
          <h1>Find the word. Take the points.</h1>
          <label className="field">
            Your name
            <input
              value={name}
              maxLength={16}
              placeholder="Player"
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          {shownError && <p className="form-error">{shownError}</p>}
          <button type="button" className="menu-button" disabled={loading || !onCreate || busy !== null} onClick={() => void createLobby()}>
            {busy === "create" ? "Opening lobby…" : "Create lobby"}
          </button>
          <label className="field join-field">
            Lobby code
            <input
              value={code}
              maxLength={4}
              placeholder="K7MQ"
              autoCapitalize="characters"
              spellCheck={false}
              onChange={(event) => setCode(normalizeCode(event.target.value))}
              onKeyDown={(event) => {
                if (event.key === "Enter") void joinLobby();
              }}
            />
          </label>
          <button
            type="button"
            className="menu-button"
            disabled={loading || !onJoin || busy !== null || code.length < 4}
            onClick={() => void joinLobby()}
          >
            {busy === "join" ? "Joining…" : "Join"}
          </button>
          <button type="button" className="menu-button" disabled title="The original 50 adventure levels were never published.">
            Adventure
          </button>
        </section>
      </MenuFrame>
      {help && <HelpModal onClose={() => setHelp(false)} />}
    </>
  );
}
