import { Canvas, Circle, Group, Path, Rect, RoundedRect, Skia } from '@shopify/react-native-skia';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { withOpacity, type EyeSide } from '@/src/anaglyph/color';
import { colorForEye, solidForEye } from '@/src/anaglyph/palette';
import type { GameSceneProps } from '../types';

type MaxHp = 1 | 2 | 3 | 4;

type Brick = {
  id: string;
  x: number;
  y: number;
  hp: number;
  maxHp: MaxHp;
  eye: EyeSide;
};

type Ball = { id: string; x: number; y: number; vx: number; vy: number };

type PowerKind = 'multi' | 'laser' | 'wide' | 'slow' | 'swap';

type PowerDrop = {
  id: string;
  kind: PowerKind;
  eye: EyeSide;
  x: number;
  y: number;
};

type ActivePowers = {
  laserUntil: number;
  wideUntil: number;
  slowUntil: number;
};

const COLS = 8;
const BRICK_H = 18;
const ORB_R = 15;
const TOTAL_STAGES = 15;
const POWER_KINDS: PowerKind[] = ['multi', 'laser', 'wide', 'slow', 'swap'];

const LEVELS = {
  easy: { speed: 0.75, paddleSize: 1.35, lives: 5, hpCap: 2 as MaxHp },
  hard: { speed: 1.1, paddleSize: 1.0, lives: 3, hpCap: 3 as MaxHp },
  extraHard: { speed: 1.45, paddleSize: 0.78, lives: 2, hpCap: 4 as MaxHp },
} as const;

type LevelKey = keyof typeof LEVELS;

function resolveLevel(settings: Record<string, string | number | boolean>): LevelKey {
  const raw = String(settings.difficulty ?? 'easy');
  if (raw === 'hard' || raw === 'extraHard') return raw;
  return 'easy';
}

/**
 * Stage layouts: grid of HP values (0 = empty). Rows vary by stage.
 * Difficulty clamps each cell to hpCap.
 */
const STAGE_GRIDS: number[][][] = [
  // 1 — sparse HP1
  [
    [1, 0, 1, 0, 1, 0, 1, 0],
    [0, 1, 0, 1, 0, 1, 0, 1],
    [1, 0, 1, 0, 1, 0, 1, 0],
  ],
  // 2
  [
    [1, 1, 1, 1, 1, 1, 1, 1],
    [0, 1, 0, 1, 0, 1, 0, 1],
    [1, 0, 1, 0, 1, 0, 1, 0],
  ],
  // 3
  [
    [1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1],
    [0, 1, 1, 1, 1, 1, 1, 0],
  ],
  // 4 — HP2 appears
  [
    [2, 1, 2, 1, 2, 1, 2, 1],
    [1, 2, 1, 2, 1, 2, 1, 2],
    [1, 1, 1, 1, 1, 1, 1, 1],
    [0, 1, 0, 1, 0, 1, 0, 1],
  ],
  // 5 pyramid
  [
    [0, 0, 0, 2, 2, 0, 0, 0],
    [0, 0, 1, 2, 2, 1, 0, 0],
    [0, 1, 1, 2, 2, 1, 1, 0],
    [1, 1, 1, 1, 1, 1, 1, 1],
  ],
  // 6
  [
    [2, 2, 1, 1, 1, 1, 2, 2],
    [2, 1, 1, 1, 1, 1, 1, 2],
    [1, 1, 0, 1, 1, 0, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1],
  ],
  // 7
  [
    [2, 2, 2, 2, 2, 2, 2, 2],
    [1, 0, 1, 0, 1, 0, 1, 0],
    [2, 1, 2, 1, 2, 1, 2, 1],
    [1, 1, 1, 1, 1, 1, 1, 1],
  ],
  // 8 — HP3
  [
    [3, 2, 3, 2, 3, 2, 3, 2],
    [2, 1, 2, 1, 2, 1, 2, 1],
    [1, 1, 1, 1, 1, 1, 1, 1],
    [0, 2, 0, 2, 0, 2, 0, 2],
    [1, 0, 1, 0, 1, 0, 1, 0],
  ],
  // 9 pillars
  [
    [3, 0, 2, 0, 2, 0, 3, 0],
    [3, 0, 2, 0, 2, 0, 3, 0],
    [3, 1, 2, 1, 2, 1, 3, 1],
    [2, 1, 1, 1, 1, 1, 2, 1],
    [1, 1, 1, 1, 1, 1, 1, 1],
  ],
  // 10
  [
    [3, 3, 2, 2, 2, 2, 3, 3],
    [3, 2, 1, 1, 1, 1, 2, 3],
    [2, 1, 0, 1, 1, 0, 1, 2],
    [2, 1, 1, 1, 1, 1, 1, 2],
    [1, 1, 1, 1, 1, 1, 1, 1],
  ],
  // 11
  [
    [3, 3, 3, 3, 3, 3, 3, 3],
    [2, 0, 2, 0, 2, 0, 2, 0],
    [3, 2, 3, 2, 3, 2, 3, 2],
    [1, 1, 1, 1, 1, 1, 1, 1],
    [2, 1, 2, 1, 2, 1, 2, 1],
  ],
  // 12 — HP4 anchors
  [
    [4, 2, 3, 2, 2, 3, 2, 4],
    [3, 2, 1, 1, 1, 1, 2, 3],
    [2, 1, 0, 2, 2, 0, 1, 2],
    [3, 2, 1, 1, 1, 1, 2, 3],
    [2, 2, 2, 2, 2, 2, 2, 2],
    [1, 1, 1, 1, 1, 1, 1, 1],
  ],
  // 13
  [
    [4, 3, 4, 3, 3, 4, 3, 4],
    [3, 0, 2, 0, 0, 2, 0, 3],
    [4, 2, 1, 2, 2, 1, 2, 4],
    [2, 1, 1, 1, 1, 1, 1, 2],
    [3, 2, 2, 2, 2, 2, 2, 3],
    [1, 1, 0, 1, 1, 0, 1, 1],
  ],
  // 14
  [
    [4, 4, 3, 3, 3, 3, 4, 4],
    [4, 3, 2, 2, 2, 2, 3, 4],
    [3, 2, 0, 1, 1, 0, 2, 3],
    [3, 2, 1, 4, 4, 1, 2, 3],
    [2, 1, 1, 1, 1, 1, 1, 2],
    [2, 2, 2, 2, 2, 2, 2, 2],
  ],
  // 15 finale
  [
    [4, 4, 4, 4, 4, 4, 4, 4],
    [4, 3, 2, 3, 3, 2, 3, 4],
    [3, 2, 0, 2, 2, 0, 2, 3],
    [4, 2, 1, 4, 4, 1, 2, 4],
    [3, 2, 1, 1, 1, 1, 2, 3],
    [2, 1, 1, 1, 1, 1, 1, 2],
    [1, 1, 1, 1, 1, 1, 1, 1],
  ],
];

function clampHp(v: number, cap: MaxHp): MaxHp {
  const n = Math.max(1, Math.min(cap, Math.min(4, v))) as MaxHp;
  return n;
}

function fillOpacity(hp: number, maxHp: MaxHp) {
  // Remaining HP readable; maxHp 4 starts fully solid
  if (maxHp === 4 && hp === maxHp) return 1;
  const base = maxHp === 1 ? 0.55 : maxHp === 2 ? 0.65 : maxHp === 3 ? 0.8 : 1;
  return Math.max(0.35, base * (hp / maxHp));
}

function borderWidth(maxHp: MaxHp) {
  if (maxHp === 1) return 1;
  if (maxHp === 2) return 1.5;
  if (maxHp === 3) return 2.5;
  return 3.5;
}

function buildStageBricks(width: number, stageIndex: number, hpCap: MaxHp): Brick[] {
  const grid = STAGE_GRIDS[Math.min(STAGE_GRIDS.length - 1, stageIndex)]!;
  const brickW = (width - 32) / COLS - 6;
  const list: Brick[] = [];
  for (let r = 0; r < grid.length; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const raw = grid[r]![c] ?? 0;
      if (raw <= 0) continue;
      const maxHp = clampHp(raw, hpCap);
      list.push({
        id: `b-${stageIndex}-${r}-${c}`,
        x: 16 + c * (brickW + 6),
        y: 40 + r * (BRICK_H + 8),
        hp: maxHp,
        maxHp,
        eye: (r + c) % 2 === 0 ? 'left' : 'right',
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

/**
 * Circle vs AABB: true if ball disc overlaps the brick (not a zero-size point).
 * Returns which axis to bounce and how far to push the center out.
 */
function resolveBallBrick(
  cx: number,
  cy: number,
  r: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): { bounceX: boolean; bounceY: boolean; nx: number; ny: number } | null {
  const nearestX = Math.max(bx, Math.min(cx, bx + bw));
  const nearestY = Math.max(by, Math.min(cy, by + bh));
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  const distSq = dx * dx + dy * dy;
  if (distSq > r * r) return null;

  // Overlap depths on each side (how far the circle extends past the edge)
  const overlapL = cx + r - bx;
  const overlapR = bx + bw - (cx - r);
  const overlapT = cy + r - by;
  const overlapB = by + bh - (cy - r);
  const minX = Math.min(overlapL, overlapR);
  const minY = Math.min(overlapT, overlapB);

  if (minX < minY) {
    // Horizontal face — bounce X, push out of left/right
    const fromLeft = overlapL < overlapR;
    return {
      bounceX: true,
      bounceY: false,
      nx: fromLeft ? bx - r : bx + bw + r,
      ny: cy,
    };
  }
  // Vertical face — bounce Y
  const fromTop = overlapT < overlapB;
  return {
    bounceX: false,
    bounceY: true,
    nx: cx,
    ny: fromTop ? by - r : by + bh + r,
  };
}

/** Cutout icons — each sign matches the power’s effect. */
function PowerIcon({
  kind,
  cx,
  cy,
  cut,
}: {
  kind: PowerKind;
  cx: number;
  cy: number;
  cut: string;
}) {
  if (kind === 'wide') {
    // Wider paddle: horizontal bar with end caps
    return (
      <Group>
        <RoundedRect x={cx - 10} y={cy - 2} width={20} height={4} r={2} color={cut} />
        <RoundedRect x={cx - 10} y={cy - 6} width={3.5} height={12} r={1.5} color={cut} />
        <RoundedRect x={cx + 6.5} y={cy - 6} width={3.5} height={12} r={1.5} color={cut} />
      </Group>
    );
  }
  if (kind === 'slow') {
    // Slow: downward chevrons (not a minus — that reads as shrink)
    const top = Skia.PathBuilder.Make()
      .moveTo(cx - 8, cy - 6)
      .lineTo(cx, cy - 1)
      .lineTo(cx + 8, cy - 6)
      .lineTo(cx + 5, cy - 6)
      .lineTo(cx, cy - 3)
      .lineTo(cx - 5, cy - 6)
      .close()
      .detach();
    const bot = Skia.PathBuilder.Make()
      .moveTo(cx - 8, cy + 1)
      .lineTo(cx, cy + 6)
      .lineTo(cx + 8, cy + 1)
      .lineTo(cx + 5, cy + 1)
      .lineTo(cx, cy + 4)
      .lineTo(cx - 5, cy + 1)
      .close()
      .detach();
    return (
      <Group>
        <Path path={top} color={cut} />
        <Path path={bot} color={cut} />
      </Group>
    );
  }
  if (kind === 'multi') {
    // Extra balls: three discs
    return (
      <Group>
        <Circle cx={cx - 6} cy={cy + 1} r={3.4} color={cut} />
        <Circle cx={cx + 6} cy={cy + 1} r={3.4} color={cut} />
        <Circle cx={cx} cy={cy - 5} r={3.4} color={cut} />
      </Group>
    );
  }
  if (kind === 'laser') {
    // Upward laser beams (not a bolt — bolt reads as speed)
    return (
      <Group>
        <RoundedRect x={cx - 5.5} y={cy - 9} width={3.5} height={18} r={1.5} color={cut} />
        <RoundedRect x={cx + 2} y={cy - 9} width={3.5} height={18} r={1.5} color={cut} />
      </Group>
    );
  }
  // swap ↔ — opposing arrows (colour flip)
  const left = Skia.PathBuilder.Make()
    .moveTo(cx - 10, cy)
    .lineTo(cx - 1, cy - 8)
    .lineTo(cx - 1, cy + 8)
    .close()
    .detach();
  const right = Skia.PathBuilder.Make()
    .moveTo(cx + 10, cy)
    .lineTo(cx + 1, cy - 8)
    .lineTo(cx + 1, cy + 8)
    .close()
    .detach();
  return (
    <Group>
      <Path path={left} color={cut} />
      <Path path={right} color={cut} />
    </Group>
  );
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
  const level = LEVELS[resolveLevel(settings)];
  const basePaddleW = Math.min(130, width * 0.3) * level.paddleSize;
  const paddleH = 14;
  const ballR = 8;
  const baseSpeed = 260 * level.speed;
  const startLives = level.lives;
  const startPaddleEye = (settings.paddleEye as EyeSide) || 'left';

  const brickW = (width - 32) / COLS - 6;

  const [stage, setStage] = useState(0);
  const [lives, setLives] = useState<number>(startLives);
  const [paddleX, setPaddleX] = useState(width / 2 - basePaddleW / 2);
  const [balls, setBalls] = useState<Ball[]>(() => [makeBall(width, height, baseSpeed)]);
  const [bricks, setBricks] = useState<Brick[]>(() =>
    buildStageBricks(width, 0, level.hpCap),
  );
  const [drops, setDrops] = useState<PowerDrop[]>([]);
  const [score, setScore] = useState(0);
  const [cleared, setCleared] = useState(0);
  const [powers, setPowers] = useState<ActivePowers>({
    laserUntil: 0,
    wideUntil: 0,
    slowUntil: 0,
  });
  const [lasers, setLasers] = useState<{ id: string; x: number; y: number }[]>([]);
  const [paddleEye, setPaddleEye] = useState<EyeSide>(startPaddleEye);
  const [ballEye, setBallEye] = useState<EyeSide>(startPaddleEye === 'left' ? 'right' : 'left');

  const pointerX = useRef(width / 2);
  const startMs = useRef(Date.now());
  const ended = useRef(false);
  const ballsRef = useRef(balls);
  const bricksRef = useRef(bricks);
  const dropsRef = useRef(drops);
  const scoreRef = useRef(score);
  const clearedRef = useRef(cleared);
  const livesRef = useRef(lives);
  const stageRef = useRef(stage);
  const powersRef = useRef(powers);
  const lasersRef = useRef(lasers);
  const paddleXRef = useRef(paddleX);
  const paddleEyeRef = useRef(paddleEye);
  const ballEyeRef = useRef(ballEye);
  const laserCooldown = useRef(0);

  ballsRef.current = balls;
  bricksRef.current = bricks;
  dropsRef.current = drops;
  scoreRef.current = score;
  clearedRef.current = cleared;
  livesRef.current = lives;
  stageRef.current = stage;
  powersRef.current = powers;
  lasersRef.current = lasers;
  paddleXRef.current = paddleX;
  paddleEyeRef.current = paddleEye;
  ballEyeRef.current = ballEye;

  const nowMs = () => Date.now();
  const paddleColor = colorForEye(palette, paddleEye);
  const ballColor = colorForEye(palette, ballEye);
  const leftSolid = solidForEye(palette, 'left');
  const rightSolid = solidForEye(palette, 'right');
  const leftAlpha = palette.leftAlpha;
  const rightAlpha = palette.rightAlpha;
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

      let nextLasers = lasersRef.current
        .map((l) => ({ ...l, y: l.y - 420 * dt }))
        .filter((l) => l.y > -20);

      if (isLaser) {
        laserCooldown.current -= dt;
        if (laserCooldown.current <= 0) {
          laserCooldown.current = 0.22;
          const inset = 6;
          dropSeq += 1;
          nextLasers.push({ id: `lz-${dropSeq}`, x: px + inset, y: py });
          dropSeq += 1;
          nextLasers.push({ id: `lz-${dropSeq}`, x: px + curPaddleW - inset, y: py });
        }
      }

      const damageBrick = (hitIndex: number, destroy: boolean) => {
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
              eye: Math.random() > 0.5 ? 'left' : 'right',
              x: brick.x + brickW / 2,
              y: brick.y + BRICK_H / 2,
            });
          }
        } else {
          nextBricks = nextBricks.map((b, i) => (i === hitIndex ? { ...b, hp } : b));
          nextScore += 5;
        }
      };

      // Lasers: thin beam — point test is fine
      nextLasers = nextLasers.filter((l) => {
        let hitIndex = -1;
        for (let i = 0; i < nextBricks.length; i += 1) {
          const brick = nextBricks[i]!;
          if (
            l.x >= brick.x &&
            l.x <= brick.x + brickW &&
            l.y >= brick.y &&
            l.y <= brick.y + BRICK_H
          ) {
            hitIndex = i;
            break;
          }
        }
        if (hitIndex < 0) return true;
        damageBrick(hitIndex, true);
        return false;
      });

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

        // Full disc vs brick AABB — pick deepest overlap so gaps cannot swallow the ball
        let hitIndex = -1;
        let hit: ReturnType<typeof resolveBallBrick> = null;
        let bestPen = -1;
        for (let i = 0; i < nextBricks.length; i += 1) {
          const brick = nextBricks[i]!;
          const resolved = resolveBallBrick(x, y, ballR, brick.x, brick.y, brickW, BRICK_H);
          if (!resolved) continue;
          const pen = Math.hypot(resolved.nx - x, resolved.ny - y);
          if (pen > bestPen) {
            bestPen = pen;
            hitIndex = i;
            hit = resolved;
          }
        }
        if (hit && hitIndex >= 0) {
          damageBrick(hitIndex, false);
          if (hit.bounceX) vx = -vx;
          if (hit.bounceY) vy = -vy;
          x = hit.nx;
          y = hit.ny;
        }

        if (y > height + 40) continue;
        nextBalls.push({ ...ball, x, y, vx, vy });
      }

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
          } else if (d.kind === 'laser') nextP.laserUntil = now + 5000;
          else if (d.kind === 'wide') nextP.wideUntil = now + 10000;
          else if (d.kind === 'slow') nextP.slowUntil = now + 10000;
          else if (d.kind === 'swap') {
            const nextPad: EyeSide = paddleEyeRef.current === 'left' ? 'right' : 'left';
            const nextBall: EyeSide = nextPad === 'left' ? 'right' : 'left';
            paddleEyeRef.current = nextPad;
            ballEyeRef.current = nextBall;
            setPaddleEye(nextPad);
            setBallEye(nextBall);
          }
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

      // Stage clear
      if (nextBricks.length === 0) {
        const nextStage = stageRef.current + 1;
        nextScore += 150 * (nextStage);
        scoreRef.current = nextScore;
        setScore(nextScore);

        if (nextStage >= TOTAL_STAGES) {
          finish();
          return;
        }

        stageRef.current = nextStage;
        setStage(nextStage);
        const rebuilt = buildStageBricks(width, nextStage, level.hpCap);
        bricksRef.current = rebuilt;
        setBricks(rebuilt);
        const speedBoost = baseSpeed * (1 + nextStage * 0.04);
        const fresh = [makeBall(width, height, speedBoost)];
        ballsRef.current = fresh;
        setBalls(fresh);
        dropsRef.current = [];
        setDrops([]);
      }

      if (allBalls.length === 0) {
        const left = livesRef.current - 1;
        livesRef.current = left;
        setLives(left);
        if (left <= 0) {
          finish();
          return;
        }
        const fresh = [makeBall(width, height, baseSpeed * (1 + stageRef.current * 0.04))];
        ballsRef.current = fresh;
        setBalls(fresh);
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [basePaddleW, baseSpeed, brickW, height, level.hpCap, onGameOver, paused, width]);

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
        <Canvas style={{ width, height, backgroundColor: boardBg }}>
          <Rect x={0} y={0} width={width} height={height} color={boardBg} />
          <Rect x={0} y={0} width={4} height={height} color={paddleColor} opacity={0.5} />
          <Rect x={width - 4} y={0} width={4} height={height} color={paddleColor} opacity={0.5} />

          {bricks.map((b) => {
            const solid = b.eye === 'left' ? leftSolid : rightSolid;
            const alpha = b.eye === 'left' ? leftAlpha : rightAlpha;
            const fill = withOpacity(solid, alpha * fillOpacity(b.hp, b.maxHp));
            const border = withOpacity(solid, Math.min(1, alpha * 1.05));
            const bw = borderWidth(b.maxHp);
            return (
              <Group key={b.id}>
                <RoundedRect
                  x={b.x}
                  y={b.y}
                  width={brickW}
                  height={BRICK_H}
                  r={4}
                  color={border}
                />
                <RoundedRect
                  x={b.x + bw}
                  y={b.y + bw}
                  width={brickW - bw * 2}
                  height={BRICK_H - bw * 2}
                  r={3}
                  color={fill}
                />
              </Group>
            );
          })}

          {drops.map((d) => {
            const fill = colorForEye(palette, d.eye);
            return (
              <Group key={d.id}>
                <Circle cx={d.x} cy={d.y} r={ORB_R} color={fill} />
                <PowerIcon kind={d.kind} cx={d.x} cy={d.y} cut={boardBg} />
              </Group>
            );
          })}

          {lasers.map((l) => (
            <Rect key={l.id} x={l.x - 2} y={l.y - 16} width={4} height={18} color={ballColor} />
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
            <Circle key={b.id} cx={b.x} cy={b.y} r={ballR} color={ballColor} />
          ))}

          {/* Lives */}
          {Array.from({ length: lives }).map((_, i) => (
            <Circle key={`life-${i}`} cx={16 + i * 14} cy={height - 14} r={5} color={paddleColor} />
          ))}

          {/* Stage indicator — filled pips for current stage */}
          {Array.from({ length: TOTAL_STAGES }).map((_, i) => (
            <Rect
              key={`st-${i}`}
              x={width - 16 - (TOTAL_STAGES - 1 - i) * 7}
              y={10}
              width={5}
              height={8}
              color={paddleColor}
              opacity={i <= stage ? 1 : 0.25}
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
