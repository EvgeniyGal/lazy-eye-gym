import { Canvas, Circle, Rect, RoundedRect } from '@shopify/react-native-skia';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { withOpacity, type EyeSide } from '@/src/anaglyph/color';
import { colorForEye, solidForEye } from '@/src/anaglyph/palette';
import type { GameSceneProps } from '../types';

type Brick = {
  id: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
};

type Ball = { id: string; x: number; y: number; vx: number; vy: number };

type PowerKind = 'multi' | 'laser' | 'wide' | 'slow' | 'swap';

type PowerDrop = {
  id: string;
  kind: PowerKind;
  x: number;
  y: number;
};

type ActivePowers = {
  laserUntil: number;
  wideUntil: number;
  slowUntil: number;
  swapUntil: number;
};

const COLS = 8;
const BRICK_H = 18;
const POWER_KINDS: PowerKind[] = ['multi', 'laser', 'wide', 'slow', 'swap'];

function hpForRow(row: number, wave: number) {
  const base = Math.min(3, 1 + Math.floor((row + wave) / 2));
  return Math.max(1, Math.min(3, base));
}

function opacityForHp(hp: number, maxHp: number) {
  if (maxHp <= 1) return 1;
  return 0.4 + (hp / maxHp) * 0.6;
}

function buildBricks(width: number, rows: number, wave: number): Brick[] {
  const brickW = (width - 32) / COLS - 6;
  const list: Brick[] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const hp = hpForRow(r, wave);
      list.push({
        id: `b-${wave}-${r}-${c}`,
        x: 16 + c * (brickW + 6),
        y: 48 + r * (BRICK_H + 8),
        hp,
        maxHp: hp,
      });
    }
  }
  return list;
}

function makeBall(width: number, height: number, speed: number, id = 'ball-0'): Ball {
  return {
    id,
    x: width / 2,
    y: height * 0.62,
    vx: speed * 0.45 * (Math.random() > 0.5 ? 1 : -1),
    vy: -speed,
  };
}

let dropSeq = 0;

export function BreakerGame({
  width,
  height,
  palette,
  settings,
  paused,
  onScore,
  onGameOver,
}: GameSceneProps) {
  const baseRows = Number(settings.rows ?? 4);
  const basePaddleW = Math.min(130, width * 0.3) * Number(settings.paddleWidth ?? 1);
  const paddleH = 14;
  const ballR = 8;
  const baseSpeed = 260 * Number(settings.ballSpeed ?? 1);
  const startLives = Number(settings.lives ?? 3);
  const settingsPaddleEye = (settings.paddleEye as EyeSide) || 'left';
  const settingsBrickEye = (settings.brickEye as EyeSide) || 'right';

  const brickW = (width - 32) / COLS - 6;

  const [wave, setWave] = useState(1);
  const [lives, setLives] = useState(startLives);
  const [paddleX, setPaddleX] = useState(width / 2 - basePaddleW / 2);
  const [balls, setBalls] = useState<Ball[]>(() => [makeBall(width, height, baseSpeed)]);
  const [bricks, setBricks] = useState<Brick[]>(() => buildBricks(width, baseRows, 1));
  const [drops, setDrops] = useState<PowerDrop[]>([]);
  const [score, setScore] = useState(0);
  const [cleared, setCleared] = useState(0);
  const [powers, setPowers] = useState<ActivePowers>({
    laserUntil: 0,
    wideUntil: 0,
    slowUntil: 0,
    swapUntil: 0,
  });
  const [lasers, setLasers] = useState<{ id: string; x: number; y: number }[]>([]);

  const pointerX = useRef(width / 2);
  const startMs = useRef(Date.now());
  const ended = useRef(false);
  const ballsRef = useRef(balls);
  const bricksRef = useRef(bricks);
  const dropsRef = useRef(drops);
  const scoreRef = useRef(score);
  const clearedRef = useRef(cleared);
  const livesRef = useRef(lives);
  const waveRef = useRef(wave);
  const powersRef = useRef(powers);
  const lasersRef = useRef(lasers);
  const paddleXRef = useRef(paddleX);
  const laserCooldown = useRef(0);

  ballsRef.current = balls;
  bricksRef.current = bricks;
  dropsRef.current = drops;
  scoreRef.current = score;
  clearedRef.current = cleared;
  livesRef.current = lives;
  waveRef.current = wave;
  powersRef.current = powers;
  lasersRef.current = lasers;
  paddleXRef.current = paddleX;

  const nowMs = () => Date.now();
  const swapActive = nowMs() < powers.swapUntil;
  const paddleEye = swapActive ? settingsBrickEye : settingsPaddleEye;
  const brickEye = swapActive ? settingsPaddleEye : settingsBrickEye;
  const paddleColor = colorForEye(palette, paddleEye);
  const brickSolid = solidForEye(palette, brickEye);
  const brickBaseAlpha = brickEye === 'left' ? palette.leftAlpha : palette.rightAlpha;
  const brickColor = colorForEye(palette, brickEye);
  const wideActive = nowMs() < powers.wideUntil;
  const paddleW = basePaddleW * (wideActive ? 1.55 : 1);
  const boardBg = palette.background;

  useEffect(() => {
    onScore(score, cleared);
  }, [cleared, onScore, score]);

  useEffect(() => {
    if (paused || ended.current) return;
    let frame = 0;
    let last = Date.now();

    const finish = () => {
      ended.current = true;
      onGameOver({
        score: scoreRef.current,
        bestMetric: clearedRef.current,
        durationSec: Math.round((Date.now() - startMs.current) / 1000),
      });
    };

    const tick = () => {
      if (ended.current) return;
      const now = Date.now();
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;

      const p = powersRef.current;
      const isWide = now < p.wideUntil;
      const isSlow = now < p.slowUntil;
      const isLaser = now < p.laserUntil;
      const curPaddleW = basePaddleW * (isWide ? 1.55 : 1);
      const px = Math.max(0, Math.min(width - curPaddleW, pointerX.current - curPaddleW / 2));
      paddleXRef.current = px;
      setPaddleX(px);

      const py = height - 40 - paddleH;
      let nextScore = scoreRef.current;
      let nextCleared = clearedRef.current;
      let nextBricks = bricksRef.current;
      let nextDrops = [...dropsRef.current];
      let spawned: Ball[] = [];

      // Laser shots from paddle
      let nextLasers = lasersRef.current
        .map((l) => ({ ...l, y: l.y - 420 * dt }))
        .filter((l) => l.y > -20);

      if (isLaser) {
        laserCooldown.current -= dt;
        if (laserCooldown.current <= 0) {
          laserCooldown.current = 0.22;
          dropSeq += 1;
          nextLasers.push({ id: `lz-${dropSeq}`, x: px + curPaddleW / 2, y: py });
        }
      }

      const hitBrickAt = (bx: number, by: number, destroy: boolean) => {
        let hitIndex = -1;
        for (let i = 0; i < nextBricks.length; i += 1) {
          const brick = nextBricks[i]!;
          if (
            bx >= brick.x &&
            bx <= brick.x + brickW &&
            by >= brick.y &&
            by <= brick.y + BRICK_H
          ) {
            hitIndex = i;
            break;
          }
        }
        if (hitIndex < 0) return false;
        const brick = nextBricks[hitIndex]!;
        const hp = destroy ? 0 : brick.hp - 1;
        if (hp <= 0) {
          nextScore += 10 * brick.maxHp;
          nextCleared += 1;
          nextBricks = nextBricks.filter((_, i) => i !== hitIndex);
          if (Math.random() < 0.28) {
            dropSeq += 1;
            nextDrops.push({
              id: `d-${dropSeq}`,
              kind: POWER_KINDS[Math.floor(Math.random() * POWER_KINDS.length)]!,
              x: brick.x + brickW / 2,
              y: brick.y + BRICK_H / 2,
            });
          }
        } else {
          nextBricks = nextBricks.map((b, i) => (i === hitIndex ? { ...b, hp } : b));
          nextScore += 5;
        }
        return true;
      };

      nextLasers = nextLasers.filter((l) => {
        const hit = hitBrickAt(l.x, l.y, true);
        return !hit;
      });

      // Balls (slow power scales integration, not stored velocity)
      const moveScale = isSlow ? 0.55 : 1;
      const nextBalls: Ball[] = [];
      for (const ball of ballsRef.current) {
        let { x, y, vx, vy } = ball;
        x += vx * dt * moveScale;
        y += vy * dt * moveScale;

        if (x <= ballR || x >= width - ballR) vx *= -1;
        x = Math.max(ballR, Math.min(width - ballR, x));
        if (y <= ballR) vy = Math.abs(vy);

        if (y + ballR >= py && y < py + paddleH && x >= px && x <= px + curPaddleW && vy > 0) {
          vy = -Math.abs(vy);
          vx += (x - (px + curPaddleW / 2)) * 4;
        }

        if (hitBrickAt(x, y, false)) {
          vy *= -1;
        }

        if (y > height + 40) {
          continue; // ball lost
        }
        nextBalls.push({ ...ball, x, y, vx, vy });
      }

      // Power drops
      nextDrops = nextDrops
        .map((d) => ({ ...d, y: d.y + 140 * dt }))
        .filter((d) => {
          if (d.y > height + 20) return false;
          const caught =
            d.y >= py - 8 &&
            d.y <= py + paddleH + 8 &&
            d.x >= px &&
            d.x <= px + curPaddleW;
          if (!caught) return true;
          const until = now + 10000;
          const nextP = { ...powersRef.current };
          if (d.kind === 'multi') {
            const src = nextBalls[0] ?? makeBall(width, height, baseSpeed);
            dropSeq += 1;
            spawned.push({
              id: `ball-${dropSeq}`,
              x: src.x,
              y: src.y,
              vx: -src.vx * 0.9,
              vy: src.vy,
            });
            dropSeq += 1;
            spawned.push({
              id: `ball-${dropSeq}`,
              x: src.x,
              y: src.y,
              vx: src.vx * 0.85,
              vy: src.vy * 0.95,
            });
          } else if (d.kind === 'laser') nextP.laserUntil = until;
          else if (d.kind === 'wide') nextP.wideUntil = until;
          else if (d.kind === 'slow') nextP.slowUntil = until;
          else if (d.kind === 'swap') nextP.swapUntil = now + 8000;
          powersRef.current = nextP;
          setPowers(nextP);
          nextScore += 15;
          return false;
        });

      const allBalls = [...nextBalls, ...spawned];
      ballsRef.current = allBalls;
      bricksRef.current = nextBricks;
      dropsRef.current = nextDrops;
      lasersRef.current = nextLasers;
      scoreRef.current = nextScore;
      clearedRef.current = nextCleared;

      setBalls(allBalls);
      setBricks(nextBricks);
      setDrops(nextDrops);
      setLasers(nextLasers);
      setScore(nextScore);
      setCleared(nextCleared);

      // Wave clear
      if (nextBricks.length === 0) {
        const nextWave = waveRef.current + 1;
        waveRef.current = nextWave;
        setWave(nextWave);
        const rows = Math.min(7, baseRows + Math.floor((nextWave - 1) / 2));
        const rebuilt = buildBricks(width, rows, nextWave);
        bricksRef.current = rebuilt;
        setBricks(rebuilt);
        const fresh = [makeBall(width, height, baseSpeed * (1 + (nextWave - 1) * 0.06))];
        ballsRef.current = fresh;
        setBalls(fresh);
        nextScore += 100 * nextWave;
        scoreRef.current = nextScore;
        setScore(nextScore);
      }

      // Lost all balls
      if (allBalls.length === 0) {
        const left = livesRef.current - 1;
        livesRef.current = left;
        setLives(left);
        if (left <= 0) {
          finish();
          return;
        }
        const fresh = [makeBall(width, height, baseSpeed)];
        ballsRef.current = fresh;
        setBalls(fresh);
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [basePaddleW, baseRows, baseSpeed, brickW, height, onGameOver, paused, width]);

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
      <View style={[styles.fill, { backgroundColor: boardBg }]}>
        <Canvas style={{ width, height }}>
          <Rect x={0} y={0} width={width} height={height} color={boardBg} />
          <Rect x={0} y={0} width={4} height={height} color={paddleColor} opacity={0.5} />
          <Rect x={width - 4} y={0} width={4} height={height} color={paddleColor} opacity={0.5} />
          {bricks.map((b) => (
            <RoundedRect
              key={b.id}
              x={b.x}
              y={b.y}
              width={brickW}
              height={BRICK_H}
              r={4}
              color={withOpacity(brickSolid, brickBaseAlpha * opacityForHp(b.hp, b.maxHp))}
            />
          ))}
          {drops.map((d) => (
            <RoundedRect
              key={d.id}
              x={d.x - 10}
              y={d.y - 10}
              width={20}
              height={20}
              r={6}
              color={brickColor}
              opacity={0.85}
            />
          ))}
          {lasers.map((l) => (
            <Rect key={l.id} x={l.x - 2} y={l.y - 16} width={4} height={18} color={brickColor} />
          ))}
          <RoundedRect
            x={paddleX}
            y={height - 40 - paddleH}
            width={paddleW}
            height={paddleH}
            r={8}
            color={paddleColor}
          />
          {balls.map((b) => (
            <Circle key={b.id} cx={b.x} cy={b.y} r={ballR} color={brickColor} />
          ))}
          {/* Lives + wave markers on paddle eye */}
          {Array.from({ length: lives }).map((_, i) => (
            <Circle
              key={`life-${i}`}
              cx={16 + i * 14}
              cy={height - 14}
              r={5}
              color={paddleColor}
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
