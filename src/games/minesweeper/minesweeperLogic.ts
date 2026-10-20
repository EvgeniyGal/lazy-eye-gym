export type Cell = {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  adj: number;
};

export type LevelSpec = { size: number; mines: number };

/** Ten numbered levels — board grows and mine density rises so late levels stay hard. */
export const LEVEL_COUNT = 10;

const LEVELS: LevelSpec[] = [
  { size: 8, mines: 8 }, // ~12.5%
  { size: 8, mines: 12 }, // ~18.8%
  { size: 9, mines: 14 }, // ~17.3%
  { size: 9, mines: 18 }, // ~22.2%
  { size: 10, mines: 22 }, // ~22.0%
  { size: 10, mines: 28 }, // ~28.0%
  { size: 11, mines: 32 }, // ~26.4%
  { size: 11, mines: 40 }, // ~33.1%
  { size: 12, mines: 46 }, // ~31.9%
  { size: 12, mines: 55 }, // ~38.2%
];

export function clampLevel(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(LEVEL_COUNT, Math.round(n)));
}

/** Resolve setup setting: prefers numeric `level`, maps legacy difficulty strings. */
export function resolveLevel(settings: Record<string, string | number | boolean>): number {
  if (settings.level != null && settings.level !== '') {
    return clampLevel(Number(settings.level));
  }
  const legacy = String(settings.difficulty ?? '');
  if (legacy === 'hard') return 5;
  if (legacy === 'extraHard') return 8;
  if (legacy === 'easy') return 1;
  const asNum = Number(legacy);
  if (Number.isFinite(asNum) && asNum > 0) return clampLevel(asNum);
  return 1;
}

export function specForLevel(level: number): LevelSpec {
  return LEVELS[clampLevel(level) - 1]!;
}

/** @deprecated Prefer specForLevel */
export function specFor(d: string | number) {
  if (typeof d === 'number') return specForLevel(d);
  if (d === 'hard') return specForLevel(5);
  if (d === 'extraHard') return specForLevel(8);
  return specForLevel(1);
}

export function emptyGrid(size: number): Cell[][] {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () => ({
      mine: false,
      revealed: false,
      flagged: false,
      adj: 0,
    })),
  );
}

function shuffleInPlace<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
}

/**
 * Place mines randomly each call (new layout every first click / new run).
 * Keeps a 3×3 safe zone around the opening tap.
 */
export function placeMines(grid: Cell[][], mines: number, safeR: number, safeC: number) {
  const size = grid.length;
  const forbidden = new Set<string>();
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      const r = safeR + dr;
      const c = safeC + dc;
      if (r >= 0 && r < size && c >= 0 && c < size) forbidden.add(`${r},${c}`);
    }
  }

  const candidates: { r: number; c: number }[] = [];
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (!forbidden.has(`${r},${c}`)) candidates.push({ r, c });
    }
  }
  shuffleInPlace(candidates);

  const toPlace = Math.min(mines, candidates.length);
  for (let i = 0; i < toPlace; i += 1) {
    const { r, c } = candidates[i]!;
    grid[r]![c]!.mine = true;
  }

  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (grid[r]![c]!.mine) {
        grid[r]![c]!.adj = 0;
        continue;
      }
      let n = 0;
      for (let dr = -1; dr <= 1; dr += 1) {
        for (let dc = -1; dc <= 1; dc += 1) {
          if (!dr && !dc) continue;
          const rr = r + dr;
          const cc = c + dc;
          if (rr >= 0 && rr < size && cc >= 0 && cc < size && grid[rr]![cc]!.mine) n += 1;
        }
      }
      grid[r]![c]!.adj = n;
    }
  }
}

export function revealFlood(grid: Cell[][], r: number, c: number): number {
  const size = grid.length;
  const stack: [number, number][] = [[r, c]];
  let opened = 0;
  while (stack.length) {
    const [cr, cc] = stack.pop()!;
    const cell = grid[cr]?.[cc];
    if (!cell || cell.revealed || cell.flagged) continue;
    cell.revealed = true;
    opened += 1;
    if (cell.mine || cell.adj > 0) continue;
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (!dr && !dc) continue;
        const rr = cr + dr;
        const cc2 = cc + dc;
        if (rr >= 0 && rr < size && cc2 >= 0 && cc2 < size) stack.push([rr, cc2]);
      }
    }
  }
  return opened;
}

export function countCleared(grid: Cell[][]) {
  let n = 0;
  for (const row of grid) {
    for (const c of row) {
      if (c.revealed && !c.mine) n += 1;
    }
  }
  return n;
}

export function isWin(grid: Cell[][]) {
  for (const row of grid) {
    for (const c of row) {
      if (!c.mine && !c.revealed) return false;
    }
  }
  return true;
}
