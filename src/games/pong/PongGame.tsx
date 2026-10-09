import { Canvas, Circle, Rect } from '@shopify/react-native-skia';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import type { EyeSide } from '@/src/anaglyph/color';
import { colorForEye } from '@/src/anaglyph/palette';
import type { GameSceneProps } from '../types';

type OrbKind = 'wide' | 'shrinkAi' | 'slow';

type Orb = {
  id: string;
  kind: OrbKind;
  x: number;
  y: number;
  vy: number;
};

type State = {
  playerX: number;
  aiX: number;
  ballX: number;
  ballY: number;
  vx: number;
  vy: number;
  playerScore: number;
  aiScore: number;
  rally: number;
  bestRally: number;
  serveToPlayer: boolean;
};

let orbSeq = 0;

const LEVELS = {
  easy: {
    speed: 0.75,
    paddleSize: 1.35,
    pointsToWin: 5,
    aiLead: 0.22,
    aiError: 52,
    aiSpeed: 130,
  },
  hard: {
    speed: 1.15,
    paddleSize: 1.0,
    pointsToWin: 7,
    aiLead: 0.6,
    aiError: 18,
    aiSpeed: 230,
  },
  extraHard: {
    speed: 1.5,
    paddleSize: 0.78,
    pointsToWin: 9,
    aiLead: 0.9,
    aiError: 6,
    aiSpeed: 340,
  },
} as const;

type LevelKey = keyof typeof LEVELS;

function resolveLevel(settings: Record<string, string | number | boolean>): LevelKey {
  const raw = String(settings.difficulty ?? 'easy');
  if (raw === 'hard' || raw === 'extraHard') return raw;
  return 'easy';
}

export function PongGame({
  width,
  height,
  palette,
  settings,
  paused,
  onScore,
  onGameOver,
}: GameSceneProps) {
  const level = LEVELS[resolveLevel(settings)];
  const basePaddleW = Math.min(140, width * 0.28) * level.paddleSize;
  const paddleH = 14;
  const ballR = 9;
  const baseSpeed = 220 * level.speed;
  const pointsToWin = level.pointsToWin;
  const aiLead = level.aiLead;
  const aiError = level.aiError;
  const aiSpeed = level.aiSpeed;

  const paddleEye = (settings.paddleEye as EyeSide) || 'left';
  const ballEye = (settings.ballEye as EyeSide) || 'right';
  const paddleColor = colorForEye(palette, paddleEye);
  const ballColor = colorForEye(palette, ballEye);
  const boardBg = palette.background;
  const neutral = palette.neutral;

  const [state, setState] = useState<State>(() => ({
    playerX: width / 2 - basePaddleW / 2,
    aiX: width / 2 - basePaddleW / 2,
    ballX: width / 2,
    ballY: height / 2,
    vx: baseSpeed * (Math.random() > 0.5 ? 1 : -1) * 0.55,
    vy: -baseSpeed,
    playerScore: 0,
    aiScore: 0,
    rally: 0,
    bestRally: 0,
    serveToPlayer: true,
  }));
  const [orbs, setOrbs] = useState<Orb[]>([]);
  const [wideUntil, setWideUntil] = useState(0);
  const [shrinkAiUntil, setShrinkAiUntil] = useState(0);
  const [slowUntil, setSlowUntil] = useState(0);

  const startMs = useRef(Date.now());
  const ended = useRef(false);
  const pointerX = useRef(width / 2);
  const stateRef = useRef(state);
  const orbsRef = useRef(orbs);
  const wideRef = useRef(wideUntil);
  const shrinkRef = useRef(shrinkAiUntil);
  const slowRef = useRef(slowUntil);
  const orbTimer = useRef(0);
  stateRef.current = state;
  orbsRef.current = orbs;
  wideRef.current = wideUntil;
  shrinkRef.current = shrinkAiUntil;
  slowRef.current = slowUntil;

  useEffect(() => {
    onScore(state.playerScore, state.bestRally);
  }, [onScore, state.bestRally, state.playerScore]);

  useEffect(() => {
    if (paused || ended.current) return;
    let frame = 0;
    let last = Date.now();

    const resetBall = (toPlayer: boolean, s: State): State => {
      const speed = baseSpeed;
      return {
        ...s,
        ballX: width / 2,
        ballY: height / 2,
        vx: speed * (Math.random() > 0.5 ? 1 : -1) * 0.55,
        vy: toPlayer ? speed : -speed,
        rally: 0,
        serveToPlayer: toPlayer,
      };
    };

    const tick = () => {
      if (ended.current) return;
      const now = Date.now();
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;

      const isWide = now < wideRef.current;
      const isShrinkAi = now < shrinkRef.current;
      const isSlow = now < slowRef.current;
      const playerW = basePaddleW * (isWide ? 1.45 : 1);
      const aiW = basePaddleW * (isShrinkAi ? 0.65 : 1);
      const moveScale = isSlow ? 0.6 : 1;

      let s = { ...stateRef.current };
      s.playerX = Math.max(0, Math.min(width - playerW, pointerX.current - playerW / 2));

      // Predictive AI with error
      const predictX = s.ballX + s.vx * aiLead * (height / Math.max(80, Math.abs(s.vy)));
      const aiTarget = predictX - aiW / 2 + (Math.random() - 0.5) * aiError;
      if (s.aiX < aiTarget) s.aiX = Math.min(aiTarget, s.aiX + aiSpeed * dt);
      if (s.aiX > aiTarget) s.aiX = Math.max(aiTarget, s.aiX - aiSpeed * dt);
      s.aiX = Math.max(0, Math.min(width - aiW, s.aiX));

      const rallyBoost = 1 + Math.min(0.75, s.rally * 0.04);
      s.ballX += s.vx * dt * moveScale * rallyBoost;
      s.ballY += s.vy * dt * moveScale * rallyBoost;

      if (s.ballX <= ballR || s.ballX >= width - ballR) s.vx *= -1;
      s.ballX = Math.max(ballR, Math.min(width - ballR, s.ballX));

      // AI paddle (top)
      if (
        s.ballY - ballR <= 28 + paddleH &&
        s.ballY > 20 &&
        s.ballX >= s.aiX &&
        s.ballX <= s.aiX + aiW &&
        s.vy < 0
      ) {
        s.vy = Math.abs(s.vy);
        s.vx += (s.ballX - (s.aiX + aiW / 2)) * 3;
        s.rally += 1;
        s.bestRally = Math.max(s.bestRally, s.rally);
      }

      // Player paddle (bottom)
      if (
        s.ballY + ballR >= height - 36 - paddleH &&
        s.ballY < height - 20 &&
        s.ballX >= s.playerX &&
        s.ballX <= s.playerX + playerW &&
        s.vy > 0
      ) {
        s.vy = -Math.abs(s.vy);
        s.vx += (s.ballX - (s.playerX + playerW / 2)) * 3;
        s.rally += 1;
        s.bestRally = Math.max(s.bestRally, s.rally);
      }

      // Scoring
      if (s.ballY > height + 40) {
        s.aiScore += 1;
        if (s.aiScore >= pointsToWin) {
          stateRef.current = s;
          setState(s);
          ended.current = true;
          onGameOver({
            score: s.playerScore,
            bestMetric: s.bestRally,
            durationSec: Math.round((Date.now() - startMs.current) / 1000),
          });
          return;
        }
        s = resetBall(true, s);
      } else if (s.ballY < -40) {
        s.playerScore += 1;
        if (s.playerScore >= pointsToWin) {
          stateRef.current = s;
          setState(s);
          ended.current = true;
          onGameOver({
            score: s.playerScore,
            bestMetric: s.bestRally,
            durationSec: Math.round((Date.now() - startMs.current) / 1000),
          });
          return;
        }
        s = resetBall(false, s);
      }

      // Orbs
      orbTimer.current += dt;
      let nextOrbs = orbsRef.current.map((o) => ({ ...o, y: o.y + o.vy * dt }));
      if (orbTimer.current > 7) {
        orbTimer.current = 0;
        orbSeq += 1;
        const kinds: OrbKind[] = ['wide', 'shrinkAi', 'slow'];
        nextOrbs.push({
          id: `orb-${orbSeq}`,
          kind: kinds[Math.floor(Math.random() * kinds.length)]!,
          x: 40 + Math.random() * (width - 80),
          y: height * 0.35,
          vy: 70 + Math.random() * 40,
        });
      }
      nextOrbs = nextOrbs.filter((o) => {
        if (o.y > height + 20) return false;
        const hitBall = Math.hypot(o.x - s.ballX, o.y - s.ballY) < ballR + 12;
        const hitPaddle =
          o.y >= height - 36 - paddleH - 8 &&
          o.y <= height - 20 &&
          o.x >= s.playerX &&
          o.x <= s.playerX + playerW;
        if (!hitBall && !hitPaddle) return true;
        if (o.kind === 'wide') {
          wideRef.current = now + 8000;
          setWideUntil(wideRef.current);
        } else if (o.kind === 'shrinkAi') {
          shrinkRef.current = now + 8000;
          setShrinkAiUntil(shrinkRef.current);
        } else {
          slowRef.current = now + 6000;
          setSlowUntil(slowRef.current);
        }
        return false;
      });
      orbsRef.current = nextOrbs;
      setOrbs(nextOrbs);

      stateRef.current = s;
      setState(s);
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [
    aiError,
    aiLead,
    aiSpeed,
    basePaddleW,
    baseSpeed,
    height,
    onGameOver,
    paused,
    pointsToWin,
    width,
  ]);

  const pan = Gesture.Pan()
    .runOnJS(true)
    .onBegin((e) => {
      pointerX.current = e.x;
    })
    .onChange((e) => {
      pointerX.current = e.x;
    });

  const now = Date.now();
  const playerW = basePaddleW * (now < wideUntil ? 1.45 : 1);
  const aiW = basePaddleW * (now < shrinkAiUntil ? 0.65 : 1);

  // Simple score pips via circles
  const pip = (n: number, y: number, color: string) =>
    Array.from({ length: Math.min(n, pointsToWin) }).map((_, i) => (
      <Circle key={`${y}-${i}`} cx={18 + i * 12} cy={y} r={4} color={color} />
    ));

  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.fill, { backgroundColor: boardBg }]}>
        <Canvas style={{ width, height, backgroundColor: boardBg }}>
          <Rect x={0} y={0} width={width} height={height} color={boardBg} />
          <Rect x={0} y={height / 2 - 1} width={width} height={2} color={neutral} opacity={0.25} />
          {pip(state.aiScore, 16, ballColor)}
          {pip(state.playerScore, height - 16, paddleColor)}
          {orbs.map((o) => (
            <Circle key={o.id} cx={o.x} cy={o.y} r={11} color={ballColor} opacity={0.75} />
          ))}
          <Rect x={state.aiX} y={28} width={aiW} height={paddleH} color={ballColor} />
          <Rect
            x={state.playerX}
            y={height - 36 - paddleH}
            width={playerW}
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
