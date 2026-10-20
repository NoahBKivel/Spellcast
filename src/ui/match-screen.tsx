import { useEffect, useRef, useState } from "react";
import type { Coord, Tile } from "../game/board";
import type { Dictionary } from "../game/dictionary";
import { HINT_COST, ROUNDS, SHUFFLE_COST, SWAP_COST, TIMER_COST, TIMER_MS } from "../game/letters";
import type { LobbyAction } from "../game/lobby";
import { activePlayer, votesNeeded, type Match } from "../game/match";
import { mulberry32, type Rng } from "../game/rng";
import { scorePath, wordFrom } from "../game/scoring";
import { randomHint } from "../game/solver";
import { BoardView, extendSelection } from "./board-view";
import { Mascot, Wizard } from "./characters";
import { cx } from "./cx";
import { EndScreen } from "./end-screen";
import { HelpModal } from "./help";
import { Logo } from "./scene";

const GEM_SLOTS: [number, number][] = [
  [94.7, 409.1], [110.8, 409.1], [127.0, 408.9], [143.2, 409.1], [159.1, 409.1],
  [94.7, 434.8], [110.8, 434.5], [127.3, 434.5], [143.2, 434.5], [159.1, 434.8],
];

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const REJECT_FLASH_MS = 420;

type Presentation = {
  word: string;
  points: number;
  long: boolean;
  tiles: Tile[];
};

type Props = {
  match: Match;
  youId: string;
  dict: Dictionary;
  onExit: () => void;
  onAction: (action: LobbyAction) => void;
};

export function MatchScreen({ match, youId, dict, onExit, onAction }: Props) {
  const rngRef = useRef<Rng | null>(null);
  if (!rngRef.current) rngRef.current = mulberry32((Math.random() * 1_000_000_000) | 0);

  const matchRef = useRef(match);
  matchRef.current = match;

  const [path, setPath] = useState<Coord[]>([]);
  const pathRef = useRef(path);
  const setPlayPath = (next: Coord[] | ((current: Coord[]) => Coord[])) => {
    const resolved = typeof next === "function" ? next(pathRef.current) : next;
    pathRef.current = resolved;
    setPath(resolved);
  };
  const [rejected, setRejected] = useState<{ word: string; points: number; token: number } | null>(null);
  const rejectToken = useRef(0);
  const rejectTimer = useRef<number | null>(null);
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [swapMode, setSwapMode] = useState(false);
  const [swapAt, setSwapAt] = useState<Coord | null>(null);
  const [help, setHelp] = useState(false);
  const [gate, setGate] = useState(true);
  const [clockMs, setClockMs] = useState(match.timer.remainingMs);
  const resolvingRef = useRef(false);
  const turnStartRef = useRef(performance.now());

  useEffect(() => {
    setPlayPath([]);
    rejectToken.current += 1;
    setRejected(null);
    setSwapMode(false);
    setSwapAt(null);
    turnStartRef.current = performance.now();
  }, [match.turnSerial]);

  useEffect(
    () => () => {
      if (rejectTimer.current !== null) window.clearTimeout(rejectTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (match.phase === "ended") {
      setGate(false);
      return;
    }
    setGate(true);
    const id = window.setTimeout(() => setGate(false), 850);
    return () => window.clearTimeout(id);
  }, [match.round, match.phase]);

  useEffect(() => {
    setClockMs(match.timer.remainingMs);
  }, [match.turnSerial, match.timer.running, match.timer.remainingMs]);

  useEffect(() => {
    if (!match.timer.running || match.phase === "ended") return;
    const id = window.setInterval(() => {
      setClockMs((ms) => Math.max(0, ms - 100));
    }, 100);
    return () => window.clearInterval(id);
  }, [match.timer.running, match.phase, match.turnSerial]);

  const me = match.players.find((player) => player.id === youId) ?? match.players[0];
  const active = activePlayer(match);
  const myTurn = active.id === youId && match.phase === "playing" && !gate && presentation === null;
  const word = path.length > 0 ? wordFrom(match.board, path) : "";
  const solo = match.players.length === 1;
  const canVote =
    match.phase === "playing" &&
    !match.timer.running &&
    presentation === null &&
    !gate &&
    !match.timer.votes.includes(me.id) &&
    (solo || active.id !== me.id);

  async function presentPath(playPath: Coord[], serial: number) {
    if (resolvingRef.current) return;
    const current = matchRef.current;
    if (current.turnSerial !== serial || current.phase !== "playing") return;
    resolvingRef.current = true;
    const result = scorePath(current.board, playPath);
    setPresentation({
      word: wordFrom(current.board, playPath),
      points: result.points,
      long: result.long,
      tiles: playPath.map(({ r, c }) => current.board[r][c]),
    });
    await wait(1150);
    if (matchRef.current.turnSerial !== serial || matchRef.current.phase !== "playing") {
      resolvingRef.current = false;
      setPresentation(null);
      return;
    }
    const elapsed = performance.now() - turnStartRef.current;
    onAction({ type: "play", path: playPath, elapsedMs: elapsed });
    setPlayPath([]);
    setPresentation(null);
    resolvingRef.current = false;
  }

  function releaseSelection() {
    if (presentation || resolvingRef.current) return;
    const current = matchRef.current;
    const playing = activePlayer(current).id === youId && current.phase === "playing" && !gate && presentation === null;
    if (!playing) return;
    const playPath = pathRef.current;
    if (playPath.length < 2) return;
    const spelled = wordFrom(current.board, playPath);
    if (dict.has(spelled)) {
      void presentPath(playPath, current.turnSerial);
      return;
    }
    const token = ++rejectToken.current;
    setRejected({ word: spelled, points: 0, token });
    setPlayPath([]);
    if (rejectTimer.current !== null) window.clearTimeout(rejectTimer.current);
    rejectTimer.current = window.setTimeout(() => {
      if (rejectToken.current === token) setRejected(null);
    }, REJECT_FLASH_MS);
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Backspace") {
        event.preventDefault();
        setPlayPath((current) => current.slice(0, -1));
      }
      if (event.key === "Escape") {
        setPlayPath([]);
        setSwapMode(false);
        setSwapAt(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const clock = formatClock(clockMs);
  const timerRatio = Math.min(1, Math.max(0, clockMs / TIMER_MS));
  const showingReject = rejected !== null && path.length === 0 && presentation === null;
  const longWord = !!presentation?.long;
  const bannerWord = presentation?.word ?? (path.length > 0 ? word : showingReject ? rejected.word : "");
  const bannerPoints = presentation?.points ?? null;

  return (
    <>
      <Logo />
      <button type="button" className="icon-button back-button" onClick={onExit} aria-label="Leave match">
        <svg className="back-arrow" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18.4 12H6.4" />
          <path d="M10.9 7.2 5.6 12l5.3 4.8" />
        </svg>
      </button>
      <div className="playfield">
        <Wizard floating celebrate={!!presentation?.long} />
        <div className="tablet-frame">
          <img src="/art/tablet.png?v=clean" alt="" className="tablet-img" />
          <div className={cx("word-slot", showingReject && "reject")} key={showingReject ? `reject-${rejected.token}` : "word"}>
            {bannerWord && <span>{bannerWord}</span>}
            {bannerPoints !== null && <strong>+{bannerPoints}</strong>}
          </div>
          <div className="board-slot">
            {longWord && <div className="long-word">Long word!</div>}
            <BoardView
              board={match.board}
              path={path}
              interactive={myTurn}
              onTile={(coord, source) => {
                if (swapMode) {
                  if (source === "down") setSwapAt(coord);
                  return;
                }
                if (rejectToken.current) {
                  rejectToken.current += 1;
                  setRejected(null);
                }
                const next = extendSelection(pathRef.current, coord, match.board, source === "down");
                setPlayPath(next);
              }}
              onRelease={() => {
                if (!swapMode) releaseSelection();
              }}
            />
          </div>
          <span className="seat-pip" aria-hidden="true">{me.name.slice(0, 1)}</span>
          <div className="gem-tray" aria-label={`${me.gems} gems`}>
            {GEM_SLOTS.slice(0, me.gems).map(([left, top], index) => (
              <img key={index} src="/art/gem.png?v=hd" alt="" className="tray-gem" style={{ left, top }} />
            ))}
          </div>
          <button
            type="button"
            className="hit hit-shuffle"
            aria-label={`Shuffle ${SHUFFLE_COST}`}
            disabled={!myTurn || me.gems < SHUFFLE_COST}
            onClick={() => {
              onAction({ type: "shuffle" });
              setPlayPath([]);
            }}
          />
          <button
            type="button"
            className={cx("hit hit-swap", swapMode && "pressed")}
            aria-label={`Swap ${SWAP_COST}`}
            disabled={!myTurn || me.gems < SWAP_COST}
            onClick={() => {
              setSwapMode((on) => !on);
              setSwapAt(null);
              setPlayPath([]);
            }}
          />
          <button
            type="button"
            className="hit hit-hint"
            aria-label={`Hint ${HINT_COST}`}
            disabled={!myTurn || me.gems < HINT_COST}
            onClick={() => {
              const hint = randomHint(matchRef.current.board, dict, rngRef.current!);
              if (!hint) return;
              onAction({ type: "hint" });
              setSwapMode(false);
              setPlayPath(hint.path);
            }}
          />
          <button type="button" className="hit hit-help" aria-label="How to play" onClick={() => setHelp(true)} />
          <button
            type="button"
            className={cx("timer-hit", match.timer.running && "running")}
            aria-label={
              match.timer.running
                ? `Timer ${clock}`
                : `Start timer, ${match.timer.votes.length} of ${votesNeeded(match)}`
            }
            disabled={!canVote && !(match.timer.running && myTurn && me.gems >= TIMER_COST)}
            onClick={() => {
              const current = matchRef.current;
              if (current.timer.running && activePlayer(current).id === youId) onAction({ type: "extend" });
              else onAction({ type: "vote" });
            }}
          >
            {match.timer.running ? (
              <span className="timer-run" aria-hidden="true">
                <span className="timer-track">
                  <span className="timer-fill" style={{ width: `${timerRatio * 100}%` }} />
                </span>
                <img
                  className="timer-head"
                  src="/art/timer-head.png"
                  alt=""
                  style={{ left: `${timerRatio * 100}%` }}
                />
              </span>
            ) : (
              <span>Start timer</span>
            )}
          </button>
        </div>
        <Scoreboard match={match} activeId={active.id} />
        <Mascot floating celebrate={!!presentation?.long} />
      </div>
      {gate && match.phase !== "ended" && <div className="round-announce">Round {match.round}</div>}
      {swapMode && swapAt && myTurn && (
        <div className="modal-back" onClick={() => setSwapAt(null)}>
          <div className="letter-picker" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="Choose a letter">
            <h2>Swap this tile</h2>
            <div className="letters">
              {ALPHABET.map((letter) => (
                <button
                  key={letter}
                  type="button"
                    onClick={() => {
                    onAction({ type: "swap", coord: swapAt, letter });
                    setSwapMode(false);
                    setSwapAt(null);
                  }}
                >
                  {letter}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {swapMode && !swapAt && myTurn && <p className="swap-hint">Pick a tile to change</p>}
      {match.phase === "ended" && <EndScreen match={match} onAgain={onExit} />}
      {help && <HelpModal onClose={() => setHelp(false)} />}
    </>
  );
}

function Scoreboard({ match, activeId }: { match: Match; activeId: string }) {
  return (
    <aside className="scoreboard">
      <div className="round-badge">
        <img src="/art/round-badge.png" alt="" />
        <span>
          Round {match.round}/{ROUNDS}
        </span>
      </div>
      <div className="player-card">
        <div>
              {match.players.map((player) => {
                const active = player.id === activeId;
                return (
                  <div key={player.id} className={cx("player-row", active && "active")}>
                    <span className="avatar-wrap">
                      <span
                        className="avatar"
                        style={{ borderColor: RING_COLORS[player.color % RING_COLORS.length] }}
                      >
                        {player.name.slice(0, 1)}
                        <i className="status-pip" aria-hidden="true" />
                      </span>
                      <span className="gem-badge" aria-label={`${player.gems} gems`}>
                        <img src="/art/hud-gem.png" alt="" />
                        <b>{player.gems}</b>
                      </span>
                    </span>
                    <span className="who">
                      <strong>{player.name}</strong>
                      {player.lastWord && (
                        <small>
                          {player.lastWord}
                          {player.lastGain !== null ? ` +${player.lastGain}` : ""}
                        </small>
                      )}
                    </span>
                    <span className="score-badge">
                      <img src="/art/score-hex.png" alt="" />
                      <b>{player.score}</b>
                      {active && <img className="turn-mark" src="/art/turn-arrow.png" alt="" />}
                    </span>
                  </div>
                );
              })}
        </div>
      </div>
    </aside>
  );
}

const RING_COLORS = ["#e94ec8", "#f3b4e6", "#7eb6ff", "#ffd15c", "#b388ff", "#ff8a6a"];

function formatClock(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `0:${seconds.toString().padStart(2, "0")}`;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

