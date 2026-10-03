import React, { useMemo, useRef, useState } from 'react';
import { GameShell } from '../components/GameShell';
import { getGameById } from '../data/games';
import { playClearSound, playGameOverSound, playMoveSound } from '../utils/sound';

const GRID = 10;
const LETTERS = 'ABCDEFGHIJ';
const FLEET = [5, 4, 3, 3, 2];
const TOTAL_SHIP_CELLS = FLEET.reduce((sum, size) => sum + size, 0);

const createFleet = (): number[][] => {
  const occupied = new Set<number>();
  const ships: number[][] = [];
  FLEET.forEach(size => {
    for (let attempt = 0; attempt < 800; attempt++) {
      const horizontal = Math.random() < 0.5;
      const row = Math.floor(Math.random() * (horizontal ? GRID : GRID - size + 1));
      const col = Math.floor(Math.random() * (horizontal ? GRID - size + 1 : GRID));
      const cells = Array.from(
        { length: size },
        (_, offset) => (row + (horizontal ? 0 : offset)) * GRID + col + (horizontal ? offset : 0),
      );
      if (cells.every(cell => !occupied.has(cell))) {
        cells.forEach(cell => occupied.add(cell));
        ships.push(cells);
        return;
      }
    }
  });
  return ships;
};

const flatten = (ships: number[][]) => ships.flat();
const cellLabel = (cell: number) => `${LETTERS[Math.floor(cell / GRID)]}${cell % GRID + 1}`;

const neighbours = (cell: number): number[] => {
  const row = Math.floor(cell / GRID);
  const col = cell % GRID;
  const out: number[] = [];
  if (row > 0) out.push(cell - GRID);
  if (row < GRID - 1) out.push(cell + GRID);
  if (col > 0) out.push(cell - 1);
  if (col < GRID - 1) out.push(cell + 1);
  return out;
};

/** Hunt/target AI: follow up beside confirmed hits, otherwise fire at random. */
const pickTarget = (shots: number[], ships: number[][]): number => {
  const taken = new Set(shots);
  const shipCells = new Set(flatten(ships));

  const unsunkHit = new Set<number>();
  for (const ship of ships) {
    const hitCells = ship.filter(cell => taken.has(cell));
    if (hitCells.length > 0 && hitCells.length < ship.length) {
      hitCells.forEach(cell => unsunkHit.add(cell));
    }
  }

  const hunt = new Set<number>();
  for (const cell of unsunkHit) {
    for (const next of neighbours(cell)) {
      if (!taken.has(next)) hunt.add(next);
    }
  }

  if (hunt.size > 0) {
    const aligned = [...hunt].filter(next => {
      const row = Math.floor(next / GRID);
      const col = next % GRID;
      return [...unsunkHit].some(cell => {
        const otherRow = Math.floor(cell / GRID);
        const otherCol = cell % GRID;
        return otherRow === row || otherCol === col;
      });
    });
    const pool = aligned.length > 0 ? aligned : [...hunt];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  const open = Array.from({ length: GRID * GRID }, (_, cell) => cell).filter(cell => !taken.has(cell));
  return open[Math.floor(Math.random() * open.length)];
};

const FleetPips: React.FC<{ sunk: number }> = ({ sunk }) => (
  <span className="inline-flex items-center gap-1">
    {FLEET.map((size, index) => (
      <span
        key={index}
        title={`Tàu ${size} ô`}
        className="inline-block rounded-[2px]"
        style={{
          width: `${size * 5}px`,
          height: '7px',
          background: index < sunk ? '#334155' : '#22c55e',
        }}
      />
    ))}
  </span>
);

export const BattleshipGame: React.FC<{ onBackToHub: () => void }> = ({ onBackToHub }) => {
  const gameMeta = getGameById('battleship')!;
  const [playerShips, setPlayerShips] = useState<number[][]>(createFleet);
  const [enemyShips, setEnemyShips] = useState<number[][]>(createFleet);
  const [playerShots, setPlayerShots] = useState<number[]>([]);
  const [computerShots, setComputerShots] = useState<number[]>([]);
  const [thinking, setThinking] = useState(false);
  const [ended, setEnded] = useState(false);
  const [won, setWon] = useState(false);
  const [score, setScore] = useState(0);
  const [lastShot, setLastShot] = useState<number | null>(null);
  const [lastEnemyShot, setLastEnemyShot] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const playerCells = useMemo(() => flatten(playerShips), [playerShips]);
  const enemyCells = useMemo(() => flatten(enemyShips), [enemyShips]);

  const playerHits = playerShots.filter(cell => enemyCells.includes(cell)).length;
  const computerHits = computerShots.filter(cell => playerCells.includes(cell)).length;
  const playerMisses = playerShots.length - playerHits;
  const enemySunk = enemyShips.filter(ship => ship.every(cell => playerShots.includes(cell))).length;
  const ownSunk = playerShips.filter(ship => ship.every(cell => computerShots.includes(cell))).length;

  const restart = () => {
    if (timer.current) clearTimeout(timer.current);
    setPlayerShips(createFleet());
    setEnemyShips(createFleet());
    setPlayerShots([]);
    setComputerShots([]);
    setThinking(false);
    setEnded(false);
    setWon(false);
    setScore(0);
    setLastShot(null);
    setLastEnemyShot(null);
  };

  const fire = (cell: number) => {
    if (ended || thinking || playerShots.includes(cell)) return;
    const nextPlayerShots = [...playerShots, cell];
    const hit = enemyCells.includes(cell);
    setPlayerShots(nextPlayerShots);
    setLastShot(cell);
    playMoveSound();

    const nextHits = nextPlayerShots.filter(c => enemyCells.includes(c)).length;
    if (nextHits === TOTAL_SHIP_CELLS) {
      setEnded(true);
      setWon(true);
      setScore(Math.max(150, 1200 - (nextPlayerShots.length - nextHits) * 25));
      playClearSound();
      return;
    }

    setThinking(true);
    timer.current = setTimeout(() => {
      const target = pickTarget(computerShots, playerShips);
      const nextShots = [...computerShots, target];
      setComputerShots(nextShots);
      setLastEnemyShot(target);
      setThinking(false);
      const backHits = nextShots.filter(c => playerCells.includes(c)).length;
      if (backHits === TOTAL_SHIP_CELLS) {
        setEnded(true);
        setScore(nextHits * 30);
        playGameOverSound();
      }
    }, 620);
  };

  const renderBoard = (side: 'enemy' | 'player') => {
    const isEnemy = side === 'enemy';
    const ships = isEnemy ? enemyShips : playerShips;
    const shots = isEnemy ? playerShots : computerShots;
    const shotSet = new Set(shots);
    const shipAt = new Map<number, number>();
    ships.forEach((ship, index) => ship.forEach(cell => shipAt.set(cell, index)));
    const revealEnemy = ended && isEnemy;
    const recent = isEnemy ? lastShot : lastEnemyShot;

    return (
      <div className="w-full">
        <div className="flex items-center justify-between gap-2 px-0.5">
          <FleetPips sunk={isEnemy ? enemySunk : ownSunk} />
          <span className="text-[11px] font-bold text-slate-300">
            {isEnemy
              ? `Còn ${FLEET.length - enemySunk} tàu`
              : `Mất ${ownSunk}/${FLEET.length} tàu`}
          </span>
        </div>

        <div className="mt-1 flex gap-1">
          <div
            className="grid shrink-0 pr-0.5 text-[9px] font-bold text-sky-300/70"
            style={{ gridTemplateRows: `repeat(${GRID}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: GRID }, (_, row) => (
              <span key={row} className="grid place-items-center">
                {row + 1}
              </span>
            ))}
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-0.5 grid grid-cols-10 gap-0.5 text-[9px] font-bold text-sky-300/70">
              {[...LETTERS].map(letter => (
                <span key={letter} className="text-center">
                  {letter}
                </span>
              ))}
            </div>
            <div
              className="grid grid-cols-10 gap-0.5 rounded-xl p-1.5 border"
              style={{ background: '#052033', borderColor: '#0c4a6e' }}
            >
              {Array.from({ length: GRID * GRID }, (_, cell) => {
                const shot = shotSet.has(cell);
                const hit = shot && shipAt.has(cell);
                const showShip = shipAt.has(cell) && (!isEnemy || revealEnemy);
                const isRecent = recent === cell;
                return (
                  <button
                    key={cell}
                    disabled={!isEnemy || shot || ended || thinking}
                    onClick={() => fire(cell)}
                    aria-label={cellLabel(cell)}
                    title={cellLabel(cell)}
                    className="aspect-square min-w-0 grid place-items-center rounded-[3px] text-[10px] font-black transition-colors duration-150 disabled:cursor-default"
                    style={{
                      background: hit
                        ? '#be123c'
                        : shot
                        ? '#075985'
                        : showShip
                        ? '#334155'
                        : '#0c4a6e',
                      color: hit ? '#fff' : shot ? '#7dd3fc' : showShip ? '#cbd5e1' : '#0c4a6e',
                      outline: isRecent ? '2px solid #facc15' : 'none',
                      outlineOffset: '-2px',
                    }}
                  >
                    {hit ? '✕' : shot ? '·' : showShip ? '■' : ''}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const accuracy = playerShots.length === 0 ? 0 : Math.round((playerHits / playerShots.length) * 100);

  return (
    <GameShell
      game={gameMeta}
      score={score}
      isGameOver={ended}
      isVictory={won}
      isPaused={false}
      onRestart={restart}
      onBackToHub={onBackToHub}
      gameCustomStats={
        <div className="flex items-center gap-3 text-[11px] text-slate-300">
          <span>Trúng {playerHits}/{TOTAL_SHIP_CELLS}</span>
          <span className="text-slate-600">|</span>
          <span>Trượt {playerMisses}</span>
          <span className="text-slate-600">|</span>
          <span>Chính xác {accuracy}%</span>
        </div>
      }
    >
      <div className="flex w-full flex-col items-center gap-4">
        <div
          className="flex w-full max-w-md items-center justify-center gap-2 rounded-2xl border px-4 py-2 text-xs font-bold"
          style={{
            background: ended ? '#1e293b' : thinking ? '#422006' : '#064e3b',
            borderColor: ended ? '#334155' : thinking ? '#854d0e' : '#047857',
            color: ended ? '#cbd5e1' : thinking ? '#fde68a' : '#6ee7b7',
          }}
        >
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: ended ? '#64748b' : thinking ? '#f59e0b' : '#22c55e' }}
          />
          {ended
            ? won
              ? 'Bạn đã đánh chìm toàn bộ hạm đội đối thủ!'
              : 'Hạm đội của bạn đã bị đánh chìm.'
            : thinking
            ? 'Đối thủ đang nhắm bắn...'
            : 'Đến lượt bạn — chọn một ô để bắn'}
        </div>

        <div className="grid w-full max-w-3xl gap-5 md:grid-cols-2">
          <section className="space-y-2">
            <h2 className="text-center text-xs font-bold uppercase text-sky-200">
              Hạm đội đối thủ
            </h2>
            {renderBoard('enemy')}
            <p className="text-center text-xs text-slate-400">
              Bạn đã trúng {playerHits}/{TOTAL_SHIP_CELLS} ô tàu
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="text-center text-xs font-bold uppercase text-slate-300">
              Hạm đội của bạn
            </h2>
            {renderBoard('player')}
            <p className="text-center text-xs text-slate-400">
              Đối thủ đã trúng {computerHits}/{TOTAL_SHIP_CELLS} ô tàu
            </p>
          </section>
        </div>

        {ended && (
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Phần thưởng</span>
              <span className="text-lg font-black text-emerald-400">{score}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-slate-400">Độ chính xác</span>
              <span className="font-bold text-slate-100">{accuracy}%</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-slate-400">Tổng phát bắn</span>
              <span className="font-bold text-slate-100">{playerShots.length}</span>
            </div>
            <button
              onClick={restart}
              className="mt-3 w-full rounded-xl px-5 py-2.5 text-sm font-black text-white game-btn-press"
              style={{ background: '#0369a1' }}
            >
              Trận mới
            </button>
          </div>
        )}
      </div>
    </GameShell>
  );
};