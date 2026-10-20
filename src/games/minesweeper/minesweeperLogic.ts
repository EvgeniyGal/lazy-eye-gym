export type DiffKey = 'easy' | 'hard' | 'extraHard';

export type Cell = {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  adj: number;
};

const SPECS: Record<DiffKey, { size: number; mines: number }> = {
  easy: { size: 8, mines: 10 },
  hard: { size: 10, mines: 16 },
  extraHard: { size: 12, mines: 24 },
};

export function specFor(d: DiffKey) {
  return SPECS[d] ?? SPECS.easy;
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
  let placed = 0;
  while (placed < mines) {
    const r = Math.floor(Math.random() * size);
    const c = Math.floor(Math.random() * size);
    const key = `${r},${c}`;
    if (forbidden.has(key) || grid[r]![c]!.mine) continue;
    grid[r]![c]!.mine = true;
    placed += 1;
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
