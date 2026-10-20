export type DiffKey = 'easy' | 'hard' | 'extraHard';

const CLUES: Record<DiffKey, number> = { easy: 40, hard: 32, extraHard: 26 };

export function cluesFor(d: DiffKey) {
  return CLUES[d] ?? CLUES.easy;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function isSafe(board: number[][], r: number, c: number, n: number) {
  for (let i = 0; i < 9; i += 1) {
    if (board[r]![i] === n || board[i]![c] === n) return false;
  }
  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;
  for (let i = 0; i < 3; i += 1) {
    for (let j = 0; j < 3; j += 1) {
      if (board[br + i]![bc + j] === n) return false;
    }
  }
  return true;
}

function solve(board: number[][]): boolean {
  for (let r = 0; r < 9; r += 1) {
    for (let c = 0; c < 9; c += 1) {
      if (board[r]![c] !== 0) continue;
      for (const n of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
        if (!isSafe(board, r, c, n)) continue;
        board[r]![c] = n;
        if (solve(board)) return true;
        board[r]![c] = 0;
      }
      return false;
    }
  }
  return true;
}

export function generatePuzzle(diff: DiffKey): { clues: number[][]; solution: number[][] } {
  const board = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => 0));
  solve(board);
  const solution = board.map((row) => [...row]);
  const clues = solution.map((row) => [...row]);
  const cells = shuffle(
    Array.from({ length: 81 }, (_, i) => ({ r: Math.floor(i / 9), c: i % 9 })),
  );
  let remove = 81 - cluesFor(diff);
  for (const { r, c } of cells) {
    if (remove <= 0) break;
    clues[r]![c] = 0;
    remove -= 1;
  }
  return { clues, solution };
}

export function conflicts(board: number[][], r: number, c: number): boolean {
  const n = board[r]![c]!;
  if (!n) return false;
  for (let i = 0; i < 9; i += 1) {
    if (i !== c && board[r]![i] === n) return true;
    if (i !== r && board[i]![c] === n) return true;
  }
  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;
  for (let i = 0; i < 3; i += 1) {
    for (let j = 0; j < 3; j += 1) {
      const rr = br + i;
      const cc = bc + j;
      if ((rr !== r || cc !== c) && board[rr]![cc] === n) return true;
    }
  }
  return false;
}

export function isComplete(board: number[][], solution: number[][]) {
  for (let r = 0; r < 9; r += 1) {
    for (let c = 0; c < 9; c += 1) {
      if (board[r]![c] !== solution[r]![c]) return false;
    }
  }
  return true;
}

export function filledCount(board: number[][], clues: number[][]) {
  let n = 0;
  for (let r = 0; r < 9; r += 1) {
    for (let c = 0; c < 9; c += 1) {
      if (!clues[r]![c] && board[r]![c]) n += 1;
    }
  }
  return n;
}
