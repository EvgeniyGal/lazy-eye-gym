import { Canvas, Circle, Rect } from '@shopify/react-native-skia';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { colorForEye } from '@/src/anaglyph/palette';
import type { EyeSide } from '@/src/anaglyph/color';
import type { GameSceneProps } from '../types';

type State = {
  playerX: number;
  aiX: number;
  ballX: number;
  ballY: number;
  vx: number;
  vy: number;
  score: number;
  rally: number;
  bestRally: number;
};

export function PongGame({
  width,
  height,
  palette,
  settings,
  paused,
  onScore,
  onGameOver,
}: GameSceneProps) {
  const paddleW = Math.min(140, width * 0.28) * Number(settings.paddleSize ?? 1);
  const paddleH = 14;
  const ballR = 9;
  const speed = 220 * Number(settings.speed ?? 1);
  const aiSpeed =
    settings.aiDifficulty === 'hard' ? 280 : settings.aiDifficulty === 'easy' ? 120 : 190;

  const paddleEye = (settings.paddleEye as EyeSide) || 'left';
  const ballEye = (settings.ballEye as EyeSide) || 'right';
  const paddleColor = colorForEye(palette, paddleEye);
  const ballColor = colorForEye(palette, ballEye);

  const [state, setState] = useState<State>(() => ({
    playerX: width / 2 - paddleW / 2,
    aiX: width / 2 - paddleW / 2,
    ballX: width / 2,
    ballY: height / 2,
    vx: speed * (Math.random() > 0.5 ? 1 : -1) * 0.55,
    vy: -speed,
    score: 0,
    rally: 0,
    bestRally: 0,
  }));

  const startMs = useRef(Date.now());
  const ended = useRef(false);
  const pointerX = useRef(width / 2);

  useEffect(() => {
    onScore(state.score, state.bestRally);
  }, [onScore, state.bestRally, state.score]);

  useEffect(() => {
    if (paused || ended.current) return;
    let frame = 0;
    let last = Date.now();
    const tick = () => {
      const now = Date.now();
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      setState((prev) => {
        let { playerX, aiX, ballX, ballY, vx, vy, score, rally, bestRally } = prev;
        playerX = Math.max(0, Math.min(width - paddleW, pointerX.current - paddleW / 2));

        const aiTarget = ballX - paddleW / 2;
        if (aiX < aiTarget) aiX = Math.min(aiTarget, aiX + aiSpeed * dt);
        if (aiX > aiTarget) aiX = Math.max(aiTarget, aiX - aiSpeed * dt);
        aiX = Math.max(0, Math.min(width - paddleW, aiX));

        ballX += vx * dt;
        ballY += vy * dt;

        if (ballX <= ballR || ballX >= width - ballR) vx *= -1;
        ballX = Math.max(ballR, Math.min(width - ballR, ballX));

        // AI paddle (top)
        if (ballY - ballR <= 28 + paddleH && ballY > 20 && ballX >= aiX && ballX <= aiX + paddleW && vy < 0) {
          vy = Math.abs(vy);
          vx += (ballX - (aiX + paddleW / 2)) * 3;
          rally += 1;
          bestRally = Math.max(bestRally, rally);
        }

        // Player paddle (bottom)
        if (
          ballY + ballR >= height - 36 - paddleH &&
          ballY < height - 20 &&
          ballX >= playerX &&
          ballX <= playerX + paddleW &&
          vy > 0
        ) {
          vy = -Math.abs(vy);
          vx += (ballX - (playerX + paddleW / 2)) * 3;
          score += 1;
          rally += 1;
          bestRally = Math.max(bestRally, rally);
        }

        if (ballY > height + 40) {
          ended.current = true;
          onGameOver({
            score,
            bestMetric: bestRally,
            durationSec: Math.round((Date.now() - startMs.current) / 1000),
          });
        }

        if (ballY < -40) {
          // AI missed — player scores, reset ball
          score += 3;
          rally = 0;
          ballX = width / 2;
          ballY = height / 2;
          vx = speed * (Math.random() > 0.5 ? 1 : -1) * 0.55;
          vy = speed;
        }

        return { playerX, aiX, ballX, ballY, vx, vy, score, rally, bestRally };
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [aiSpeed, height, onGameOver, paddleW, paused, speed, width]);

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
          <Rect x={0} y={height / 2 - 1} width={width} height={2} color={palette.neutral} opacity={0.2} />
          <Rect x={state.aiX} y={28} width={paddleW} height={paddleH} color={ballColor} />
          <Rect
            x={state.playerX}
            y={height - 36 - paddleH}
            width={paddleW}
            height={paddleH}
            color={paddleColor}
          />
          <Circle cx={state.ballX} cy={state.ballY} r={ballR} color={ballColor} />
        </Canvas>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
