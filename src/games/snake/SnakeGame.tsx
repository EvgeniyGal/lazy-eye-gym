import { Canvas, Rect, RoundedRect } from '@shopify/react-native-skia';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { colorForEye } from '@/src/anaglyph/palette';
import type { EyeSide } from '@/src/anaglyph/color';
import type { GameSceneProps } from '../types';

type Point = { x: number; y: number };

function randomFood(grid: number, snake: Point[]): Point {
  while (true) {
    const p = {
      x: Math.floor(Math.random() * grid),
      y: Math.floor(Math.random() * grid),
    };
    if (!snake.some((s) => s.x === p.x && s.y === p.y)) return p;
  }
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
  const tickMs = 180 / Number(settings.speed ?? 1);
  const gridEye = (settings.gridEye as EyeSide) || 'left';
  const snakeEye = (settings.snakeEye as EyeSide) || 'right';
  const gridColor = colorForEye(palette, gridEye);
  const snakeColor = colorForEye(palette, snakeEye);

  const size = Math.min(width - 24, height - 24);
  const ox = (width - size) / 2;
  const oy = (height - size) / 2;
  const cell = size / grid;

  const [snake, setSnake] = useState<Point[]>([
    { x: 4, y: 8 },
    { x: 3, y: 8 },
    { x: 2, y: 8 },
  ]);
  const [food, setFood] = useState<Point>({ x: 10, y: 8 });
  const [score, setScore] = useState(0);
  const [eaten, setEaten] = useState(0);
  const dir = useRef<Point>({ x: 1, y: 0 });
  const nextDir = useRef<Point>({ x: 1, y: 0 });
  const startMs = useRef(Date.now());
  const ended = useRef(false);
  const snakeRef = useRef(snake);
  const foodRef = useRef(food);
  const eatenRef = useRef(eaten);
  snakeRef.current = snake;
  foodRef.current = food;
  eatenRef.current = eaten;

  useEffect(() => {
    onScore(snake.length, eaten);
  }, [eaten, onScore, snake.length]);

  useEffect(() => {
    if (paused || ended.current) return;
    const id = setInterval(() => {
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
          score: prev.length,
          bestMetric: eatenRef.current,
          durationSec: Math.round((Date.now() - startMs.current) / 1000),
        });
        return;
      }
      if (prev.some((p) => p.x === nx && p.y === ny)) {
        ended.current = true;
        onGameOver({
          score: prev.length,
          bestMetric: eatenRef.current,
          durationSec: Math.round((Date.now() - startMs.current) / 1000),
        });
        return;
      }
      const next = [{ x: nx, y: ny }, ...prev];
      const food = foodRef.current;
      if (nx === food.x && ny === food.y) {
        const nextFood = randomFood(grid, next);
        const nextEaten = eatenRef.current + 1;
        eatenRef.current = nextEaten;
        foodRef.current = nextFood;
        snakeRef.current = next;
        setEaten(nextEaten);
        setFood(nextFood);
        setSnake(next);
        setScore(next.length);
        return;
      }
      next.pop();
      snakeRef.current = next;
      setSnake(next);
      setScore(next.length);
    }, tickMs);
    return () => clearInterval(id);
  }, [grid, onGameOver, paused, tickMs, wrap]);

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

  const boardBg = palette.background;

  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.fill, { backgroundColor: boardBg }]}>
        <Canvas style={{ width, height }}>
          <Rect x={0} y={0} width={width} height={height} color={boardBg} />
          <RoundedRect
            x={ox}
            y={oy}
            width={size}
            height={size}
            r={12}
            color={boardBg}
          />
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
            x={ox + food.x * cell + 2}
            y={oy + food.y * cell + 2}
            width={cell - 4}
            height={cell - 4}
            r={6}
            color={snakeColor}
          />
        </Canvas>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
