import { Canvas, Rect, RoundedRect } from '@shopify/react-native-skia';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import type { EyeSide } from '@/src/anaglyph/color';
import { colorForEye } from '@/src/anaglyph/palette';
import type { GameSceneProps } from '../types';

type Point = { x: number; y: number };
type FoodKind = 'normal' | 'golden' | 'shrink';
type Food = Point & { kind: FoodKind };

function randomEmpty(grid: number, blocked: Point[]): Point {
  while (true) {
    const p = {
      x: Math.floor(Math.random() * grid),
      y: Math.floor(Math.random() * grid),
    };
    if (!blocked.some((s) => s.x === p.x && s.y === p.y)) return p;
  }
}

function spawnFood(grid: number, snake: Point[], obstacles: Point[]): Food {
  const p = randomEmpty(grid, [...snake, ...obstacles]);
  const roll = Math.random();
  const kind: FoodKind = roll < 0.15 ? 'golden' : roll < 0.3 ? 'shrink' : 'normal';
  return { ...p, kind };
}

export function SnakeGame({
  width,
  height,
  palette,
  settings,
  paused,
  onScore,
  onGameOver,
}: GameSceneProps) {
  const grid = Number(settings.gridSize ?? 16);
  const wrap = Boolean(settings.wrap);
  const baseTickMs = 180 / Number(settings.speed ?? 1);
  const gridEye = (settings.gridEye as EyeSide) || 'left';
  const snakeEye = (settings.snakeEye as EyeSide) || 'right';
  const gridColor = colorForEye(palette, gridEye);
  const snakeColor = colorForEye(palette, snakeEye);
  const boardBg = palette.background;

  const size = Math.min(width - 24, height - 24);
  const ox = (width - size) / 2;
  const oy = (height - size) / 2;
  const cell = size / grid;

  const [snake, setSnake] = useState<Point[]>([
    { x: 4, y: 8 },
    { x: 3, y: 8 },
    { x: 2, y: 8 },
  ]);
  const [food, setFood] = useState<Food>({ x: 10, y: 8, kind: 'normal' });
  const [obstacles, setObstacles] = useState<Point[]>([]);
  const [score, setScore] = useState(0);
  const [eaten, setEaten] = useState(0);
  const [combo, setCombo] = useState(1);
  const [speedPulseUntil, setSpeedPulseUntil] = useState(0);

  const dir = useRef<Point>({ x: 1, y: 0 });
  const nextDir = useRef<Point>({ x: 1, y: 0 });
  const startMs = useRef(Date.now());
  const ended = useRef(false);
  const comboUntil = useRef(0);
  const snakeRef = useRef(snake);
  const foodRef = useRef(food);
  const obstaclesRef = useRef(obstacles);
  const eatenRef = useRef(eaten);
  const scoreRef = useRef(score);
  const comboRef = useRef(combo);
  const pulseRef = useRef(speedPulseUntil);

  snakeRef.current = snake;
  foodRef.current = food;
  obstaclesRef.current = obstacles;
  eatenRef.current = eaten;
  scoreRef.current = score;
  comboRef.current = combo;
  pulseRef.current = speedPulseUntil;

  useEffect(() => {
    onScore(score, eaten);
  }, [eaten, onScore, score]);

  useEffect(() => {
    if (paused || ended.current) return;

    let timeout: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const schedule = () => {
      const pulse = Date.now() < pulseRef.current;
      const ms = pulse ? baseTickMs * 0.55 : baseTickMs;
      timeout = setTimeout(step, ms);
    };

    const step = () => {
      if (cancelled || ended.current) return;
      dir.current = nextDir.current;
      const prev = snakeRef.current;
      const head = prev[0]!;
      let nx = head.x + dir.current.x;
      let ny = head.y + dir.current.y;

      if (wrap) {
        nx = (nx + grid) % grid;
        ny = (ny + grid) % grid;
      } else if (nx < 0 || ny < 0 || nx >= grid || ny >= grid) {
        ended.current = true;
        onGameOver({
          score: scoreRef.current,
          bestMetric: eatenRef.current,
          durationSec: Math.round((Date.now() - startMs.current) / 1000),
        });
        return;
      }

      const obs = obstaclesRef.current;
      if (prev.some((p) => p.x === nx && p.y === ny) || obs.some((o) => o.x === nx && o.y === ny)) {
        ended.current = true;
        onGameOver({
          score: scoreRef.current,
          bestMetric: eatenRef.current,
          durationSec: Math.round((Date.now() - startMs.current) / 1000),
        });
        return;
      }

      let next = [{ x: nx, y: ny }, ...prev];
      const f = foodRef.current;
      const now = Date.now();

      if (nx === f.x && ny === f.y) {
        const nextEaten = eatenRef.current + 1;
        eatenRef.current = nextEaten;
        setEaten(nextEaten);

        let mult = comboRef.current;
        if (now < comboUntil.current) {
          mult = Math.min(5, mult + 1);
        } else {
          mult = 1;
        }
        comboUntil.current = now + 2500;
        comboRef.current = mult;
        setCombo(mult);

        let points = 10;
        if (f.kind === 'golden') {
          points = 30;
          pulseRef.current = now + 4000;
          setSpeedPulseUntil(pulseRef.current);
        } else if (f.kind === 'shrink') {
          points = 5;
          if (next.length > 4) {
            next = next.slice(0, Math.max(3, next.length - 2));
          }
        }

        const gained = points * mult;
        scoreRef.current += gained;
        setScore(scoreRef.current);

        // Obstacles every 5 foods
        let nextObs = obs;
        if (nextEaten % 5 === 0) {
          const block = randomEmpty(grid, [...next, f, ...obs]);
          nextObs = [...obs, block];
          obstaclesRef.current = nextObs;
          setObstacles(nextObs);
        }

        const nextFood = spawnFood(grid, next, nextObs);
        foodRef.current = nextFood;
        setFood(nextFood);
        snakeRef.current = next;
        setSnake(next);
      } else {
        next.pop();
        snakeRef.current = next;
        setSnake(next);
        if (now >= comboUntil.current && comboRef.current !== 1) {
          comboRef.current = 1;
          setCombo(1);
        }
      }

      schedule();
    };

    schedule();
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [baseTickMs, grid, onGameOver, paused, wrap]);

  const pan = Gesture.Pan()
    .runOnJS(true)
    .onEnd((e) => {
      const ax = Math.abs(e.translationX);
      const ay = Math.abs(e.translationY);
      if (Math.max(ax, ay) < 16) return;
      let d: Point;
      if (ax > ay) d = { x: e.translationX > 0 ? 1 : -1, y: 0 };
      else d = { x: 0, y: e.translationY > 0 ? 1 : -1 };
      if (d.x === -dir.current.x && d.y === -dir.current.y) return;
      nextDir.current = d;
    });

  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.fill, { backgroundColor: boardBg }]}>
        <Canvas style={{ width, height }}>
          <Rect x={0} y={0} width={width} height={height} color={boardBg} />
          <RoundedRect x={ox} y={oy} width={size} height={size} r={12} color={boardBg} />
          {Array.from({ length: grid }).map((_, i) => (
            <React.Fragment key={i}>
              <Rect
                x={ox + i * cell}
                y={oy}
                width={1}
                height={size}
                color={gridColor}
                opacity={0.45}
              />
              <Rect
                x={ox}
                y={oy + i * cell}
                width={size}
                height={1}
                color={gridColor}
                opacity={0.45}
              />
            </React.Fragment>
          ))}
          {obstacles.map((o, i) => (
            <RoundedRect
              key={`o-${o.x}-${o.y}-${i}`}
              x={ox + o.x * cell + 2}
              y={oy + o.y * cell + 2}
              width={cell - 4}
              height={cell - 4}
              r={3}
              color={snakeColor}
              opacity={0.35}
            />
          ))}
          {snake.map((s, i) => (
            <RoundedRect
              key={`${s.x}-${s.y}-${i}`}
              x={ox + s.x * cell + 1}
              y={oy + s.y * cell + 1}
              width={cell - 2}
              height={cell - 2}
              r={4}
              color={snakeColor}
              opacity={i === 0 ? 1 : 0.85}
            />
          ))}
          <RoundedRect
            x={ox + food.x * cell + (food.kind === 'golden' ? 1 : 2)}
            y={oy + food.y * cell + (food.kind === 'golden' ? 1 : 2)}
            width={cell - (food.kind === 'golden' ? 2 : 4)}
            height={cell - (food.kind === 'golden' ? 2 : 4)}
            r={food.kind === 'shrink' ? 10 : 6}
            color={snakeColor}
            opacity={food.kind === 'shrink' ? 0.55 : food.kind === 'golden' ? 1 : 0.9}
          />
          {/* Combo pips */}
          {Array.from({ length: combo }).map((_, i) => (
            <RoundedRect
              key={`c-${i}`}
              x={ox + 6 + i * 10}
              y={oy - 10}
              width={8}
              height={6}
              r={2}
              color={snakeColor}
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
