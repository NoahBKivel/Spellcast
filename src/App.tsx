import { useEffect, useState } from "react";
import { loadDictionary, type Dictionary } from "./game/dictionary";
import { clearJoinHash, codeFromHash, createLobby, joinLobby, loadToken, saveToken } from "./net/room";
import { Menu } from "./ui/menu";
import { RoomSession } from "./ui/room-session";
import { Stage } from "./ui/scene";

type Session = { code: string; token: string };

export function App() {
  const [dict, setDict] = useState<Dictionary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [code, setCode] = useState(codeFromHash);

  useEffect(() => {
    loadDictionary()
      .then(setDict)
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "Could not load the word list");
      });
  }, []);

  useEffect(() => {
    if (!code) return;
    const token = loadToken(code);
    if (token) setSession({ code, token });
  }, [code]);

  function exitRoom(message?: string) {
    clearJoinHash();
    setSession(null);
    setCode("");
    setNotice(message ?? null);
  }

  return (
    <Stage>
      {session && dict ? (
        <RoomSession code={session.code} token={session.token} dict={dict} onExit={exitRoom} />
      ) : (
        <Menu
          loading={!dict && !error}
          error={notice ?? error}
          initialCode={code}
          onCreate={
            dict
              ? async (name) => {
                  const created = await createLobby(name);
                  saveToken(created.code, created.token);
                  setNotice(null);
                  setCode(created.code);
                  setSession(created);
                }
              : undefined
          }
          onJoin={
            dict
              ? async (name, lobbyCode) => {
                  const existing = loadToken(lobbyCode);
                  setNotice(null);
                  if (existing) {
                    setCode(lobbyCode);
                    setSession({ code: lobbyCode, token: existing });
                    return;
                  }
                  const joined = await joinLobby(lobbyCode, name);
                  saveToken(joined.code, joined.token);
                  setCode(joined.code);
                  setSession(joined);
                }
              : undefined
          }
        />
      )}
    </Stage>
  );
}
