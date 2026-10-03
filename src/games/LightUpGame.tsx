import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { GameShell } from '../components/GameShell';
import { getGameById } from '../data/games';
import { playMoveSound, playScoreSound, playClearSound, triggerHaptic } from '../utils/sound';
import { Lightbulb, Ban, ShieldCheck, ShieldAlert, RotateCcw } from 'lucide-react';

type DifficultyId = 'easy' | 'medium' | 'hard';

interface Difficulty {
  id: DifficultyId;
  label: string;
  R: number;
  C: number;
  wallFill: number;
  bulbDrops: number;
  clueDrop: number;
  minClues: number;
  maxWallRatio: number;
  minBulbs: number;
  hints: number;
  base: number;
  perfect: number;
}

interface Puzzle {
  R: number;
  C: number;
  walls: boolean[];
  clues: number[];
  solution: boolean[];
}

interface Analysis {
  lit: boolean[];
  conflict: boolean[];
  badClues: boolean[];
  markViolations: boolean[];
  dark: boolean[];
  bulbCount: number;
  hardErrors: number;
  errors: number;
  solved: boolean;
}

const DIFFICULTIES: Difficulty[] = [
  { id: 'easy', label: 'Dễ', R: 8, C: 8, wallFill: 0.16, bulbDrops: 0, clueDrop: 0, minClues: 6, maxWallRatio: 0.28, minBulbs: 5, hints: 3, base: 1200, perfect: 400 },
  { id: 'medium', label: 'Trung bình', R: 10, C: 10, wallFill: 0.18, bulbDrops: 1, clueDrop: 0.5, minClues: 9, maxWallRatio: 0.3, minBulbs: 6, hints: 2, base: 2200, perfect: 700 },
  { id: 'hard', label: 'Khó', R: 10, C: 10, wallFill: 0.3, bulbDrops: 3, clueDrop: 0.85, minClues: 8, maxWallRatio: 0.42, minBulbs: 6, hints: 1, base: 3400, perfect: 1100 },
];

const cellIndex = (r: number, c: number, C: number) => r * C + c;

function shuffle<T>(list: T[]): T[] {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

function segmentIds(walls: boolean[], R: number, C: number, vertical: boolean): number[] {
  const ids = new Array<number>(R * C).fill(-1);
  let next = 0;
  const outer = vertical ? C : R;
  const inner = vertical ? R : C;
  for (let a = 0; a < outer; a++) {
    let current = -1;
    for (let b = 0; b < inner; b++) {
      const i = vertical ? cellIndex(b, a, C) : cellIndex(a, b, C);
      if (walls[i]) {
        current = -1;
        continue;
      }
      if (current === -1) current = next++;
      ids[i] = current;
    }
  }
  return ids;
}

function computeLit(walls: boolean[], bulbs: boolean[], R: number, C: number): boolean[] {
  const lit = new Array<boolean>(R * C).fill(false);
  const total = R * C;
  const runs = [segmentIds(walls, R, C, false), segmentIds(walls, R, C, true)];
  for (const ids of runs) {
    const litSegments = new Set<number>();
    for (let i = 0; i < total; i++) {
      if (!walls[i] && bulbs[i]) litSegments.add(ids[i]);
    }
    if (litSegments.size === 0) continue;
    for (let i = 0; i < total; i++) {
      if (!walls[i] && litSegments.has(ids[i])) lit[i] = true;
    }
  }
  return lit;
}

function greedyBulbs(walls: boolean[], R: number, C: number): boolean[] {
  const total = R * C;
  const bulbs = new Array<boolean>(total).fill(false);
  const rowSeg = segmentIds(walls, R, C, false);
  const colSeg = segmentIds(walls, R, C, true);
  const usedRow = new Set<number>();
  const usedCol = new Set<number>();
  for (const i of shuffle(Array.from({ length: total }, (_, k) => k))) {
    if (walls[i]) continue;
    if (usedRow.has(rowSeg[i]) || usedCol.has(colSeg[i])) continue;
    bulbs[i] = true;
    usedRow.add(rowSeg[i]);
    usedCol.add(colSeg[i]);
  }
  return bulbs;
}

function countWalls(walls: boolean[]): number {
  let n = 0;
  for (const w of walls) if (w) n++;
  return n;
}

function sealDarkCells(walls: boolean[], bulbs: boolean[], R: number, C: number, maxRatio: number): boolean {
  const total = R * C;
  const cap = Math.floor(total * maxRatio);
  for (let step = 0; step <= total; step++) {
    const lit = computeLit(walls, bulbs, R, C);
    const dark: number[] = [];
    for (let i = 0; i < total; i++) {
      if (!walls[i] && !lit[i]) dark.push(i);
    }
    if (dark.length === 0) return true;
    if (countWalls(walls) + 1 > cap) return false;
    walls[dark[Math.floor(Math.random() * dark.length)]] = true;
  }
  return false;
}

function computeClues(walls: boolean[], bulbs: boolean[], R: number, C: number): number[] {
  const total = R * C;
  const rowSeg = segmentIds(walls, R, C, false);
  const colSeg = segmentIds(walls, R, C, true);
  const rowCount = new Map<number, number>();
  const colCount = new Map<number, number>();
  for (let i = 0; i < total; i++) {
    if (walls[i] || !bulbs[i]) continue;
    rowCount.set(rowSeg[i], (rowCount.get(rowSeg[i]) ?? 0) + 1);
    colCount.set(colSeg[i], (colCount.get(colSeg[i]) ?? 0) + 1);
  }
  const clues = new Array<number>(total).fill(0);
  for (let i = 0; i < total; i++) {
    if (walls[i]) continue;
    const own = bulbs[i] ? 2 : 0;
    const count = (rowCount.get(rowSeg[i]) ?? 0) + (colCount.get(colSeg[i]) ?? 0) - own;
    clues[i] = count >= 2 ? Math.min(count, 4) : 0;
  }
  return clues;
}

function dropClues(clues: number[], rate: number, minClues: number): number {
  const indices: number[] = [];
  for (let i = 0; i < clues.length; i++) if (clues[i] > 0) indices.push(i);
  if (indices.length < minClues) return -1;
  let kept = indices.length;
  for (const i of shuffle(indices)) {
    if (Math.random() < rate) {
      clues[i] = 0;
      kept--;
    }
  }
  if (kept < minClues) return -1;
  return kept;
}

function pickWallCells(walls: boolean[], bulbs: boolean[], R: number, C: number, count: number): number[] {
  const total = R * C;
  const rowSeg = segmentIds(walls, R, C, false);
  const colSeg = segmentIds(walls, R, C, true);
  const litRow = new Set<number>();
  const litCol = new Set<number>();
  for (let i = 0; i < total; i++) {
    if (walls[i] || !bulbs[i]) continue;
    litRow.add(rowSeg[i]);
    litCol.add(colSeg[i]);
  }
  const safe: number[] = [];
  const risky: number[] = [];
  for (let i = 0; i < total; i++) {
    if (walls[i] || bulbs[i]) continue;
    if (litRow.has(rowSeg[i]) && litCol.has(colSeg[i])) safe.push(i);
    else risky.push(i);
  }
  return shuffle(safe).concat(shuffle(risky)).slice(0, Math.max(0, count));
}

function solutionIsMaximal(walls: boolean[], clues: number[], bulbs: boolean[], R: number, C: number): boolean {
  const total = R * C;
  const rowSeg = segmentIds(walls, R, C, false);
  const colSeg = segmentIds(walls, R, C, true);
  const litRow = new Set<number>();
  const litCol = new Set<number>();
  for (let i = 0; i < total; i++) {
    if (walls[i] || !bulbs[i]) continue;
    litRow.add(rowSeg[i]);
    litCol.add(colSeg[i]);
  }
  for (let i = 0; i < total; i++) {
    if (walls[i] || clues[i] > 0 || bulbs[i]) continue;
    if (!litRow.has(rowSeg[i]) || !litCol.has(colSeg[i])) return false;
  }
  return true;
}

function buildPuzzle(
  cfg: Difficulty,
  bulbDrops: number,
  wallFill: number,
  clueDrop: number,
  strict: boolean,
): Puzzle | null {
  const { R, C } = cfg;
  const total = R * C;
  const walls = new Array<boolean>(total).fill(false);
  const bulbs = greedyBulbs(walls, R, C);
  for (const i of pickWallCells(walls, bulbs, R, C, Math.round(total * wallFill))) walls[i] = true;
  if (bulbDrops > 0) {
    const bulbCells: number[] = [];
    for (let i = 0; i < total; i++) if (bulbs[i]) bulbCells.push(i);
    for (const i of shuffle(bulbCells).slice(0, bulbDrops)) bulbs[i] = false;
  }
  if (!sealDarkCells(walls, bulbs, R, C, cfg.maxWallRatio)) return null;
  let placed = 0;
  for (let i = 0; i < total; i++) if (bulbs[i]) placed++;
  if (placed < cfg.minBulbs) return null;
  const clues = computeClues(walls, bulbs, R, C);
  if (strict && !solutionIsMaximal(walls, clues, bulbs, R, C)) return null;
  if (dropClues(clues, clueDrop, cfg.minClues) < 0) return null;
  return { R, C, walls, clues, solution: bulbs };
}

function generatePuzzle(cfg: Difficulty): Puzzle {
  const plans: Array<[number, number, number, boolean]> = [];
  for (let k = 0; k < 20; k++) plans.push([cfg.bulbDrops, cfg.wallFill, cfg.clueDrop, true]);
  for (let k = 0; k < 20; k++) plans.push([cfg.bulbDrops, cfg.wallFill, cfg.clueDrop, false]);
  for (let k = 0; k < 20; k++) plans.push([Math.max(0, cfg.bulbDrops - 2), cfg.wallFill * 0.6, cfg.clueDrop * 0.5, false]);
  for (const [drops, fill, rate, strict] of plans) {
    const puzzle = buildPuzzle(cfg, drops, fill, rate, strict);
    if (puzzle) return puzzle;
  }
  const relaxed: Difficulty = { ...cfg, minClues: 0, minBulbs: 1, maxWallRatio: 0.6 };
  for (let k = 0; k < 40; k++) {
    const puzzle = buildPuzzle(relaxed, 0, cfg.wallFill, 0, false);
    if (puzzle) return puzzle;
  }
  const R = cfg.R;
  const C = cfg.C;
  const walls = new Array<boolean>(R * C).fill(false);
  const bulbs = greedyBulbs(walls, R, C);
  sealDarkCells(walls, bulbs, R, C, 0.6);
  return { R, C, walls, clues: computeClues(walls, bulbs, R, C), solution: bulbs };
}

function analyze(walls: boolean[], clues: number[], bulbs: boolean[], marks: boolean[], R: number, C: number): Analysis {
  const total = R * C;
  const lit = computeLit(walls, bulbs, R, C);
  const rowSeg = segmentIds(walls, R, C, false);
  const colSeg = segmentIds(walls, R, C, true);
  const conflict = new Array<boolean>(total).fill(false);
  const badClues = new Array<boolean>(total).fill(false);
  const markViolations = new Array<boolean>(total).fill(false);
  const dark = new Array<boolean>(total).fill(false);

  const runs: Array<{ ids: number[]; counts: Map<number, number> }> = [];
  for (const ids of [rowSeg, colSeg]) {
    const counts = new Map<number, number>();
    for (let i = 0; i < total; i++) {
      if (!walls[i] && bulbs[i]) counts.set(ids[i], (counts.get(ids[i]) ?? 0) + 1);
    }
    runs.push({ ids, counts });
  }

  let bulbCount = 0;
  for (let i = 0; i < total; i++) {
    if (walls[i]) continue;
    if (bulbs[i]) {
      bulbCount++;
      if (marks[i]) markViolations[i] = true;
      for (const run of runs) {
        if ((run.counts.get(run.ids[i]) ?? 0) > 1) conflict[i] = true;
      }
    } else if (clues[i] > 0) {
      let count = 0;
      for (const run of runs) count += run.counts.get(run.ids[i]) ?? 0;
      if (count !== clues[i]) badClues[i] = true;
    } else if (!lit[i]) {
      dark[i] = true;
    }
  }

  let conflictCount = 0;
  let clueCount = 0;
  let markCount = 0;
  let darkCount = 0;
  for (let i = 0; i < total; i++) {
    if (conflict[i]) conflictCount++;
    if (badClues[i]) clueCount++;
    if (markViolations[i]) markCount++;
    if (dark[i]) darkCount++;
  }

  const hardErrors = conflictCount + clueCount + markCount;
  return {
    lit,
    conflict,
    badClues,
    markViolations,
    dark,
    bulbCount,
    hardErrors,
    errors: hardErrors + darkCount,
    solved: hardErrors === 0 && darkCount === 0 && bulbCount > 0,
  };
}

function computeScore(cfg: Difficulty, hintsUsed: number, checkErrors: number, moves: number, solutionCount: number): number {
  const par = solutionCount + 6;
  const efficiency = Math.max(0, par - moves) * 20;
  const perfect = moves === solutionCount ? cfg.perfect : 0;
  const raw = cfg.base - hintsUsed * 120 - checkErrors * 60 + efficiency + perfect;
  return Math.max(1, Math.round(raw));
}

interface LightUpGameProps {
  onBackToHub: () => void;
}

export const LightUpGame: React.FC<LightUpGameProps> = ({ onBackToHub }) => {
  const gameMeta = getGameById('light-up')!;

  const [difficultyId, setDifficultyId] = useState<DifficultyId>('easy');
  const cfg = useMemo(
    () => DIFFICULTIES.find(d => d.id === difficultyId) ?? DIFFICULTIES[0],
    [difficultyId],
  );
  const [puzzle, setPuzzle] = useState<Puzzle>(() => generatePuzzle(DIFFICULTIES[0]));
  const [bulbs, setBulbs] = useState<boolean[]>(() => new Array<boolean>(64).fill(false));
  const [marks, setMarks] = useState<boolean[]>(() => new Array<boolean>(64).fill(false));
  const [moves, setMoves] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [checkErrors, setCheckErrors] = useState(0);
  const [checkOn, setCheckOn] = useState(false);
  const [won, setWon] = useState(false);
  const [ended, setEnded] = useState(false);
  const [notice, setNotice] = useState('');
  const [isLight, setIsLight] = useState(false);

  const pressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);
  const noticeTimer = useRef<number | null>(null);

  const { R, C, walls, clues, solution } = puzzle;
  const total = R * C;

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setIsLight(root.classList.contains('light'));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      if (pressTimer.current) window.clearTimeout(pressTimer.current);
      if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    };
  }, []);

  const showNotice = useCallback((text: string) => {
    setNotice(text);
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(''), 2600);
  }, []);

  const startGame = useCallback((next: Difficulty) => {
    const nextPuzzle = generatePuzzle(next);
    setPuzzle(nextPuzzle);
    setBulbs(new Array<boolean>(nextPuzzle.R * nextPuzzle.C).fill(false));
    setMarks(new Array<boolean>(nextPuzzle.R * nextPuzzle.C).fill(false));
    setMoves(0);
    setHintsUsed(0);
    setCheckErrors(0);
    setCheckOn(false);
    setWon(false);
    setEnded(false);
    setNotice('');
  }, []);

  const restart = useCallback(() => startGame(cfg), [cfg, startGame]);

  const selectDifficulty = (id: DifficultyId) => {
    if (id === difficultyId) return;
    const next = DIFFICULTIES.find(d => d.id === id) ?? DIFFICULTIES[0];
    setDifficultyId(id);
    startGame(next);
    playMoveSound();
  };

  const analysis = useMemo(() => analyze(walls, clues, bulbs, marks, R, C), [walls, clues, bulbs, marks, R, C]);
  const solutionCount = useMemo(() => solution.reduce((sum, v) => sum + (v ? 1 : 0), 0), [solution]);
  const hintsLeft = Math.max(0, cfg.hints - hintsUsed);
  const score = useMemo(
    () => computeScore(cfg, hintsUsed, checkErrors, moves, solutionCount),
    [cfg, hintsUsed, checkErrors, moves, solutionCount],
  );

  useEffect(() => {
    if (won || !analysis.solved) return;
    setWon(true);
    setEnded(true);
    playClearSound();
    playScoreSound();
    triggerHaptic(45);
  }, [analysis.solved, won]);

  const toggleBulb = useCallback(
    (i: number) => {
      if (ended || walls[i] || clues[i] > 0) return;
      const placing = !bulbs[i];
      setBulbs(prev => {
        const next = prev.slice();
        next[i] = placing;
        return next;
      });
      if (placing) {
        setMoves(m => m + 1);
        if (marks[i]) {
          setMarks(prev => {
            const next = prev.slice();
            next[i] = false;
            return next;
          });
        }
      }
      playMoveSound();
      triggerHaptic(12);
    },
    [ended, walls, clues, bulbs, marks],
  );

  const toggleMark = useCallback(
    (i: number) => {
      if (ended || walls[i] || clues[i] > 0) return;
      setMarks(prev => {
        const next = prev.slice();
        next[i] = !next[i];
        return next;
      });
      setBulbs(prev => {
        if (!prev[i]) return prev;
        const next = prev.slice();
        next[i] = false;
        return next;
      });
      playMoveSound();
      triggerHaptic(12);
    },
    [ended, walls, clues],
  );

  const useHint = () => {
    if (ended || hintsLeft === 0) return;
    let target = -1;
    for (let i = 0; i < total; i++) {
      if (solution[i] && !bulbs[i]) {
        target = i;
        break;
      }
    }
    if (target === -1) {
      showNotice('Bạn đã đặt đủ bóng đúng rồi!');
      return;
    }
    const rowSeg = segmentIds(walls, R, C, false);
    const colSeg = segmentIds(walls, R, C, true);
    const rSeg = rowSeg[target];
    const cSeg = colSeg[target];
    setBulbs(prev => {
      const next = prev.slice();
      for (let i = 0; i < total; i++) {
        if (prev[i] && (rowSeg[i] === rSeg || colSeg[i] === cSeg)) next[i] = false;
      }
      next[target] = true;
      return next;
    });
    setMarks(prev => {
      const next = prev.slice();
      next[target] = false;
      return next;
    });
    setHintsUsed(h => h + 1);
    playScoreSound();
    triggerHaptic(25);
    showNotice('Gợi ý: đã đặt một bóng đúng.');
  };

  const toggleCheck = () => {
    if (ended) return;
    if (checkOn) {
      setCheckOn(false);
      playMoveSound();
      return;
    }
    setCheckOn(true);
    const snapshot = analyze(walls, clues, bulbs, marks, R, C);
    if (snapshot.errors > 0) setCheckErrors(c => c + 1);
    playMoveSound();
  };

  const beginPress = (i: number) => {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    longPressed.current = false;
    pressTimer.current = window.setTimeout(() => {
      longPressed.current = true;
      toggleMark(i);
    }, 480);
  };

  const endPress = () => {
    if (pressTimer.current) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const palette = useMemo(() => {
    if (isLight) {
      return {
        wall: '#334155',
        wallEdge: '#1e293b',
        clue: '#1e293b',
        clueInk: '#f8fafc',
        unlit: '#ffffff',
        unlitEdge: '#cbd5e1',
        lit: '#fde68a',
        litEdge: '#f59e0b',
        bulb: '#fbbf24',
        bulbEdge: '#b45309',
        bulbInk: '#422006',
        mark: '#e2e8f0',
        markEdge: '#94a3b8',
        markInk: '#475569',
        error: '#fca5a5',
        errorEdge: '#dc2626',
        errorInk: '#7f1d1d',
      };
    }
    return {
      wall: '#0b1220',
      wallEdge: '#1e293b',
      clue: '#111827',
      clueInk: '#f1f5f9',
      unlit: '#151d2e',
      unlitEdge: '#2b3654',
      lit: '#4a3d15',
      litEdge: '#a16207',
      bulb: '#fbbf24',
      bulbEdge: '#fde68a',
      bulbInk: '#422006',
      mark: '#1e293b',
      markEdge: '#475569',
      markInk: '#93c5fd',
      error: '#7f1d1d',
      errorEdge: '#ef4444',
      errorInk: '#fee2e2',
    };
  }, [isLight]);

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < total; i++) {
    const isWall = walls[i];
    const clue = clues[i];
    const hasBulb = bulbs[i];
    const hasMark = marks[i];
    const isLit = analysis.lit[i];
    const flagged = checkOn && (analysis.conflict[i] || analysis.markViolations[i] || analysis.badClues[i] || analysis.dark[i]);

    let background = palette.unlit;
    let borderColor = palette.unlitEdge;
    let ink = palette.unlit;
    if (isWall) {
      background = palette.wall;
      borderColor = palette.wallEdge;
    } else if (clue > 0) {
      background = flagged ? palette.error : palette.clue;
      borderColor = flagged ? palette.errorEdge : palette.clue;
      ink = flagged ? palette.errorInk : palette.clueInk;
    } else if (hasMark) {
      background = flagged ? palette.error : palette.mark;
      borderColor = flagged ? palette.errorEdge : palette.markEdge;
      ink = flagged ? palette.errorInk : palette.markInk;
    } else if (hasBulb) {
      background = flagged ? palette.error : palette.bulb;
      borderColor = flagged ? palette.errorEdge : palette.bulbEdge;
      ink = flagged ? palette.errorInk : palette.bulbInk;
    } else if (isLit) {
      background = flagged ? palette.error : palette.lit;
      borderColor = flagged ? palette.errorEdge : palette.litEdge;
      ink = flagged ? palette.errorInk : palette.lit;
    } else if (flagged) {
      background = palette.unlit;
      borderColor = palette.errorEdge;
    }

    const row = Math.floor(i / C) + 1;
    const col = (i % C) + 1;
    const label = isWall
      ? `Tường hàng ${row} cột ${col}`
      : clue > 0
        ? `Số ${clue} hàng ${row} cột ${col}`
        : `${hasBulb ? 'Có bóng' : 'Ô trống'} hàng ${row} cột ${col}${hasMark ? ', đánh dấu không đặt bóng' : ''}`;

    cells.push(
      <button
        key={i}
        type="button"
        aria-label={label}
        title={label}
        onClick={() => {
          if (longPressed.current) {
            longPressed.current = false;
            return;
          }
          toggleBulb(i);
        }}
        onContextMenu={e => {
          e.preventDefault();
          toggleMark(i);
        }}
        onPointerDown={() => beginPress(i)}
        onPointerUp={endPress}
        onPointerLeave={endPress}
        onPointerCancel={endPress}
        className="aspect-square w-full rounded-[5px] border transition-colors duration-100 select-none touch-none flex items-center justify-center"
        style={{ background, borderColor, color: ink, cursor: ended ? 'default' : 'pointer' }}
      >
        {clue > 0 ? (
          <span className="text-[11px] sm:text-xs font-black leading-none">{clue}</span>
        ) : hasBulb ? (
          <Lightbulb className="w-3/5 h-3/5" strokeWidth={2.4} />
        ) : hasMark ? (
          <Ban className="w-1/2 h-1/2" strokeWidth={2.6} />
        ) : null}
      </button>,
    );
  }

  return (
    <GameShell
      game={gameMeta}
      score={score}
      isGameOver={ended}
      isPaused={false}
      onRestart={restart}
      onBackToHub={onBackToHub}
      isVictory={won}
      gameCustomStats={
        <div
          className="px-3 py-1 rounded-xl border theme-border flex items-center gap-1.5"
          style={{ background: 'var(--surface-strong)' }}
        >
          <span className="text-[10px] uppercase font-bold theme-muted">{cfg.label}</span>
          <span className="text-sm font-bold text-sky-400">
            {R}×{C}
          </span>
          <span className="text-sm font-bold text-amber-400">{analysis.bulbCount} bóng</span>
        </div>
      }
    >
      <div className="w-full max-w-md mx-auto flex flex-col items-center gap-3 px-1 py-1">
        <div className="flex w-full rounded-2xl border theme-border p-1" style={{ background: 'var(--surface-soft)' }}>
          {DIFFICULTIES.map(d => (
            <button
              key={d.id}
              type="button"
              onClick={() => selectDifficulty(d.id)}
              className={`flex-1 py-2 rounded-xl text-[11px] sm:text-xs font-bold transition game-btn-press ${
                difficultyId === d.id ? 'bg-amber-500 text-slate-950' : 'theme-text'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        <div className="w-full flex flex-wrap items-center justify-center gap-2">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border theme-border"
            style={{ background: 'var(--surface-strong)' }}
          >
            <span className="text-[10px] uppercase font-bold theme-muted">Gợi ý:</span>
            <span className="text-sm font-black text-amber-400">{hintsLeft}</span>
          </div>
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border theme-border"
            style={{ background: 'var(--surface-strong)' }}
          >
            <span className="text-[10px] uppercase font-bold theme-muted">Lượt:</span>
            <span className="text-sm font-black text-emerald-400">{moves}</span>
          </div>
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border theme-border"
            style={{
              background: 'var(--surface-strong)',
              borderColor: checkOn && analysis.errors > 0 ? '#ef4444' : undefined,
            }}
          >
            <span className="text-[10px] uppercase font-bold theme-muted">Lỗi:</span>
            <span className="text-sm font-black" style={{ color: checkOn && analysis.errors > 0 ? '#f87171' : '#94a3b8' }}>
              {checkOn ? analysis.errors : '—'}
            </span>
          </div>
        </div>

        <div
          className="w-full px-3 py-2 rounded-xl border text-center text-xs font-bold"
          style={{
            background: won ? 'rgba(52, 211, 153, 0.12)' : 'var(--game-status-bg)',
            borderColor: won ? '#34d399' : 'var(--border-color)',
            color: won ? '#34d399' : 'var(--text-muted)',
          }}
        >
          {won
            ? `Hoàn thành ${cfg.label}! Bạn đặt ${moves} bóng.`
            : notice ||
              (checkOn && analysis.errors > 0
                ? `Còn ${analysis.errors} lỗi: ${analysis.hardErrors} sai luật, ô tối ${analysis.dark.filter(Boolean).length}.`
                : 'Chạm để đặt bóng · Giữ/chuột phải để đánh dấu ô không đặt bóng.')}
        </div>

        <div className="w-full rounded-3xl border theme-border p-2 sm:p-2.5" style={{ background: 'var(--game-surface-bg)' }}>
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${C}, minmax(0, 1fr))` }}>
            {cells}
          </div>
        </div>

        <div className="flex w-full gap-2">
          <button
            type="button"
            onClick={useHint}
            disabled={ended || hintsLeft === 0}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border theme-border theme-panel-soft theme-text text-xs font-bold transition game-btn-press disabled:opacity-40"
          >
            <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
            Gợi ý ({hintsLeft})
          </button>
          <button
            type="button"
            onClick={toggleCheck}
            disabled={ended}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-bold transition game-btn-press disabled:opacity-40 ${
              checkOn ? 'text-white' : 'theme-panel-soft theme-text'
            }`}
            style={checkOn ? { background: '#0ea5e9', borderColor: '#38bdf8' } : undefined}
          >
            {checkOn ? <ShieldAlert className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />}
            Kiểm tra
          </button>
          <button
            type="button"
            onClick={restart}
            disabled={ended}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border theme-border theme-panel-soft theme-text text-xs font-bold transition game-btn-press disabled:opacity-40"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Mới
          </button>
        </div>

        <div className="w-full flex flex-wrap items-center justify-center gap-3 text-[10px] theme-muted">
          <span className="flex items-center gap-1.5">
            <span
              className="w-3.5 h-3.5 rounded-[3px] border"
              style={{ background: palette.unlit, borderColor: palette.unlitEdge }}
            />
            Chưa sáng
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="w-3.5 h-3.5 rounded-[3px] border"
              style={{ background: palette.lit, borderColor: palette.litEdge }}
            />
            Đã sáng
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="w-3.5 h-3.5 rounded-[3px] border flex items-center justify-center"
              style={{ background: palette.mark, borderColor: palette.markEdge, color: palette.markInk }}
            >
              <Ban className="w-2.5 h-2.5" strokeWidth={3} />
            </span>
            Chắc chắn không đặt bóng
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="w-3.5 h-3.5 rounded-[3px] border"
              style={{ background: palette.clue, borderColor: palette.clue }}
            />
            Ô số / tường
          </span>
        </div>

        <p className="text-[11px] theme-muted text-center leading-relaxed">
          Ô tối đen là tường, không chiếu sáng. Ô có số 1-4 yêu cầu đúng số bóng trong cùng hàng và cột. Hai bóng
          không được thấy nhau theo hàng hoặc cột, và mọi ô trống đều phải được chiếu sáng.
        </p>
      </div>
    </GameShell>
  );
};
