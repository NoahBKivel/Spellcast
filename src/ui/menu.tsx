import { useState } from "react";
import type { MatchConfig } from "../game/match";
import { Mascot, Wizard } from "./characters";
import { HelpModal } from "./help";
import { Logo } from "./scene";

type Props = {
  loading?: boolean;
  error?: string | null;
  onStart?: (config: MatchConfig) => void;
};

export function Menu({ loading = false, error = null, onStart }: Props) {
  const [name, setName] = useState("You");
  const [bots, setBots] = useState(4);
  const [help, setHelp] = useState(false);

  return (
    <>
      <Logo />
      <button type="button" className="icon-button help-button" onClick={() => setHelp(true)} aria-label="How to play">
        ?
      </button>
      <div className="menu-layout">
        <Wizard />
        <section className="menu-card">
          <p className="eyebrow">Five rounds · shared board</p>
          <h1>Find the word. Take the points.</h1>
          <label className="field">
            Your name
            <input value={name} maxLength={16} onChange={(event) => setName(event.target.value)} />
          </label>
          <div className="stepper">
            <span>Bots</span>
            <button type="button" onClick={() => setBots((count) => Math.max(0, count - 1))} aria-label="Fewer bots">
              −
            </button>
            <strong>{bots}</strong>
            <button type="button" onClick={() => setBots((count) => Math.min(5, count + 1))} aria-label="More bots">
              +
            </button>
          </div>
          {error && <p className="form-error">{error}</p>}
          <button
            type="button"
            className="menu-button"
            disabled={loading || !onStart}
            onClick={() => onStart?.({ mode: "ffa", humanName: name, botCount: bots })}
          >
            {loading ? "Opening the spellbook…" : "New Game"}
          </button>
          <button
            type="button"
            className="menu-button secondary"
            disabled={loading || !onStart}
            onClick={() => onStart?.({ mode: "2v2", humanName: name, botCount: 3 })}
          >
            2 vs 2
          </button>
          <button type="button" className="menu-button ghost" disabled title="The original 50 adventure levels were never published.">
            Adventure
          </button>
        </section>
        <Mascot />
      </div>
      {help && <HelpModal onClose={() => setHelp(false)} />}
    </>
  );
}
