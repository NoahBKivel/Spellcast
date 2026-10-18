import type { Match } from "../game/match";

export function EndScreen({ match, onAgain }: { match: Match; onAgain: () => void }) {
  const result = match.result;
  if (!result) return null;
  const ranked = [...match.players].sort((a, b) => b.score - a.score);
  const letterName = match.players.find((player) => player.id === result.letterrate?.playerId)?.name;
  const fastName = match.players.find((player) => player.id === result.fast?.playerId)?.name;
  const winner = match.players.find((player) => player.id === result.winnerIds[0]);
  const winnerName = winner?.name ?? "Someone";
  const headline = result.tie
    ? "It's a tie"
    : match.mode === "2v2"
      ? result.winnerIds.includes(match.players[0].id)
        ? "Your team wins"
        : "Rivals win"
      : winnerName.toLowerCase() === "you"
        ? "You win"
        : `${winnerName} wins`;

  return (
    <div className="modal-back">
      <div className="end-card" role="dialog" aria-labelledby="end-title">
        <h2 id="end-title">{headline}</h2>
        {result.teamScores && (
          <p className="team-line">
            Your team {result.teamScores[0]} · Rivals {result.teamScores[1]}
          </p>
        )}
        <ol className="standings">
          {ranked.map((player) => (
            <li key={player.id} className={result.winnerIds.includes(player.id) ? "winner" : ""}>
              <span>{player.name}</span>
              <span>
                {player.score}
                {player.gemBonus > 0 && <small> +{player.gemBonus} gems</small>}
              </span>
            </li>
          ))}
        </ol>
        <div className="awards">
          {result.letterrate && (
            <p>
              <strong>Letterrate</strong>
              <span>
                {letterName} · {result.letterrate.word} ({result.letterrate.points})
              </span>
            </p>
          )}
          {result.fast && (
            <p>
              <strong>Fast and Furious</strong>
              <span>
                {fastName} · {(result.fast.ms! / 1000).toFixed(1)}s
              </span>
            </p>
          )}
        </div>
        <button type="button" className="menu-button" onClick={onAgain}>
          Play again
        </button>
      </div>
    </div>
  );
}
