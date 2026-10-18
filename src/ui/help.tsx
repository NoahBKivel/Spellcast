import {
  HINT_COST,
  LONG_WORD_AT,
  LONG_WORD_BONUS,
  POINTS_TABLE,
  ROUNDS,
  SHUFFLE_COST,
  SWAP_COST,
  TIMER_COST,
} from "../game/letters";

export function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-back" onClick={onClose} role="presentation">
      <div
        className="help-card"
        role="dialog"
        aria-labelledby="info-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="info-title">How to play</h2>
        <ul className="rules">
          <li>Drag through neighboring letters and let go. A real word scores. Anything else flashes red and clears.</li>
          <li>Letter points add up first. DL and TL multiply that letter, then 2x and 3x tiles multiply the word.</li>
          <li>
            {LONG_WORD_AT} letters or more adds {LONG_WORD_BONUS} points. That bonus is not multiplied.
          </li>
          <li>
            Gems on tiles are collected. Shuffle costs {SHUFFLE_COST}, the timer costs {TIMER_COST}, swap costs {SWAP_COST},
            and a hint costs {HINT_COST}.
          </li>
          <li>{ROUNDS} rounds. Leftover gems are added to your score.</li>
        </ul>
        <h3>Letter points</h3>
        <table>
          <thead>
            <tr>
              <th>Letters</th>
              <th>Point value</th>
            </tr>
          </thead>
          <tbody>
            {POINTS_TABLE.map((row) => (
              <tr key={row.letters}>
                <td>{row.letters}</td>
                <td>{row.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>Bear scores 8.</p>
        <button type="button" className="text-button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
