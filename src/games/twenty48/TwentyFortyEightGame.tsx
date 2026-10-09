import {
  Canvas,
  Group,
  RoundedRect,
  Text as SkText,
  matchFont,
} from '@shopify/react-native-skia';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import type { EyeSide } from '@/src/anaglyph/color';
import { colorForEye } from '@/src/anaglyph/palette';
import type { GameSceneProps } from '../types';

type Dir = 'up' | 'down' | 'left' | 'right';

type Tile = {
  id: string;
  value: number;
  row: number;
  col: number;
  x: number;
  y: number;
};

type AnimSpec = {
  id: string;
  value: number;
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

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

function createTile(row: number, col: number, value?: number): Tile {
  return {
    id: nextId(),
    value: value ?? (Math.random() < 0.9 ? 2 : 4),
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
        const merged = createTile(nr, nc, tile.value * 2);
        mergedIds.add(blocker.id);
        mergedIds.add(merged.id);

        anims.push({
          id: tile.id,
          value: tile.value,
          fromX: col,
          fromY: row,
          toX: nc,
          toY: nr,
          keep: false,
        });
        const prevAnim = anims.find((a) => a.id === blocker.id && a.keep);
        if (prevAnim) {
          prevAnim.keep = false;
          prevAnim.toX = nc;
          prevAnim.toY = nr;
        } else {
          anims.push({
            id: blocker.id,
            value: blocker.value,
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

function otherEye(eye: EyeSide): EyeSide {
  return eye === 'left' ? 'right' : 'left';
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
  const initialGridEye = (settings.gridEye as EyeSide) || 'left';
  const [gridEye, setGridEye] = useState<EyeSide | null>(null);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [score, setScore] = useState(0);
  const [busy, setBusy] = useState(false);
  const startMs = useRef(Date.now());
  const ended = useRef(false);
  const tilesRef = useRef(tiles);
  const scoreRef = useRef(score);
  const frameRef = useRef<number | null>(null);
  tilesRef.current = tiles;
  scoreRef.current = score;

  const boardBg = palette.background;
  const leftColor = colorForEye(palette, 'left');
  const rightColor = colorForEye(palette, 'right');
  const gridColor = gridEye === 'right' ? rightColor : leftColor;
  const tileColor =
    gridEye == null
      ? leftColor
      : colorForEye(palette, otherEye(gridEye));
  const onLightBg = boardBg === '#f4f4f4';

  const pad = 16;
  const boardSize = Math.min(width - pad * 2, height - pad * 2);
  const originX = (width - boardSize) / 2;
  const originY = (height - boardSize) / 2;
  const cell = boardSize / SIZE;
  const gap = 8;

  const fonts = useMemo(() => {
    const family = Platform.select({ ios: 'Helvetica', default: 'sans-serif' })!;
    const make = (scale: number) =>
      matchFont({
        fontFamily: family,
        fontSize: cell * scale,
        fontWeight: '800',
      });
    return {
      sm: make(0.55),
      md: make(0.7),
      lg: make(0.84),
    };
  }, [cell]);

  const startGame = useCallback((eye: EyeSide) => {
    setGridEye(eye);
    const seeded = seedBoard();
    setTiles(seeded);
    tilesRef.current = seeded;
    setScore(0);
    scoreRef.current = 0;
    startMs.current = Date.now();
    ended.current = false;
  }, []);

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
      if (!gridEye || paused || ended.current || busy) return;
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
    [busy, gridEye, onGameOver, paused],
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

  if (!gridEye) {
    const hintColor = onLightBg ? '#333' : '#b9cacb';
    const titleColor = onLightBg ? '#111' : '#dae2fd';
    return (
      <View style={[styles.fill, styles.chooser, { backgroundColor: boardBg }]}>
        <Text style={[styles.chooserTitle, { color: titleColor }]}>Choose grid colour</Text>
        <Text style={[styles.chooserSub, { color: hintColor }]}>
          Grid uses one eye channel. Number tiles use the other eye, on your optical background.
          Digits match the background so they stay transparent.
        </Text>
        <View style={styles.chooserRow}>
          <Pressable
            style={[styles.chooserBtn, { borderColor: leftColor, backgroundColor: boardBg }]}
            onPress={() => startGame('left')}
          >
            <View style={[styles.swatch, { backgroundColor: leftColor }]} />
            <Text style={[styles.chooserBtnText, { color: titleColor }]}>Left grid</Text>
            <Text style={[styles.chooserBtnHint, { color: hintColor }]}>Tiles → right eye</Text>
          </Pressable>
          <Pressable
            style={[styles.chooserBtn, { borderColor: rightColor, backgroundColor: boardBg }]}
            onPress={() => startGame('right')}
          >
            <View style={[styles.swatch, { backgroundColor: rightColor }]} />
            <Text style={[styles.chooserBtnText, { color: titleColor }]}>Right grid</Text>
            <Text style={[styles.chooserBtnHint, { color: hintColor }]}>Tiles → left eye</Text>
          </Pressable>
        </View>
        <Pressable style={styles.defaultHint} onPress={() => startGame(initialGridEye)}>
          <Text style={[styles.defaultHintText, { color: hintColor }]}>
            Use last setup ({initialGridEye === 'left' ? 'Left' : 'Right'} grid)
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.fill, { backgroundColor: boardBg }]}>
        <Canvas style={{ width, height }}>
          {/* Scene clear — optical profile background */}
          <RoundedRect x={0} y={0} width={width} height={height} r={0} color={boardBg} />
          {/* Grid = chosen eye colour; gaps show optical background */}
          <RoundedRect
            x={originX}
            y={originY}
            width={boardSize}
            height={boardSize}
            r={16}
            color={gridColor}
          />
          {/* Empty cells — optical background */}
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
                color={boardBg}
              />
            );
          })}
          {/* Number tiles — other eye colour; digits = background (transparent) */}
          {tiles.map((tile) => {
            const x = originX + tile.x * cell + gap / 2;
            const y = originY + tile.y * cell + gap / 2;
            const w = cell - gap;
            const label = String(tile.value);
            const font =
              label.length >= 4 ? fonts.sm : label.length === 3 ? fonts.md : fonts.lg;
            const fontSize = cell * (label.length >= 4 ? 0.55 : label.length === 3 ? 0.7 : 0.84);
            const textWidth = label.length * fontSize * 0.52;
            return (
              <Group key={tile.id}>
                <RoundedRect x={x} y={y} width={w} height={w} r={10} color={tileColor} />
                <SkText
                  x={x + w / 2 - textWidth / 2}
                  y={y + w / 2 + fontSize * 0.35}
                  text={label}
                  font={font}
                  color={boardBg}
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
  chooser: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 16,
  },
  chooserTitle: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  chooserSub: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 8,
  },
  chooserRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  chooserBtn: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
    gap: 8,
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  chooserBtnText: {
    fontWeight: '700',
    fontSize: 15,
  },
  chooserBtnHint: {
    fontWeight: '600',
    fontSize: 12,
  },
  defaultHint: {
    marginTop: 8,
    padding: 10,
  },
  defaultHintText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
