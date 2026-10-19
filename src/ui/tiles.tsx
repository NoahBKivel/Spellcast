import type { Tile } from "../game/board";
import { LETTER_VALUES } from "../game/letters";
import { cx } from "./cx";

export function Crystal({ className }: { className?: string }) {
  return <img src="/art/gem.png?v=hd" alt="" className={className} />;
}

export function TileFace({
  tile,
  selected = false,
  dimmed = false,
}: {
  tile: Tile;
  selected?: boolean;
  dimmed?: boolean;
}) {
  return (
    <div
      className={cx(
        "tile",
        selected && "selected",
        dimmed && "dimmed",
        tile.wordMult === 2 && "x2",
        tile.wordMult === 3 && "x3",
        tile.frozen && "frozen",
      )}
    >
      {tile.letterMult > 1 && <span className="boost">{tile.letterMult === 2 ? "DL" : "TL"}</span>}
      {tile.wordMult > 1 && <span className="mult-badge">{tile.wordMult}x</span>}
      <span className="glyph">{tile.letter}</span>
      <span className="pv">{LETTER_VALUES[tile.letter]}</span>
      {tile.gem && <Crystal className="tile-gem" />}
    </div>
  );
}
