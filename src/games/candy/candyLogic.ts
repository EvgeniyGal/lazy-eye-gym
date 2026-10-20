export type DiffKey = 'easy' | 'hard' | 'extraHard';

/** 0-2 left eye, 3-5 right eye */
export type Kind = 0 | 1 | 2 | 3 | 4 | 5;

export type Special = 'none' | 'line' | 'bomb';

export type Cell = {
  id: string;
  kind: Kind;
  special: Special;
  focus?: boolean;
};

export const COLS = 7;
export const ROWS = 8;

const MOVES: Record<DiffKey, number> = { easy: 35, hard: 28, extraHard: 22 };
const TARGET: Record<DiffKey, number> = { easy: 1200, hard: 1800, extraHard: 2400 };

export function movesFor(d: DiffKey) {
  return MOVES[d] ?? MOVES.easy;
}

export function targetFor(d: DiffKey) {
  return TARGET[d] ?? TARGET.easy;
}

export function eyeForKind(kind: Kind): 'left' | 'right' {
  return kind < 3 ? 'left' : 'right';
}

let seq = 0;

function nextId() {
  seq += 1;
  return `c-${seq}`;
}

function randKind(): Kind {
  return Math.floor(Math.random() * 6) as Kind;
}

export function makeCell(kind?: Kind, special: Special = 'none'): Cell {
  return { id: nextId(), kind: kind ?? randKind(), special, focus: false };
}

export function createBoard(): Cell[][] {
  const board: Cell[][] = [];
  for (let r = 0; r < ROWS; r += 1) {
    const row: Cell[] = [];
    for (let c = 0; c < COLS; c += 1) {
      let cell = makeCell();
      // avoid initial matches
      let guard = 0;
      while (guard < 12 && wouldMatchAt(board, row, r, c, cell.kind)) {
        cell = makeCell();
        guard += 1;
      }
      row.push(cell);
    }
    board.push(row);
  }
  return board;
}

function wouldMatchAt(board: Cell[][], row: Cell[], r: number, c: number, kind: Kind) {
  if (c >= 2 && row[c - 1]?.kind === kind && row[c - 2]?.kind === kind) return true;
  if (
    r >= 2 &&
    board[r - 1]?.[c]?.kind === kind &&
    board[r - 2]?.[c]?.kind === kind
  ) {
    return true;
  }
  return false;
}

export function findMatches(board: Cell[][]): Set<string> {
  const keys = new Set<string>();
  for (let r = 0; r < ROWS; r += 1) {
    let run = 1;
    for (let c = 1; c <= COLS; c += 1) {
      const same = c < COLS && board[r]![c]!.kind === board[r]![c - 1]!.kind;
      if (same) run += 1;
      else {
        if (run >= 3) {
          for (let k = 0; k < run; k += 1) keys.add(`${r},${c - 1 - k}`);
        }
        run = 1;
      }
    }
  }
  for (let c = 0; c < COLS; c += 1) {
    let run = 1;
    for (let r = 1; r <= ROWS; r += 1) {
      const same = r < ROWS && board[r]![c]!.kind === board[r - 1]![c]!.kind;
      if (same) run += 1;
      else {
        if (run >= 3) {
          for (let k = 0; k < run; k += 1) keys.add(`${r - 1 - k},${c}`);
        }
        run = 1;
      }
    }
  }
  return keys;
}

export function swapCells(board: Cell[][], r1: number, c1: number, r2: number, c2: number) {
  const next = board.map((row) => row.map((c) => ({ ...c })));
  const a = next[r1]![c1]!;
  next[r1]![c1] = next[r2]![c2]!;
  next[r2]![c2] = a;
  return next;
}

export function adjacent(r1: number, c1: number, r2: number, c2: number) {
  return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
}

export type ClearResult = {
  board: Cell[][];
  cleared: number;
  focusCleared: number;
  scoreGain: number;
};

/** Clear matches, apply specials, gravity, refill. May cascade — call in loop. */
export function clearOnce(board: Cell[][]): ClearResult | null {
  const matches = findMatches(board);
  if (!matches.size) return null;

  const grid: (Cell | null)[][] = board.map((row) => row.map((c) => ({ ...c })));
  const specialSpawn: { r: number; c: number; special: Special; kind: Kind }[] = [];

  for (let r = 0; r < ROWS; r += 1) {
    let run = 1;
    for (let c = 1; c <= COLS; c += 1) {
      const same = c < COLS && grid[r]![c]!.kind === grid[r]![c - 1]!.kind;
      if (same) run += 1;
      else {
        if (run >= 4) {
          const mid = c - Math.ceil(run / 2);
          specialSpawn.push({
            r,
            c: mid,
            special: run >= 5 ? 'bomb' : 'line',
            kind: grid[r]![mid]!.kind,
          });
        }
        run = 1;
      }
    }
  }

  const toClear = new Set(matches);
  for (const key of [...matches]) {
    const [rs, cs] = key.split(',').map(Number) as [number, number];
    const cell = grid[rs]![cs]!;
    if (cell.special === 'line') {
      for (let c = 0; c < COLS; c += 1) toClear.add(`${rs},${c}`);
      for (let r = 0; r < ROWS; r += 1) toClear.add(`${r},${cs}`);
    } else if (cell.special === 'bomb') {
      for (let r = 0; r < ROWS; r += 1) {
        for (let c = 0; c < COLS; c += 1) {
          if (grid[r]![c]?.kind === cell.kind) toClear.add(`${r},${c}`);
        }
      }
    }
  }

  let cleared = 0;
  let focusCleared = 0;
  for (const key of toClear) {
    const [r, c] = key.split(',').map(Number) as [number, number];
    const cell = grid[r]![c];
    if (!cell) continue;
    if (cell.focus) focusCleared += 1;
    grid[r]![c] = null;
    cleared += 1;
  }

  for (const sp of specialSpawn) {
    if (!toClear.has(`${sp.r},${sp.c}`)) continue;
    grid[sp.r]![sp.c] = makeCell(sp.kind, sp.special);
  }

  const next: Cell[][] = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => makeCell()));
  for (let c = 0; c < COLS; c += 1) {
    const stack: Cell[] = [];
    for (let r = ROWS - 1; r >= 0; r -= 1) {
      const cell = grid[r]![c];
      if (cell) stack.push(cell);
    }
    for (let r = ROWS - 1; r >= 0; r -= 1) {
      next[r]![c] = stack.shift() ?? makeCell();
    }
  }

  const scoreGain = cleared * 10 + focusCleared * 40;
  return { board: next, cleared, focusCleared, scoreGain };
}

export function resolveBoard(board: Cell[][]): ClearResult {
  let cur = board;
  let cleared = 0;
  let focusCleared = 0;
  let scoreGain = 0;
  for (let i = 0; i < 20; i += 1) {
    const step = clearOnce(cur);
    if (!step) break;
    cur = step.board;
    cleared += step.cleared;
    focusCleared += step.focusCleared;
    scoreGain += step.scoreGain;
  }
  return { board: cur, cleared, focusCleared, scoreGain };
}

export function markFocus(board: Cell[][]): Cell[][] {
  const next = board.map((row) => row.map((c) => ({ ...c, focus: false })));
  const r = Math.floor(Math.random() * ROWS);
  const c = Math.floor(Math.random() * COLS);
  next[r]![c] = { ...next[r]![c]!, focus: true };
  return next;
}
