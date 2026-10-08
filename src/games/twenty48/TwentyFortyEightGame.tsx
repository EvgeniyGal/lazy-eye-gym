import {
  Canvas,
  RoundedRect,
  Text as SkText,
  matchFont,
  Group,
} from '@shopify/react-native-skia';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { colorForEye } from '@/src/anaglyph/palette';
import type { EyeSide } from '@/src/anaglyph/color';
import type { GameSceneProps } from '../types';

type Cell = number;

const SIZE = 4;

function emptyBoard(): Cell[][] {
  return Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => 0));
}

function spawn(board: Cell[][]): Cell[][] {
  const free: [number, number][] = [];
  board.forEach((row, r) => row.forEach((v, c) => v === 0 && free.push([r, c])));
  if (!free.length) return board;
  const [r, c] = free[Math.floor(Math.random() * free.length)]!;
  const next = board.map((row) => [...row]);
  next[r]![c] = Math.random() < 0.9 ? 2 : 4;
  return next;
}

function slide(line: number[]) {
  const filtered = line.filter((n) => n !== 0);
  const out: number[] = [];
  let scoreGain = 0;
  let i = 0;
  while (i < filtered.length) {
    if (filtered[i] === filtered[i + 1]) {
      const merged = filtered[i]! * 2;
      out.push(merged);
      scoreGain += merged;
      i += 2;
    } else {
      out.push(filtered[i]!);
      i += 1;
    }
  }
  while (out.length < SIZE) out.push(0);
  return { line: out, scoreGain };
}

function move(board: Cell[][], dir: 'up' | 'down' | 'left' | 'right') {
  let scoreGain = 0;
  const next = emptyBoard();
  const read = (r: number, c: number) => board[r]![c]!;
  for (let i = 0; i < SIZE; i += 1) {
    let line: number[] = [];
    if (dir === 'left' || dir === 'right') {
      line = Array.from({ length: SIZE }, (_, c) => read(i, c));
      if (dir === 'right') line.reverse();
      const slid = slide(line);
      scoreGain += slid.scoreGain;
      const result = dir === 'right' ? [...slid.line].reverse() : slid.line;
      result.forEach((v, c) => {
        next[i]![c] = v;
      });
    } else {
      line = Array.from({ length: SIZE }, (_, r) => read(r, i));
      if (dir === 'down') line.reverse();
      const slid = slide(line);
      scoreGain += slid.scoreGain;
      const result = dir === 'down' ? [...slid.line].reverse() : slid.line;
      result.forEach((v, r) => {
        next[r]![i] = v;
      });
    }
  }
  const changed = JSON.stringify(board) !== JSON.stringify(next);
  return { board: next, scoreGain, changed };
}

function canMove(board: Cell[][]) {
  for (const dir of ['up', 'down', 'left', 'right'] as const) {
    if (move(board, dir).changed) return true;
  }
  return false;
}

function maxTile(board: Cell[][]) {
  return Math.max(0, ...board.flat());
}

export function TwentyFortyEightGame({
  width,
  height,
  palette,
  settings,
  paused,
  onScore,
  onGameOver,
}: GameSceneProps) {
  const [board, setBoard] = useState(() => spawn(spawn(emptyBoard())));
  const [score, setScore] = useState(0);
  const startMs = useRef(Date.now());
  const ended = useRef(false);

  const boardEye = (settings.boardEye as EyeSide) || 'left';
  const tileEye = (settings.tileEye as EyeSide) || 'right';
  const boardColor = colorForEye(palette, boardEye);
  const tileColor = colorForEye(palette, tileEye);

  const pad = 16;
  const size = Math.min(width - pad * 2, height - pad * 2);
  const originX = (width - size) / 2;
  const originY = (height - size) / 2;
  const cell = size / SIZE;
  const gap = 8;

  const font = useMemo(
    () =>
      matchFont({
        fontFamily: Platform.select({ ios: 'Helvetica', default: 'sans-serif' })!,
        fontSize: cell * 0.28,
        fontWeight: '700',
      }),
    [cell],
  );

  useEffect(() => {
    onScore(score, maxTile(board));
  }, [board, onScore, score]);

  const applyMove = useCallback(
    (dir: 'up' | 'down' | 'left' | 'right') => {
      if (paused || ended.current) return;
      setBoard((prev) => {
        const result = move(prev, dir);
        if (!result.changed) return prev;
        const withSpawn = spawn(result.board);
        const nextScore = score + result.scoreGain;
        setScore(nextScore);
        if (!canMove(withSpawn)) {
          ended.current = true;
          onGameOver({
            score: nextScore,
            bestMetric: maxTile(withSpawn),
            durationSec: Math.round((Date.now() - startMs.current) / 1000),
          });
        }
        return withSpawn;
      });
    },
    [onGameOver, paused, score],
  );

  const pan = Gesture.Pan()
    .runOnJS(true)
    .onEnd((e) => {
      const ax = Math.abs(e.translationX);
      const ay = Math.abs(e.translationY);
      if (Math.max(ax, ay) < 24) return;
      if (ax > ay) applyMove(e.translationX > 0 ? 'right' : 'left');
      else applyMove(e.translationY > 0 ? 'down' : 'up');
    });

  return (
    <GestureDetector gesture={pan}>
      <View style={styles.fill}>
        <Canvas style={{ width, height }}>
          <RoundedRect
            x={originX}
            y={originY}
            width={size}
            height={size}
            r={16}
            color={boardColor}
            opacity={0.35}
          />
          {board.map((row, r) =>
            row.map((value, c) => {
              const x = originX + c * cell + gap / 2;
              const y = originY + r * cell + gap / 2;
              const w = cell - gap;
              if (!value) {
                return (
                  <RoundedRect
                    key={`${r}-${c}`}
                    x={x}
                    y={y}
                    width={w}
                    height={w}
                    r={10}
                    color={boardColor}
                    opacity={0.25}
                  />
                );
              }
              return (
                <Group key={`${r}-${c}`}>
                  <RoundedRect x={x} y={y} width={w} height={w} r={10} color={tileColor} />
                  <SkText
                    x={x + w / 2 - (String(value).length * cell * 0.08)}
                    y={y + w / 2 + cell * 0.1}
                    text={String(value)}
                    font={font}
                    color={palette.background}
                  />
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
