import { Canvas, Circle, Group, Rect, RoundedRect } from '@shopify/react-native-skia';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { colorForEye } from '@/src/anaglyph/palette';
import { useGameAudio } from '@/src/audio/useGameAudio';
import type { GameSceneProps } from '../types';
import {
  COLS,
  ROWS,
  adjacent,
  clearOnce,
  createBoard,
  expandClears,
  eyeForKind,
  findMatches,
  makeCell,
  markFocus,
  movesFor,
  swapCells,
  targetFor,
  type Cell,
  type DiffKey,
  type Kind,
} from './candyLogic';

function resolveDiff(settings: Record<string, string | number | boolean>): DiffKey {
  const raw = String(settings.difficulty ?? 'easy');
  if (raw === 'hard' || raw === 'extraHard') return raw;
  return 'easy';
}

const SHAPES: Record<Kind, 'circle' | 'square' | 'diamond'> = {
  0: 'circle',
  1: 'square',
  2: 'diamond',
  3: 'circle',
  4: 'square',
  5: 'diamond',
};

type Burst = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  r: number;
};

let burstSeq = 0;

export function CandyGame({
  width,
  height,
  palette,
  settings,
  paused,
  onScore,
  onGameOver,
}: GameSceneProps) {
  const { sfx } = useGameAudio(settings);
  const diff = resolveDiff(settings);
  const leftColor = colorForEye(palette, 'left');
  const rightColor = colorForEye(palette, 'right');
  const boardBg = palette.background;
  const target = targetFor(diff);

  const [board, setBoard] = useState<Cell[][]>(() => markFocus(createBoard()));
  const [moves, setMoves] = useState(movesFor(diff));
  const [cleared, setCleared] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<{ r: number; c: number } | null>(null);
  const [pulse, setPulse] = useState(0);
  const [clearsSinceFocus, setClearsSinceFocus] = useState(0);
  const [flashKeys, setFlashKeys] = useState<Set<string>>(new Set());
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [busy, setBusy] = useState(false);

  const startMs = useRef(Date.now());
  const ended = useRef(false);
  const boardRef = useRef(board);
  const scoreRef = useRef(score);
  const clearedRef = useRef(cleared);
  const movesRef = useRef(moves);
  const focusMeterRef = useRef(clearsSinceFocus);
  const burstsRef = useRef(bursts);
  boardRef.current = board;
  scoreRef.current = score;
  clearedRef.current = cleared;
  movesRef.current = moves;
  focusMeterRef.current = clearsSinceFocus;
  burstsRef.current = bursts;

  const hudH = 36;
  const canvasH = height - hudH;
  const pad = 8;
  const cellSize = Math.min((width - pad * 2) / COLS, (canvasH - pad * 2) / ROWS);
  const gridW = cellSize * COLS;
  const gridH = cellSize * ROWS;
  const ox = (width - gridW) / 2;
  const oy = (canvasH - gridH) / 2;

  useEffect(() => {
    onScore(score, cleared);
  }, [cleared, onScore, score]);

  useEffect(() => {
    if (paused || ended.current) return;
    let frame = 0;
    let last = Date.now();
    const tick = () => {
      const now = Date.now();
      const dt = (now - last) / 1000;
      last = now;
      setPulse((p) => (p + dt * 4) % (Math.PI * 2));
      if (burstsRef.current.length) {
        setBursts((prev) =>
          prev
            .map((b) => ({
              ...b,
              x: b.x + b.vx * dt,
              y: b.y + b.vy * dt,
              vy: b.vy + 420 * dt,
              life: b.life - dt,
            }))
            .filter((b) => b.life > 0),
        );
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [paused]);

  const finish = (won: boolean, nextScore: number, nextCleared: number) => {
    if (ended.current) return;
    ended.current = true;
    const result = {
      score: nextScore,
      bestMetric: nextCleared,
      durationSec: Math.round((Date.now() - startMs.current) / 1000),
    };
    setTimeout(() => {
      onGameOver(result);
      sfx(won ? 'brk_stage' : 't48_over');
    }, 0);
  };

  const cellCenter = (r: number, c: number) => ({
    x: ox + c * cellSize + cellSize / 2,
    y: oy + r * cellSize + cellSize / 2,
  });

  const colorFor = (kind: Kind) => (eyeForKind(kind) === 'left' ? leftColor : rightColor);

  const spawnBurstsAt = (keys: Set<string>, grid: Cell[][]) => {
    const next: Burst[] = [];
    for (const key of keys) {
      const [r, c] = key.split(',').map(Number) as [number, number];
      const cell = grid[r]?.[c];
      if (!cell) continue;
      const { x, y } = cellCenter(r, c);
      const fill = colorFor(cell.kind);
      const n = 7;
      for (let i = 0; i < n; i += 1) {
        const ang = (Math.PI * 2 * i) / n + Math.random() * 0.4;
        const spd = 80 + Math.random() * 160;
        burstSeq += 1;
        next.push({
          id: `b-${burstSeq}`,
          x,
          y,
          vx: Math.cos(ang) * spd * 0.7,
          vy: Math.sin(ang) * spd * 0.7 - 30,
          life: 0.55 + Math.random() * 0.35,
          maxLife: 0.9,
          color: fill,
          r: 2.5 + Math.random() * 3.5,
        });
      }
    }
    setBursts((prev) => [...prev, ...next].slice(-180));
  };

  const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  const runCascade = async (startBoard: Cell[][], movesLeft: number) => {
    setBusy(true);
    let cur = startBoard;
    let totalGain = 0;
    let totalCleared = 0;
    let step = 0;

    while (step < 20) {
      const matches = findMatches(cur);
      if (!matches.size) break;
      const preview = expandClears(cur, matches);
      setFlashKeys(new Set(preview));
      spawnBurstsAt(preview, cur);

      const hasLine = [...preview].some((k) => {
        const [r, c] = k.split(',').map(Number) as [number, number];
        return cur[r]?.[c]?.special === 'line';
      });
      const hasBomb = [...preview].some((k) => {
        const [r, c] = k.split(',').map(Number) as [number, number];
        return cur[r]?.[c]?.special === 'bomb';
      });
      if (hasBomb) sfx('pwr_bomb');
      else if (hasLine) sfx('pwr_laser');
      else if (step === 0) sfx('t48_merge');
      else sfx('pwr_multi');

      await wait(400);

      const result = clearOnce(cur);
      if (!result) break;
      if (result.spawnedSpecial) sfx('pwr_spawn');

      cur = result.board;
      totalGain += result.scoreGain;
      totalCleared += result.cleared;
      setFlashKeys(new Set());
      setBoard(cur);
      boardRef.current = cur;

      const nextCleared = clearedRef.current + result.cleared;
      const nextScore = scoreRef.current + result.scoreGain;
      clearedRef.current = nextCleared;
      scoreRef.current = nextScore;
      setCleared(nextCleared);
      setScore(nextScore);

      let focusMeter = focusMeterRef.current + 1;
      if (focusMeter >= 8) {
        cur = markFocus(cur);
        boardRef.current = cur;
        setBoard(cur);
        focusMeter = 0;
        sfx('pwr_spawn');
      }
      focusMeterRef.current = focusMeter;
      setClearsSinceFocus(focusMeter);

      if (nextScore >= target) {
        setBusy(false);
        finish(true, nextScore + 200, nextCleared);
        return;
      }

      step += 1;
      await wait(280);
    }

    setFlashKeys(new Set());
    setBusy(false);
    if (movesLeft <= 0 && scoreRef.current < target) {
      finish(false, scoreRef.current, clearedRef.current);
    }
  };

  const trySwap = (r1: number, c1: number, r2: number, c2: number) => {
    if (ended.current || paused || busy) return;
    if (!adjacent(r1, c1, r2, c2)) return;
    const swapped = swapCells(boardRef.current, r1, c1, r2, c2);
    const matches = findMatches(swapped);
    if (!matches.size) {
      sfx('ast_die');
      return;
    }
    const nextMoves = movesRef.current - 1;
    movesRef.current = nextMoves;
    setMoves(nextMoves);
    setBoard(swapped);
    boardRef.current = swapped;
    void runCascade(swapped, nextMoves);
  };

  /** Tap a selected special candy again to detonate it (counts as a move). */
  const activateSpecial = (r: number, c: number) => {
    if (ended.current || paused || busy) return;
    const cell = boardRef.current[r]?.[c];
    if (!cell || cell.special === 'none') return;
    const nextMoves = movesRef.current - 1;
    movesRef.current = nextMoves;
    setMoves(nextMoves);
    const seeded = boardRef.current.map((row) => row.map((x) => ({ ...x })));
    const keys = expandClears(seeded, new Set([`${r},${c}`]));
    const forced = forceClearKeys(seeded, keys);
    spawnBurstsAt(keys, seeded);
    setFlashKeys(keys);
    if (cell.special === 'bomb') sfx('pwr_bomb');
    else sfx('pwr_laser');
    void (async () => {
      setBusy(true);
      await wait(380);
      setFlashKeys(new Set());
      setBoard(forced.after);
      boardRef.current = forced.after;
      const nextCleared = clearedRef.current + forced.cleared;
      const nextScore = scoreRef.current + forced.cleared * 10;
      clearedRef.current = nextCleared;
      scoreRef.current = nextScore;
      setCleared(nextCleared);
      setScore(nextScore);
      await runCascade(forced.after, nextMoves);
    })();
  };

  const onTapCell = (r: number, c: number) => {
    if (busy || ended.current || paused) return;
    const cell = boardRef.current[r]?.[c];
    if (!selected) {
      setSelected({ r, c });
      sfx('t48_move');
      return;
    }
    if (selected.r === r && selected.c === c) {
      if (cell && cell.special !== 'none') {
        setSelected(null);
        activateSpecial(r, c);
        return;
      }
      setSelected(null);
      return;
    }
    trySwap(selected.r, selected.c, r, c);
    setSelected(null);
  };

  const tap = Gesture.Pan()
    .runOnJS(true)
    .onBegin((e) => {
      if (busy) return;
      const c = Math.floor((e.x - ox) / cellSize);
      const r = Math.floor((e.y - oy) / cellSize);
      if (r >= 0 && c >= 0 && r < ROWS && c < COLS) onTapCell(r, c);
    })
    .onEnd((e) => {
      if (!selected || busy) return;
      const c = Math.floor((e.x - ox) / cellSize);
      const r = Math.floor((e.y - oy) / cellSize);
      if (r >= 0 && c >= 0 && r < ROWS && c < COLS) {
        if (selected.r !== r || selected.c !== c) {
          trySwap(selected.r, selected.c, r, c);
          setSelected(null);
        }
      }
    });

  return (
    <GestureDetector gesture={tap}>
      <View style={[styles.fill, { backgroundColor: boardBg }]}>
        <View style={[styles.hud, { height: hudH }]}>
          <Text style={[styles.hudText, { color: leftColor }]}>
            Score {score}/{target}
          </Text>
          <Text style={[styles.hudText, { color: rightColor }]}>Moves {moves}</Text>
        </View>
        <Canvas style={{ width, height: canvasH }}>
          <Rect x={0} y={0} width={width} height={canvasH} color={boardBg} />
          {board.map((row, r) =>
            row.map((tile, c) => {
              const x = ox + c * cellSize;
              const y = oy + r * cellSize;
              const fill = colorFor(tile.kind);
              const cx = x + cellSize / 2;
              const cy = y + cellSize / 2;
              const rad = cellSize * 0.32;
              const sel = selected?.r === r && selected?.c === c;
              const flashing = flashKeys.has(`${r},${c}`);
              const shape = SHAPES[tile.kind];
              const pop = flashing ? 1 + Math.sin(pulse * 4) * 0.12 : 1;
              return (
                <Group key={tile.id}>
                  {sel || tile.focus || flashing ? (
                    <RoundedRect
                      x={x + 2}
                      y={y + 2}
                      width={cellSize - 4}
                      height={cellSize - 4}
                      r={6}
                      color={
                        flashing
                          ? fill
                          : eyeForKind(tile.kind) === 'left'
                            ? rightColor
                            : leftColor
                      }
                      opacity={flashing ? 0.55 : 0.35 + (tile.focus ? Math.sin(pulse) * 0.2 : 0)}
                    />
                  ) : null}
                  <Group
                    transform={[
                      { translateX: cx },
                      { translateY: cy },
                      { scale: pop },
                      ...(shape === 'diamond' ? [{ rotate: Math.PI / 4 }] : []),
                    ]}
                  >
                    {shape === 'circle' ? (
                      <Circle cx={0} cy={0} r={rad} color={fill} opacity={flashing ? 0.35 : 1} />
                    ) : (
                      <RoundedRect
                        x={shape === 'diamond' ? -rad * 0.85 : -rad}
                        y={shape === 'diamond' ? -rad * 0.85 : -rad}
                        width={shape === 'diamond' ? rad * 1.7 : rad * 2}
                        height={shape === 'diamond' ? rad * 1.7 : rad * 2}
                        r={shape === 'diamond' ? 3 : 4}
                        color={fill}
                        opacity={flashing ? 0.35 : 1}
                      />
                    )}
                  </Group>
                  {tile.special === 'line' ? (
                    <Group>
                      <Rect x={cx - 1.5} y={cy - rad} width={3} height={rad * 2} color={boardBg} />
                      <Rect x={cx - rad} y={cy - 1.5} width={rad * 2} height={3} color={boardBg} />
                    </Group>
                  ) : null}
                  {tile.special === 'bomb' ? (
                    <Circle cx={cx} cy={cy} r={rad * 0.35} color={boardBg} />
                  ) : null}
                </Group>
              );
            }),
          )}
          {bursts.map((b) => (
            <Circle
              key={b.id}
              cx={b.x}
              cy={b.y}
              r={b.r * (b.life / b.maxLife)}
              color={b.color}
              opacity={Math.max(0, b.life / b.maxLife)}
            />
          ))}
        </Canvas>
      </View>
    </GestureDetector>
  );
}

/** Clear specific keys then apply gravity/refill (special tap). */
function forceClearKeys(board: Cell[][], keys: Set<string>) {
  const grid: (Cell | null)[][] = board.map((row) => row.map((c) => ({ ...c })));
  let cleared = 0;
  for (const key of keys) {
    const [r, c] = key.split(',').map(Number) as [number, number];
    if (!grid[r]?.[c]) continue;
    grid[r]![c] = null;
    cleared += 1;
  }
  const next: Cell[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => makeCell()),
  );
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
  return { after: next, cleared };
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  hud: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  hudText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
