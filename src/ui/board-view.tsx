import { useLayoutEffect, useRef, useState } from "react";
import { adjacent, sameCoord, type Board, type Coord } from "../game/board";
import { TileFace } from "./tiles";

type Props = {
  board: Board;
  path: Coord[];
  interactive: boolean;
  onTile: (coord: Coord, source: "down" | "move") => void;
  onRelease?: () => void;
};

export function BoardView({ board, path, interactive, onTile, onRelease }: Props) {
  const gridRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [centers, setCenters] = useState<{ x: number; y: number }[]>([]);

  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid || path.length === 0) {
      setCenters([]);
      return;
    }
    const next = path.map((coord) => {
      const cell = grid.querySelector<HTMLElement>(`[data-r="${coord.r}"][data-c="${coord.c}"]`);
      if (!cell) return { x: 0, y: 0 };
      return {
        x: cell.offsetLeft + cell.offsetWidth / 2,
        y: cell.offsetTop + cell.offsetHeight / 2,
      };
    });
    setCenters(next);
  }, [path, board]);

  const selected = (coord: Coord) => path.some((item) => sameCoord(item, coord));

  const endDrag = () => {
    const wasDragging = dragging.current;
    dragging.current = false;
    if (wasDragging) onRelease?.();
  };

  return (
    <div
      className={interactive ? "grid" : "grid locked"}
      ref={gridRef}
      onPointerDown={(event) => {
        if (!interactive) return;
        const coord = coordFrom(event.target);
        if (!coord) return;
        dragging.current = true;
        onTile(coord, "down");
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Capture is unavailable if the pointer was already released.
        }
      }}
      onPointerMove={(event) => {
        if (!dragging.current || !interactive) return;
        const hit = document.elementFromPoint(event.clientX, event.clientY);
        const cell = hit?.closest<HTMLElement>("[data-r]");
        if (!cell?.dataset.r || !cell.dataset.c) return;
        const coord = { r: Number(cell.dataset.r), c: Number(cell.dataset.c) };
        onTile(coord, "move");
      }}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <svg className="path-line" aria-hidden="true">
        {centers.length > 1 && (
          <polyline points={centers.map((point) => `${point.x},${point.y}`).join(" ")} />
        )}
      </svg>
      {board.map((row, r) =>
        row.map((tile, c) => (
          <button
            key={tile.id}
            type="button"
            className="cell"
            data-r={r}
            data-c={c}
            data-letter={tile.letter}
            disabled={!interactive}
            aria-label={`${tile.letter}${tile.gem ? " with gem" : ""}${tile.wordMult > 1 ? ` ${tile.wordMult}x` : ""}`}
          >
            <TileFace tile={tile} selected={selected({ r, c })} />
          </button>
        )),
      )}
    </div>
  );
}

function coordFrom(target: EventTarget | null): Coord | null {
  const cell = target instanceof Element ? target.closest<HTMLElement>("[data-r]") : null;
  if (!cell?.dataset.r || !cell.dataset.c) return null;
  return { r: Number(cell.dataset.r), c: Number(cell.dataset.c) };
}

export function extendSelection(path: Coord[], coord: Coord, board: Board, restart: boolean): Coord[] {
  if (board[coord.r][coord.c].frozen) return path;
  if (path.length === 0) return [coord];
  const last = path[path.length - 1];
  if (sameCoord(last, coord)) return path;
  if (path.length >= 2 && sameCoord(path[path.length - 2], coord)) return path.slice(0, -1);
  if (path.some((item) => sameCoord(item, coord))) return restart ? [coord] : path;
  if (!adjacent(last, coord)) return restart ? [coord] : path;
  return [...path, coord];
}
