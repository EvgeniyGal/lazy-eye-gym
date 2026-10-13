import { Canvas, Rect, RoundedRect } from '@shopify/react-native-skia';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { withOpacity, type EyeSide } from '@/src/anaglyph/color';
import { colorForEye, solidForEye } from '@/src/anaglyph/palette';
import type { DichopticPalette } from '@/src/anaglyph/types';
import { useGameAudio } from '@/src/audio/useGameAudio';
import type { GameSceneProps } from '../types';

const COLS = 10;
const ROWS = 20;
const LOCK_MS = 300;

type PieceKind = 'I' | 'J' | 'L' | 'O' | 'S' | 'T' | 'Z';
type Cell = PieceKind | null;
type Board = Cell[][];
type Point = { x: number; y: number };

type Active = {
  kind: PieceKind;
  rot: number;
  x: number;
  y: number;
};

/** Spawn orientations only — other rotations are derived with CW (x,y)→(-y,x). */
const BASE: Record<PieceKind, Point[]> = {
  I: [
    { x: -1, y: 0 },
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
  ],
  J: [
    { x: -1, y: 0 },
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: -1, y: -1 },
  ],
  L: [
    { x: -1, y: 0 },
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: -1 },
  ],
  O: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: -1 },
    { x: 1, y: -1 },
  ],
  S: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: -1, y: -1 },
    { x: 0, y: -1 },
  ],
  T: [
    { x: -1, y: 0 },
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: -1 },
  ],
  Z: [
    { x: -1, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: -1 },
    { x: 1, y: -1 },
  ],
};

/** Distinct dichoptic looks per figure (eye channel + fill strength). */
const PIECE_LOOK: Record<PieceKind, { onPrimary: boolean; alpha: number }> = {
  I: { onPrimary: true, alpha: 1 },
  O: { onPrimary: false, alpha: 1 },
  T: { onPrimary: true, alpha: 0.72 },
  S: { onPrimary: false, alpha: 0.72 },
  Z: { onPrimary: true, alpha: 0.5 },
  J: { onPrimary: false, alpha: 0.88 },
  L: { onPrimary: true, alpha: 0.88 },
};

function rotateCW(p: Point): Point {
  return { x: -p.y, y: p.x };
}

function shapeAt(kind: PieceKind, rot: number): Point[] {
  let cells = BASE[kind];
  const turns = ((rot % 4) + 4) % 4;
  for (let i = 0; i < turns; i += 1) {
    cells = cells.map(rotateCW);
  }
  return cells;
}

function colorForKind(
  palette: DichopticPalette,
  kind: PieceKind,
  primaryEye: EyeSide,
  ghost = false,
) {
  const look = PIECE_LOOK[kind];
  const secondary: EyeSide = primaryEye === 'left' ? 'right' : 'left';
  const eye = look.onPrimary ? primaryEye : secondary;
  const solid = solidForEye(palette, eye);
  const baseAlpha = eye === 'left' ? palette.leftAlpha : palette.rightAlpha;
  return withOpacity(solid, baseAlpha * look.alpha * (ghost ? 0.32 : 1));
}

const BAG_ORDER: PieceKind[] = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];

const LINE_SCORES = [0, 40, 100, 300, 1200];

const LEVELS = {
  easy: { gravityMs: 900 },
  hard: { gravityMs: 550 },
  extraHard: { gravityMs: 320 },
} as const;

type LevelKey = keyof typeof LEVELS;

function resolveLevel(settings: Record<string, string | number | boolean>): LevelKey {
  const raw = String(settings.difficulty ?? 'easy');
  if (raw === 'hard' || raw === 'extraHard') return raw;
  return 'easy';
}

function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => null));
}

function shuffleBag(): PieceKind[] {
  const bag = [...BAG_ORDER];
  for (let i = bag.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = bag[i]!;
    bag[i] = bag[j]!;
    bag[j] = tmp;
  }
  return bag;
}

function cellsOf(piece: Active): Point[] {
  return shapeAt(piece.kind, piece.rot).map((p) => ({ x: piece.x + p.x, y: piece.y + p.y }));
}

function fits(board: Board, piece: Active): boolean {
  for (const c of cellsOf(piece)) {
    if (c.x < 0 || c.x >= COLS || c.y >= ROWS) return false;
    if (c.y < 0) continue;
    if (board[c.y]![c.x]) return false;
  }
  return true;
}

function spawnPiece(kind: PieceKind): Active {
  return { kind, rot: 0, x: 4, y: 1 };
}

function ghostY(board: Board, piece: Active): number {
  let y = piece.y;
  while (fits(board, { ...piece, y: y + 1 })) y += 1;
  return y;
}

function lockPiece(board: Board, piece: Active): Board {
  const next = board.map((row) => [...row]) as Board;
  for (const c of cellsOf(piece)) {
    if (c.y >= 0 && c.y < ROWS && c.x >= 0 && c.x < COLS) {
      next[c.y]![c.x] = piece.kind;
    }
  }
  return next;
}

function clearLines(board: Board): { board: Board; cleared: number } {
  const kept = board.filter((row) => row.some((c) => c === null));
  const cleared = ROWS - kept.length;
  while (kept.length < ROWS) {
    kept.unshift(Array.from({ length: COLS }, () => null));
  }
  return { board: kept as Board, cleared };
}

function tryRotate(board: Board, piece: Active): Active | null {
  const nextRot = (piece.rot + 1) % 4;
  const kicks = [
    { x: 0, y: 0 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: -1 },
    { x: -2, y: 0 },
    { x: 2, y: 0 },
  ];
  for (const k of kicks) {
    const candidate: Active = {
      ...piece,
      rot: nextRot,
      x: piece.x + k.x,
      y: piece.y + k.y,
    };
    if (fits(board, candidate)) return candidate;
  }
  return null;
}

function gravityFor(baseMs: number, level: number) {
  return Math.max(80, baseMs * Math.pow(0.85, level));
}

export function TetrisGame({
  width,
  height,
  palette,
  settings,
  paused,
  onScore,
  onGameOver,
}: GameSceneProps) {
  const { sfx } = useGameAudio(settings);
  const sfxRef = useRef(sfx);
  sfxRef.current = sfx;
  const levelKey = resolveLevel(settings);
  const baseGravity = LEVELS[levelKey].gravityMs;
  const pieceEye = (settings.pieceEye as EyeSide) || 'left';
  const frameColor = colorForEye(palette, pieceEye);
  const boardBg = palette.background;
  const kindColor = (kind: PieceKind, ghost = false) =>
    colorForKind(palette, kind, pieceEye, ghost);

  const bagRef = useRef<PieceKind[]>(shuffleBag());
  const takeNext = (): PieceKind => {
    if (bagRef.current.length === 0) bagRef.current = shuffleBag();
    return bagRef.current.shift()!;
  };

  const first = useRef(takeNext());
  const second = useRef(takeNext());

  const [board, setBoard] = useState<Board>(() => emptyBoard());
  const [active, setActive] = useState<Active>(() => spawnPiece(first.current));
  const [nextKind, setNextKind] = useState<PieceKind>(second.current);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(0);

  const boardRef = useRef(board);
  const activeRef = useRef(active);
  const nextRef = useRef(nextKind);
  const scoreRef = useRef(score);
  const linesRef = useRef(lines);
  const levelRef = useRef(level);
  const softDrop = useRef(false);
  const lockUntil = useRef(0);
  const grounded = useRef(false);
  const startMs = useRef(Date.now());
  const ended = useRef(false);
  const lastMoveCol = useRef(0);
  const gravityAcc = useRef(0);

  boardRef.current = board;
  activeRef.current = active;
  nextRef.current = nextKind;
  scoreRef.current = score;
  linesRef.current = lines;
  levelRef.current = level;

  const pad = 12;
  const previewW = Math.min(72, width * 0.18);
  const fieldW = width - pad * 2 - previewW - 8;
  const fieldH = height - pad * 2;
  const cell = Math.min(fieldW / COLS, fieldH / ROWS);
  const playW = cell * COLS;
  const playH = cell * ROWS;
  const ox = pad;
  const oy = pad + Math.max(0, (fieldH - playH) / 2);
  const previewX = ox + playW + 12;
  const previewY = oy + 8;

  useEffect(() => {
    onScore(score, lines);
  }, [lines, onScore, score]);

  const finish = () => {
    if (ended.current) return;
    ended.current = true;
    sfxRef.current('death');
    onGameOver({
      score: scoreRef.current,
      bestMetric: linesRef.current,
      durationSec: Math.round((Date.now() - startMs.current) / 1000),
    });
  };

  const spawnFromBag = (boardNow: Board): Active | null => {
    const kind = nextRef.current;
    const following = takeNext();
    nextRef.current = following;
    setNextKind(following);
    const piece = spawnPiece(kind);
    if (!fits(boardNow, piece)) return null;
    grounded.current = false;
    lockUntil.current = 0;
    return piece;
  };

  const commitLock = (piece: Active) => {
    let nextBoard = lockPiece(boardRef.current, piece);
    const cleared = clearLines(nextBoard);
    nextBoard = cleared.board;
    if (cleared.cleared > 0) {
      const lvl = levelRef.current;
      const gained = LINE_SCORES[cleared.cleared]! * (lvl + 1);
      scoreRef.current += gained;
      linesRef.current += cleared.cleared;
      levelRef.current = Math.floor(linesRef.current / 10);
      setScore(scoreRef.current);
      setLines(linesRef.current);
      setLevel(levelRef.current);
      sfxRef.current(cleared.cleared >= 4 ? 'level' : 'clear');
    } else {
      sfxRef.current('lock');
    }
    boardRef.current = nextBoard;
    setBoard(nextBoard);

    const spawned = spawnFromBag(nextBoard);
    if (!spawned) {
      finish();
      return;
    }
    activeRef.current = spawned;
    setActive(spawned);
  };

  const moveBy = (dx: number, dy: number) => {
    if (ended.current || paused) return;
    const next = { ...activeRef.current, x: activeRef.current.x + dx, y: activeRef.current.y + dy };
    if (!fits(boardRef.current, next)) return;
    activeRef.current = next;
    setActive(next);
    if (dx !== 0 || dy < 0) {
      grounded.current = false;
      lockUntil.current = 0;
    }
  };

  const rotate = () => {
    if (ended.current || paused) return;
    const rotated = tryRotate(boardRef.current, activeRef.current);
    if (!rotated) return;
    activeRef.current = rotated;
    setActive(rotated);
    grounded.current = false;
    lockUntil.current = 0;
    sfxRef.current('move');
  };

  const hardDrop = () => {
    if (ended.current || paused) return;
    const piece = activeRef.current;
    const gy = ghostY(boardRef.current, piece);
    const dropped = gy - piece.y;
    if (dropped > 0) {
      scoreRef.current += dropped * 2;
      setScore(scoreRef.current);
    }
    const locked = { ...piece, y: gy };
    activeRef.current = locked;
    setActive(locked);
    commitLock(locked);
  };

  useEffect(() => {
    if (paused || ended.current) return;
    let frame = 0;
    let last = Date.now();

    const tick = () => {
      if (ended.current) return;
      const now = Date.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const piece = activeRef.current;
      const boardNow = boardRef.current;
      const canFall = fits(boardNow, { ...piece, y: piece.y + 1 });

      if (!canFall) {
        if (!grounded.current) {
          grounded.current = true;
          lockUntil.current = now + LOCK_MS;
        } else if (now >= lockUntil.current) {
          commitLock(piece);
        }
      } else {
        grounded.current = false;
        const gMs = softDrop.current
          ? Math.min(80, gravityFor(baseGravity, levelRef.current) * 0.12)
          : gravityFor(baseGravity, levelRef.current);
        gravityAcc.current += dt * 1000;
        if (gravityAcc.current >= gMs) {
          gravityAcc.current = 0;
          const next = { ...piece, y: piece.y + 1 };
          activeRef.current = next;
          setActive(next);
          if (softDrop.current) {
            scoreRef.current += 1;
            setScore(scoreRef.current);
          }
        }
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // commitLock/finish close over stable refs; intentional
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseGravity, paused]);

  const pan = Gesture.Pan()
    .runOnJS(true)
    .onBegin(() => {
      lastMoveCol.current = 0;
      softDrop.current = false;
    })
    .onUpdate((e) => {
      if (ended.current || paused) return;
      const colSteps = Math.trunc(e.translationX / (cell * 0.85));
      if (colSteps !== lastMoveCol.current) {
        const dir = colSteps > lastMoveCol.current ? 1 : -1;
        const steps = Math.abs(colSteps - lastMoveCol.current);
        for (let i = 0; i < steps; i += 1) moveBy(dir, 0);
        lastMoveCol.current = colSteps;
      }
      softDrop.current = e.translationY > 28;
    })
    .onEnd((e) => {
      softDrop.current = false;
      if (ended.current || paused) return;
      const ax = Math.abs(e.translationX);
      const ay = Math.abs(e.translationY);
      const speed = Math.hypot(e.velocityX, e.velocityY);

      if (ay > ax && e.translationY < -28) {
        rotate();
        return;
      }
      if (ay > ax && e.translationY > 40 && (speed > 900 || e.translationY > cell * 6)) {
        hardDrop();
      }
    });

  const tap = Gesture.Tap()
    .runOnJS(true)
    .onEnd(() => {
      rotate();
    });

  const gesture = Gesture.Race(tap, pan);

  const ghost = { ...active, y: ghostY(board, active) };
  const activeCells = cellsOf(active);
  const ghostCells = cellsOf(ghost);
  const nextCells = shapeAt(nextKind, 0).map((p) => ({ x: p.x + 1, y: p.y + 1 }));
  const activeColor = kindColor(active.kind);
  const ghostColor = kindColor(active.kind, true);
  const nextColor = kindColor(nextKind);

  return (
    <GestureDetector gesture={gesture}>
      <View style={[styles.fill, { backgroundColor: boardBg }]}>
        <Canvas style={{ width, height, backgroundColor: boardBg }}>
          <Rect x={0} y={0} width={width} height={height} color={boardBg} />

          {/* Playfield frame */}
          <RoundedRect
            x={ox - 2}
            y={oy - 2}
            width={playW + 4}
            height={playH + 4}
            r={6}
            color={frameColor}
            opacity={0.25}
          />
          <Rect x={ox} y={oy} width={playW} height={playH} color={boardBg} />

          {/* Grid */}
          {Array.from({ length: COLS + 1 }).map((_, i) => (
            <Rect
              key={`vx-${i}`}
              x={ox + i * cell}
              y={oy}
              width={1}
              height={playH}
              color={frameColor}
              opacity={0.12}
            />
          ))}
          {Array.from({ length: ROWS + 1 }).map((_, i) => (
            <Rect
              key={`hy-${i}`}
              x={ox}
              y={oy + i * cell}
              width={playW}
              height={1}
              color={frameColor}
              opacity={0.12}
            />
          ))}

          {/* Locked stack — each cell keeps its piece colour */}
          {board.map((row, y) =>
            row.map((kind, x) =>
              kind ? (
                <RoundedRect
                  key={`b-${x}-${y}`}
                  x={ox + x * cell + 1}
                  y={oy + y * cell + 1}
                  width={cell - 2}
                  height={cell - 2}
                  r={3}
                  color={kindColor(kind)}
                />
              ) : null,
            ),
          )}

          {/* Ghost */}
          {ghostCells.map((c, i) =>
            c.y >= 0 ? (
              <RoundedRect
                key={`g-${i}`}
                x={ox + c.x * cell + 2}
                y={oy + c.y * cell + 2}
                width={cell - 4}
                height={cell - 4}
                r={3}
                color={ghostColor}
              />
            ) : null,
          )}

          {/* Active piece */}
          {activeCells.map((c, i) =>
            c.y >= 0 ? (
              <RoundedRect
                key={`a-${i}`}
                x={ox + c.x * cell + 1}
                y={oy + c.y * cell + 1}
                width={cell - 2}
                height={cell - 2}
                r={3}
                color={activeColor}
              />
            ) : null,
          )}

          {/* Next preview */}
          <RoundedRect
            x={previewX}
            y={previewY}
            width={previewW}
            height={previewW}
            r={8}
            color={nextColor}
            opacity={0.2}
          />
          {nextCells.map((c, i) => {
            const pc = previewW / 4;
            return (
              <RoundedRect
                key={`n-${i}`}
                x={previewX + 8 + c.x * pc}
                y={previewY + 10 + c.y * pc}
                width={pc - 3}
                height={pc - 3}
                r={3}
                color={nextColor}
              />
            );
          })}

          {/* Level pips */}
          {Array.from({ length: Math.min(10, level + 1) }).map((_, i) => (
            <Rect
              key={`lv-${i}`}
              x={previewX + i * 7}
              y={previewY + previewW + 10}
              width={5}
              height={6}
              color={frameColor}
              opacity={0.9}
            />
          ))}
        </Canvas>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
