import {
  Canvas,
  Group,
  Rect,
  RoundedRect,
  Text as SkText,
  matchFont,
} from '@shopify/react-native-skia';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import type { EyeSide } from '@/src/anaglyph/color';
import { colorForEye } from '@/src/anaglyph/palette';
import { useGameAudio } from '@/src/audio/useGameAudio';
import type { GameSceneProps } from '../types';
import {
  countCleared,
  emptyGrid,
  isWin,
  placeMines,
  revealFlood,
  specFor,
  type Cell,
  type DiffKey,
} from './minesweeperLogic';

function resolveDiff(settings: Record<string, string | number | boolean>): DiffKey {
  const raw = String(settings.difficulty ?? 'easy');
  if (raw === 'hard' || raw === 'extraHard') return raw;
  return 'easy';
}

export function MinesweeperGame({
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
  const { size, mines } = specFor(diff);
  const boardBg = palette.background;

  const [coverEye, setCoverEye] = useState<EyeSide>('left');
  const contentEye: EyeSide = coverEye === 'left' ? 'right' : 'left';
  const coverColor = colorForEye(palette, coverEye);
  const contentColor = colorForEye(palette, contentEye);

  const [grid, setGrid] = useState<Cell[][]>(() => emptyGrid(size));
  const [armed, setArmed] = useState(false);
  const [cleared, setCleared] = useState(0);
  const [score, setScore] = useState(0);
  const [pulse, setPulse] = useState(0);

  const startMs = useRef(Date.now());
  const ended = useRef(false);
  const swapAcc = useRef(0);
  const gridRef = useRef(grid);
  gridRef.current = grid;

  const pad = 8;
  const cellSize = Math.min((width - pad * 2) / size, (height - pad * 2 - 24) / size);
  const gridW = cellSize * size;
  const gridH = cellSize * size;
  const ox = (width - gridW) / 2;
  const oy = (height - gridH) / 2;

  const font = useMemo(
    () =>
      matchFont({
        fontFamily: Platform.select({ ios: 'Helvetica', default: 'sans-serif' })!,
        fontSize: Math.max(10, cellSize * 0.45),
        fontWeight: '700',
      }),
    [cellSize],
  );

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
      swapAcc.current += dt;
      if (swapAcc.current >= 20) {
        swapAcc.current = 0;
        setCoverEye((e) => (e === 'left' ? 'right' : 'left'));
      }
      setPulse((p) => (p + dt * 3) % (Math.PI * 2));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [paused]);

  const finish = (won: boolean, nextCleared: number, nextScore: number) => {
    if (ended.current) return;
    ended.current = true;
    sfx(won ? 't48_merge' : 'ast_die');
    onGameOver({
      score: nextScore,
      bestMetric: nextCleared,
      durationSec: Math.round((Date.now() - startMs.current) / 1000),
    });
  };

  const atCell = (x: number, y: number) => {
    const c = Math.floor((x - ox) / cellSize);
    const r = Math.floor((y - oy) / cellSize);
    if (r < 0 || c < 0 || r >= size || c >= size) return null;
    return { r, c };
  };

  const revealAt = (r: number, c: number) => {
    if (ended.current) return;
    let g = gridRef.current.map((row) => row.map((cell) => ({ ...cell })));
    let nextArmed = armed;
    if (!nextArmed) {
      placeMines(g, mines, r, c);
      nextArmed = true;
      setArmed(true);
    }
    const cell = g[r]![c]!;
    if (cell.flagged || cell.revealed) return;
    if (cell.mine) {
      for (const row of g) for (const x of row) if (x.mine) x.revealed = true;
      setGrid(g);
      finish(false, cleared, score);
      return;
    }
    const opened = revealFlood(g, r, c);
    const nextCleared = countCleared(g);
    const elapsed = (Date.now() - startMs.current) / 1000;
    const nextScore = nextCleared * 10 + Math.max(0, Math.floor(400 - elapsed));
    setGrid(g);
    setCleared(nextCleared);
    setScore(nextScore);
    sfx('t48_move');
    if (isWin(g)) {
      const bonus = 200 + mines * 5;
      finish(true, nextCleared, nextScore + bonus);
    } else if (opened) {
      /* keep playing */
    }
  };

  const flagAt = (r: number, c: number) => {
    if (ended.current) return;
    const g = gridRef.current.map((row) => row.map((cell) => ({ ...cell })));
    const cell = g[r]![c]!;
    if (cell.revealed) return;
    cell.flagged = !cell.flagged;
    setGrid(g);
    sfx('t48_merge');
  };

  const tap = Gesture.Tap()
    .runOnJS(true)
    .onEnd((e) => {
      const hit = atCell(e.x, e.y);
      if (hit) revealAt(hit.r, hit.c);
    });

  const longPress = Gesture.LongPress()
    .minDuration(380)
    .runOnJS(true)
    .onStart((e) => {
      const hit = atCell(e.x, e.y);
      if (hit) flagAt(hit.r, hit.c);
    });

  const gesture = Gesture.Exclusive(longPress, tap);

  return (
    <GestureDetector gesture={gesture}>
      <View style={[styles.fill, { backgroundColor: boardBg }]}>
        <Canvas style={{ width, height }}>
          <Rect x={0} y={0} width={width} height={height} color={boardBg} />
          {grid.map((row, r) =>
            row.map((tile, c) => {
              const x = ox + c * cellSize;
              const y = oy + r * cellSize;
              const inset = 1.5;
              if (!tile.revealed) {
                return (
                  <Group key={`${r}-${c}`}>
                    <RoundedRect
                      x={x + inset}
                      y={y + inset}
                      width={cellSize - inset * 2}
                      height={cellSize - inset * 2}
                      r={3}
                      color={coverColor}
                      opacity={tile.flagged ? 0.55 : 0.85}
                    />
                    {tile.flagged ? (
                      <SkText
                        x={x + cellSize * 0.28}
                        y={y + cellSize * 0.68}
                        text="⚑"
                        font={font}
                        color={contentColor}
                      />
                    ) : null}
                  </Group>
                );
              }
              if (tile.mine) {
                return (
                  <Group key={`${r}-${c}`}>
                    <RoundedRect
                      x={x + inset}
                      y={y + inset}
                      width={cellSize - inset * 2}
                      height={cellSize - inset * 2}
                      r={3}
                      color={contentColor}
                      opacity={0.9}
                    />
                    <SkText
                      x={x + cellSize * 0.3}
                      y={y + cellSize * 0.68}
                      text="●"
                      font={font}
                      color={boardBg}
                    />
                  </Group>
                );
              }
              return (
                <Group key={`${r}-${c}`}>
                  <RoundedRect
                    x={x + inset}
                    y={y + inset}
                    width={cellSize - inset * 2}
                    height={cellSize - inset * 2}
                    r={3}
                    color={coverColor}
                    opacity={0.18}
                  />
                  {tile.adj > 0 ? (
                    <SkText
                      x={x + cellSize * 0.32}
                      y={y + cellSize * 0.68}
                      text={String(tile.adj)}
                      font={font}
                      color={contentColor}
                      opacity={0.75 + Math.sin(pulse) * 0.15}
                    />
                  ) : null}
                </Group>
              );
            }),
          )}
        </Canvas>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
