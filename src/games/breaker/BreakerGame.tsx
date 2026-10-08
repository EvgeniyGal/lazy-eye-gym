import { Canvas, Circle, Rect, RoundedRect } from '@shopify/react-native-skia';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { colorForEye } from '@/src/anaglyph/palette';
import type { EyeSide } from '@/src/anaglyph/color';
import type { GameSceneProps } from '../types';

type Brick = { x: number; y: number; alive: boolean };

export function BreakerGame({
  width,
  height,
  palette,
  settings,
  paused,
  onScore,
  onGameOver,
}: GameSceneProps) {
  const rows = Number(settings.rows ?? 4);
  const cols = 8;
  const paddleW = Math.min(130, width * 0.3) * Number(settings.paddleWidth ?? 1);
  const paddleH = 14;
  const ballR = 8;
  const speed = 260 * Number(settings.ballSpeed ?? 1);
  const paddleEye = (settings.paddleEye as EyeSide) || 'left';
  const brickEye = (settings.brickEye as EyeSide) || 'right';
  const paddleColor = colorForEye(palette, paddleEye);
  const brickColor = colorForEye(palette, brickEye);

  const brickW = (width - 32) / cols - 6;
  const brickH = 18;
  const bricksInit = useMemo(() => {
    const list: Brick[] = [];
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        list.push({
          x: 16 + c * (brickW + 6),
          y: 40 + r * (brickH + 8),
          alive: true,
        });
      }
    }
    return list;
  }, [brickW, rows]);

  const [paddleX, setPaddleX] = useState(width / 2 - paddleW / 2);
  const [ball, setBall] = useState({ x: width / 2, y: height * 0.6, vx: speed * 0.45, vy: -speed });
  const [bricks, setBricks] = useState(bricksInit);
  const [score, setScore] = useState(0);
  const [cleared, setCleared] = useState(0);
  const pointerX = useRef(width / 2);
  const startMs = useRef(Date.now());
  const ended = useRef(false);

  useEffect(() => {
    onScore(score, cleared);
  }, [cleared, onScore, score]);

  useEffect(() => {
    if (paused || ended.current) return;
    let frame = 0;
    let last = Date.now();
    const tick = () => {
      const now = Date.now();
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;

      setPaddleX(Math.max(0, Math.min(width - paddleW, pointerX.current - paddleW / 2)));

      setBall((b) => {
        let { x, y, vx, vy } = b;
        x += vx * dt;
        y += vy * dt;
        if (x <= ballR || x >= width - ballR) vx *= -1;
        if (y <= ballR) vy = Math.abs(vy);

        const py = height - 40 - paddleH;
        if (y + ballR >= py && y < py + paddleH && x >= paddleX && x <= paddleX + paddleW && vy > 0) {
          vy = -Math.abs(vy);
          vx += (x - (paddleX + paddleW / 2)) * 4;
        }

        setBricks((prev) => {
          let hit = false;
          const next = prev.map((brick) => {
            if (!brick.alive || hit) return brick;
            if (
              x >= brick.x &&
              x <= brick.x + brickW &&
              y >= brick.y &&
              y <= brick.y + brickH
            ) {
              hit = true;
              setScore((s) => s + 20);
              setCleared((c) => c + 1);
              return { ...brick, alive: false };
            }
            return brick;
          });
          if (hit) vy *= -1;
          if (next.every((br) => !br.alive)) {
            ended.current = true;
            onGameOver({
              score: score + 20,
              bestMetric: cleared + 1,
              durationSec: Math.round((Date.now() - startMs.current) / 1000),
            });
          }
          return next;
        });

        if (y > height + 30) {
          ended.current = true;
          onGameOver({
            score,
            bestMetric: cleared,
            durationSec: Math.round((Date.now() - startMs.current) / 1000),
          });
        }

        return { x, y, vx, vy };
      });

      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [brickW, cleared, height, onGameOver, paddleW, paddleX, paused, score, width]);

  const pan = Gesture.Pan()
    .runOnJS(true)
    .onBegin((e) => {
      pointerX.current = e.x;
    })
    .onChange((e) => {
      pointerX.current = e.x;
    });

  return (
    <GestureDetector gesture={pan}>
      <View style={styles.fill}>
        <Canvas style={{ width, height }}>
          <Rect x={0} y={0} width={4} height={height} color={paddleColor} opacity={0.5} />
          <Rect x={width - 4} y={0} width={4} height={height} color={paddleColor} opacity={0.5} />
          {bricks.map((b, i) =>
            b.alive ? (
              <RoundedRect
                key={i}
                x={b.x}
                y={b.y}
                width={brickW}
                height={brickH}
                r={4}
                color={brickColor}
              />
            ) : null,
          )}
          <RoundedRect
            x={paddleX}
            y={height - 40 - paddleH}
            width={paddleW}
            height={paddleH}
            r={8}
            color={paddleColor}
          />
          <Circle cx={ball.x} cy={ball.y} r={ballR} color={brickColor} />
        </Canvas>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
