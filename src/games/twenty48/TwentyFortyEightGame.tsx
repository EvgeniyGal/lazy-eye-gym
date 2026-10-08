import {
  Canvas,
  Group,
  RoundedRect,
  Text as SkText,
  matchFont,
} from '@shopify/react-native-skia';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import type { EyeSide } from '@/src/anaglyph/color';
import { colorForEye } from '@/src/anaglyph/palette';
import type { GameSceneProps } from '../types';

type Dir = 'up' | 'down' | 'left' | 'right';

type Tile = {
  id: string;
  value: number;
  eye: EyeSide;
  row: number;
  col: number;
  x: number;
  y: number;
};

type AnimSpec = {
  id: string;
  value: number;
  eye: EyeSide;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  /** Keep after animation as settled tile */
  keep: boolean;
  /** Hide until the slide finishes (merged result) */
  appearAtEnd?: boolean;
};

const SIZE = 4;
const ANIM_MS = 170;
let tileSeq = 0;

function nextId() {
  tileSeq += 1;
  return `t-${tileSeq}-${Math.random().toString(36).slice(2, 7)}`;
}

function randomEye(): EyeSide {
  return Math.random() < 0.5 ? 'left' : 'right';
}

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

function createTile(row: number, col: number, value?: number, eye?: EyeSide): Tile {
  return {
    id: nextId(),
    value: value ?? (Math.random() < 0.9 ? 2 : 4),
    eye: eye ?? randomEye(),
    row,
    col,
    x: col,
    y: row,
  };
}

function spawnTile(tiles: Tile[]): Tile | null {
  const occupied = new Set(tiles.map((t) => `${t.row},${t.col}`));
  const free: [number, number][] = [];
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      if (!occupied.has(`${r},${c}`)) free.push([r, c]);
    }
  }
  if (!free.length) return null;
  const [row, col] = free[Math.floor(Math.random() * free.length)]!;
  return createTile(row, col);
}

function seedBoard(): Tile[] {
  const first = spawnTile([])!;
  const second = spawnTile([first])!;
  return [first, second];
}

function planMove(tiles: Tile[], dir: Dir) {
  const grid: (Tile | null)[][] = Array.from({ length: SIZE }, () =>
    Array.from({ length: SIZE }, () => null),
  );
  for (const t of tiles) grid[t.row]![t.col] = t;

  const vector =
    dir === 'left'
      ? { r: 0, c: -1 }
      : dir === 'right'
        ? { r: 0, c: 1 }
        : dir === 'up'
          ? { r: -1, c: 0 }
          : { r: 1, c: 0 };

  const rows = Array.from({ length: SIZE }, (_, i) => i);
  const cols = Array.from({ length: SIZE }, (_, i) => i);
  if (dir === 'right') cols.reverse();
  if (dir === 'down') rows.reverse();

  let scoreGain = 0;
  let changed = false;
  const mergedIds = new Set<string>();
  const resultGrid: (Tile | null)[][] = Array.from({ length: SIZE }, () =>
    Array.from({ length: SIZE }, () => null),
  );
  const anims: AnimSpec[] = [];

  for (const row of rows) {
    for (const col of cols) {
      const tile = grid[row]![col];
      if (!tile) continue;

      let r = row;
      let c = col;
      let nr = r + vector.r;
      let nc = c + vector.c;
      while (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && !resultGrid[nr]![nc]) {
        r = nr;
        c = nc;
        nr = r + vector.r;
        nc = c + vector.c;
      }

      const blocker = nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE ? resultGrid[nr]![nc] : null;

      if (blocker && blocker.value === tile.value && !mergedIds.has(blocker.id)) {
        const merged = createTile(nr, nc, tile.value * 2, randomEye());
        mergedIds.add(blocker.id);
        mergedIds.add(merged.id);

        // Both source tiles slide into the merge cell, then disappear
        anims.push({
          id: tile.id,
          value: tile.value,
          eye: tile.eye,
          fromX: col,
          fromY: row,
          toX: nc,
          toY: nr,
          keep: false,
        });
        // Update previous blocker anim destination if it was a simple move
        const prevAnim = anims.find((a) => a.id === blocker.id && a.keep);
        if (prevAnim) {
          prevAnim.keep = false;
          prevAnim.toX = nc;
          prevAnim.toY = nr;
        } else {
          anims.push({
            id: blocker.id,
            value: blocker.value,
            eye: blocker.eye,
            fromX: blocker.col,
            fromY: blocker.row,
            toX: nc,
            toY: nr,
            keep: false,
          });
        }

        resultGrid[nr]![nc] = merged;
        anims.push({
          id: merged.id,
          value: merged.value,
          eye: merged.eye,
          fromX: nc,
          fromY: nr,
          toX: nc,
          toY: nr,
          keep: true,
          appearAtEnd: true,
        });
        scoreGain += merged.value;
        changed = true;
      } else {
        if (r !== row || c !== col) changed = true;
        const next = { ...tile, row: r, col: c, x: c, y: r };
        resultGrid[r]![c] = next;
        anims.push({
          id: tile.id,
          value: tile.value,
          eye: tile.eye,
          fromX: col,
          fromY: row,
          toX: c,
          toY: r,
          keep: true,
        });
      }
    }
  }

  const settled: Tile[] = [];
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      const t = resultGrid[r]![c];
      if (t) settled.push({ ...t, row: r, col: c, x: c, y: r });
    }
  }

  return { changed, scoreGain, anims, settled };
}

function canMove(tiles: Tile[]) {
  for (const dir of ['up', 'down', 'left', 'right'] as const) {
    if (planMove(tiles, dir).changed) return true;
  }
  return false;
}

function maxTile(tiles: Tile[]) {
  return tiles.reduce((m, t) => Math.max(m, t.value), 0);
}

export function TwentyFortyEightGame({
  width,
  height,
  palette,
  paused,
  onScore,
  onGameOver,
}: GameSceneProps) {
  const [tiles, setTiles] = useState<Tile[]>(() => seedBoard());
  const [score, setScore] = useState(0);
  const [busy, setBusy] = useState(false);
  const startMs = useRef(Date.now());
  const ended = useRef(false);
  const tilesRef = useRef(tiles);
  const scoreRef = useRef(score);
  const frameRef = useRef<number | null>(null);
  tilesRef.current = tiles;
  scoreRef.current = score;

  const leftColor = colorForEye(palette, 'left');
  const rightColor = colorForEye(palette, 'right');

  const pad = 16;
  const boardSize = Math.min(width - pad * 2, height - pad * 2);
  const originX = (width - boardSize) / 2;
  const originY = (height - boardSize) / 2;
  const cell = boardSize / SIZE;
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
    onScore(score, maxTile(tiles));
  }, [onScore, score, tiles]);

  useEffect(() => {
    return () => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const applyMove = useCallback(
    (dir: Dir) => {
      if (paused || ended.current || busy) return;
      const plan = planMove(tilesRef.current, dir);
      if (!plan.changed) return;

      setBusy(true);
      const started = Date.now();

      const tick = () => {
        const t = Math.min(1, (Date.now() - started) / ANIM_MS);
        const e = easeOutCubic(t);

        const frameTiles: Tile[] = plan.anims
          .filter((a) => {
            if (t < 1 && a.appearAtEnd) return false;
            if (t >= 1 && !a.keep) return false;
            return true;
          })
          .map((a) => ({
            id: a.id,
            value: a.value,
            eye: a.eye,
            row: a.toY,
            col: a.toX,
            x: a.fromX + (a.toX - a.fromX) * e,
            y: a.fromY + (a.toY - a.fromY) * e,
          }));

        setTiles(frameTiles);

        if (t < 1) {
          frameRef.current = requestAnimationFrame(tick);
          return;
        }

        const nextScore = scoreRef.current + plan.scoreGain;
        setScore(nextScore);
        scoreRef.current = nextScore;

        const settled = plan.settled.map((t) => ({ ...t, x: t.col, y: t.row }));
        const spawned = spawnTile(settled);
        if (spawned) settled.push(spawned);
        setTiles(settled);
        tilesRef.current = settled;
        setBusy(false);

        if (!canMove(settled)) {
          ended.current = true;
          onGameOver({
            score: nextScore,
            bestMetric: maxTile(settled),
            durationSec: Math.round((Date.now() - startMs.current) / 1000),
          });
        }
      };

      frameRef.current = requestAnimationFrame(tick);
    },
    [busy, onGameOver, paused],
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
            width={boardSize}
            height={boardSize}
            r={16}
            color="#171f33"
          />
          {Array.from({ length: SIZE * SIZE }).map((_, i) => {
            const r = Math.floor(i / SIZE);
            const c = i % SIZE;
            return (
              <RoundedRect
                key={`cell-${i}`}
                x={originX + c * cell + gap / 2}
                y={originY + r * cell + gap / 2}
                width={cell - gap}
                height={cell - gap}
                r={10}
                color="#2d3449"
              />
            );
          })}
          {tiles.map((tile) => {
            const x = originX + tile.x * cell + gap / 2;
            const y = originY + tile.y * cell + gap / 2;
            const w = cell - gap;
            const fill = tile.eye === 'left' ? leftColor : rightColor;
            const label = String(tile.value);
            return (
              <Group key={tile.id}>
                <RoundedRect x={x} y={y} width={w} height={w} r={10} color={fill} />
                <SkText
                  x={x + w / 2 - label.length * cell * 0.08}
                  y={y + w / 2 + cell * 0.1}
                  text={label}
                  font={font}
                  color="#0b1326"
                />
              </Group>
            );
          })}
        </Canvas>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
