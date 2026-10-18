import { useEffect, useState } from "react";
import { loadDictionary, type Dictionary } from "./game/dictionary";
import type { MatchConfig } from "./game/match";
import { MatchScreen } from "./ui/match-screen";
import { Menu } from "./ui/menu";
import { Stage } from "./ui/scene";

export function App() {
  const [dict, setDict] = useState<Dictionary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [setup, setSetup] = useState<MatchConfig | null>(null);

  useEffect(() => {
    loadDictionary()
      .then(setDict)
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "Could not load the word list");
      });
  }, []);

  return (
    <Stage>
      {setup && dict ? (
        <MatchScreen config={setup} dict={dict} onExit={() => setSetup(null)} />
      ) : (
        <Menu loading={!dict && !error} error={error} onStart={dict ? setSetup : undefined} />
      )}
    </Stage>
  );
}
