import { Canvas, Circle, Rect } from '@shopify/react-native-skia';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { colorForEye } from '@/src/anaglyph/palette';
import type { EyeSide } from '@/src/anaglyph/color';
import type { GameSceneProps } from '../types';

const COLS = 15;
const ROWS = 17;

/** Simple fixed maze: 1 = wall, 0 = path */
function buildMaze() {
  const grid = Array.from({ length: ROWS }, (_, r) =>
    Array.from({ length: COLS }, (_, c) => {
      if (r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1) return 1;
      if (r % 2 === 0 && c % 2 === 0) return 1;
      return 0;
    }),
  );
  // carve a few corridors
  for (let r = 2; r < ROWS - 2; r += 2) {
    for (let c = 1; c < COLS - 1; c += 1) grid[r]![c] = 0;
  }
  for (let c = 2; c < COLS - 2; c += 2) {
    for (let r = 1; r < ROWS - 1; r += 1) {
      if (Math.random() > 0.35) grid[r]![c] = 0;
    }
  }
  grid[1]![1] = 0;
  grid[ROWS - 2]![COLS - 2] = 0;
  return grid;
}

type Dir = { x: number; y: number };

export function MazeGame({
  width,
  height,
  palette,
  settings,
  paused,
  onScore,
  onGameOver,
}: GameSceneProps) {
  const maze = useMemo(() => buildMaze(), []);
  const cell = Math.min(width / COLS, (height - 20) / ROWS);
  const ox = (width - cell * COLS) / 2;
  const oy = (height - cell * ROWS) / 2;
  const speed = 4.2 * Number(settings.speed ?? 1);
  const wallEye = (settings.wallEye as EyeSide) || 'left';
  const actorEye = (settings.actorEye as EyeSide) || 'right';
  const wallColor = colorForEye(palette, wallEye);
  const actorColor = colorForEye(palette, actorEye);

  const dotsInit = useMemo(() => {
    const dots: { r: number; c: number }[] = [];
    maze.forEach((row, r) =>
      row.forEach((v, c) => {
        if (v === 0 && !(r === 1 && c === 1)) dots.push({ r, c });
      }),
    );
    return dots;
  }, [maze]);

  const [player, setPlayer] = useState({ r: 1, c: 1, x: 1, y: 1 });
  const [ghosts, setGhosts] = useState([
    { r: ROWS - 2, c: COLS - 2, x: COLS - 2, y: ROWS - 2 },
    { r: 1, c: COLS - 2, x: COLS - 2, y: 1 },
  ]);
  const [dots, setDots] = useState(dotsInit);
  const [score, setScore] = useState(0);
  const [cleared, setCleared] = useState(0);
  const [lives, setLives] = useState(Number(settings.lives ?? 3));
  const dir = useRef<Dir>({ x: 1, y: 0 });
  const nextDir = useRef<Dir>({ x: 1, y: 0 });
  const startMs = useRef(Date.now());
  const ended = useRef(false);

  useEffect(() => {
    onScore(score, cleared);
  }, [cleared, onScore, score]);

  useEffect(() => {
    if (paused || ended.current) return;
    let frame = 0;
    let acc = 0;
    let last = Date.now();
    const tick = () => {
      const now = Date.now();
      acc += (now - last) / 1000;
      last = now;
      const step = 1 / (speed * 2.2);
      while (acc >= step) {
        acc -= step;
        setPlayer((p) => {
          const tryDir = nextDir.current;
          const tr = Math.round(p.y);
          const tc = Math.round(p.x);
          const canTurn =
            maze[tr + tryDir.y]?.[tc + tryDir.x] === 0 &&
            Math.abs(p.x - tc) < 0.15 &&
            Math.abs(p.y - tr) < 0.15;
          if (canTurn) dir.current = tryDir;
          const d = dir.current;
          let nx = p.x + d.x * 0.2;
          let ny = p.y + d.y * 0.2;
          const nr = Math.round(ny);
          const nc = Math.round(nx);
          if (maze[nr]?.[nc] === 1) {
            nx = tc;
            ny = tr;
          }
          // collect dots
          setDots((prev) => {
            const remain = prev.filter((dot) => !(dot.r === nr && dot.c === nc));
            if (remain.length !== prev.length) {
              setScore((s) => s + 10);
            }
            if (remain.length === 0 && prev.length > 0) {
              setCleared((c) => c + 1);
              setScore((s) => s + 100);
              return dotsInit;
            }
            return remain;
          });
          return { r: nr, c: nc, x: nx, y: ny };
        });

        setGhosts((gs) =>
          gs.map((g, idx) => {
            const options: Dir[] = [
              { x: 1, y: 0 },
              { x: -1, y: 0 },
              { x: 0, y: 1 },
              { x: 0, y: -1 },
            ].filter((d) => maze[Math.round(g.y) + d.y]?.[Math.round(g.x) + d.x] === 0);
            const choice = options[Math.floor(Math.random() * options.length)] ?? { x: 0, y: 0 };
            const nx = g.x + choice.x * (0.15 + idx * 0.02);
            const ny = g.y + choice.y * (0.15 + idx * 0.02);
            return { ...g, x: nx, y: ny, r: Math.round(ny), c: Math.round(nx) };
          }),
        );
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [dotsInit, maze, paused, speed]);

  useEffect(() => {
    if (ended.current || paused) return;
    const hit = ghosts.some(
      (g) => Math.hypot(g.x - player.x, g.y - player.y) < 0.55,
    );
    if (!hit) return;
    const nextLives = lives - 1;
    setLives(nextLives);
    setPlayer({ r: 1, c: 1, x: 1, y: 1 });
    if (nextLives <= 0) {
      ended.current = true;
      onGameOver({
        score,
        bestMetric: cleared,
        durationSec: Math.round((Date.now() - startMs.current) / 1000),
      });
    }
  }, [cleared, ghosts, lives, onGameOver, paused, player.x, player.y, score]);

  const pan = Gesture.Pan()
    .runOnJS(true)
    .onEnd((e) => {
      if (Math.abs(e.translationX) > Math.abs(e.translationY)) {
        nextDir.current = { x: e.translationX > 0 ? 1 : -1, y: 0 };
      } else {
        nextDir.current = { x: 0, y: e.translationY > 0 ? 1 : -1 };
      }
    });

  return (
    <GestureDetector gesture={pan}>
      <View style={styles.fill}>
        <Canvas style={{ width, height }}>
          {maze.map((row, r) =>
            row.map((v, c) =>
              v === 1 ? (
                <Rect
                  key={`w-${r}-${c}`}
                  x={ox + c * cell}
                  y={oy + r * cell}
                  width={cell - 1}
                  height={cell - 1}
                  color={wallColor}
                />
              ) : null,
            ),
          )}
          {dots.map((d) => (
            <Circle
              key={`d-${d.r}-${d.c}`}
              cx={ox + d.c * cell + cell / 2}
              cy={oy + d.r * cell + cell / 2}
              r={Math.max(2, cell * 0.12)}
              color={actorColor}
            />
          ))}
          <Circle
            cx={ox + player.x * cell + cell / 2}
            cy={oy + player.y * cell + cell / 2}
            r={cell * 0.35}
            color={actorColor}
          />
          {ghosts.map((g, i) => (
            <Circle
              key={`g-${i}`}
              cx={ox + g.x * cell + cell / 2}
              cy={oy + g.y * cell + cell / 2}
              r={cell * 0.32}
              color={actorColor}
              opacity={0.7}
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
