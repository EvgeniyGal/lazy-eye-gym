import { Canvas, Circle, Group, Path, Rect, Skia } from '@shopify/react-native-skia';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import type { EyeSide } from '@/src/anaglyph/color';
import { colorForEye } from '@/src/anaglyph/palette';
import { useGameAudio } from '@/src/audio/useGameAudio';
import type { GameSceneProps } from '../types';

type RockSize = 'large' | 'medium' | 'small';

type Rock = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  size: RockSize;
  eye: EyeSide;
  verts: { x: number; y: number }[];
};

type Bullet = { id: string; x: number; y: number; vx: number; vy: number; life: number };

const LEVELS = {
  easy: { rocks: 3, speed: 55, lives: 5, spin: 0.8 },
  hard: { rocks: 4, speed: 85, lives: 3, spin: 1.4 },
  extraHard: { rocks: 5, speed: 120, lives: 2, spin: 2.1 },
} as const;

type LevelKey = keyof typeof LEVELS;

function resolveLevel(settings: Record<string, string | number | boolean>): LevelKey {
  const raw = String(settings.difficulty ?? 'easy');
  if (raw === 'hard' || raw === 'extraHard') return raw;
  return 'easy';
}

function radiusFor(size: RockSize) {
  if (size === 'large') return 34;
  if (size === 'medium') return 20;
  return 11;
}

function borderFor(size: RockSize) {
  if (size === 'large') return 5;
  if (size === 'medium') return 3.5;
  return 0; // small = filled
}

function makeVerts(seed: number, r: number) {
  const n = 7 + (seed % 3);
  const verts: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i += 1) {
    const a = (Math.PI * 2 * i) / n;
    const jitter = 0.7 + ((seed * (i + 3)) % 10) / 25;
    verts.push({ x: Math.cos(a) * r * jitter, y: Math.sin(a) * r * jitter });
  }
  return verts;
}

function wrap(v: number, max: number) {
  if (v < -40) return max + 40;
  if (v > max + 40) return -40;
  return v;
}

let seq = 0;

function spawnRocks(
  count: number,
  width: number,
  height: number,
  speed: number,
  spin: number,
  cx: number,
  cy: number,
): Rock[] {
  const rocks: Rock[] = [];
  for (let i = 0; i < count; i += 1) {
    seq += 1;
    const ang = Math.random() * Math.PI * 2;
    let x = Math.random() * width;
    let y = Math.random() * height;
    // Keep clear of ship spawn
    if (Math.hypot(x - cx, y - cy) < 120) {
      x = (x + width / 2) % width;
      y = (y + height / 2) % height;
    }
    const r = radiusFor('large');
    rocks.push({
      id: `r-${seq}`,
      x,
      y,
      vx: Math.cos(ang) * speed * (0.6 + Math.random() * 0.6),
      vy: Math.sin(ang) * speed * (0.6 + Math.random() * 0.6),
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * spin,
      size: 'large',
      eye: Math.random() > 0.5 ? 'left' : 'right',
      verts: makeVerts(seq, r),
    });
  }
  return rocks;
}

function splitRock(rock: Rock, speed: number, spin: number): Rock[] {
  if (rock.size === 'small') return [];
  const nextSize: RockSize = rock.size === 'large' ? 'medium' : 'small';
  const r = radiusFor(nextSize);
  const out: Rock[] = [];
  for (let i = 0; i < 2; i += 1) {
    seq += 1;
    const ang = Math.random() * Math.PI * 2;
    out.push({
      id: `r-${seq}`,
      x: rock.x,
      y: rock.y,
      vx: Math.cos(ang) * speed * (0.9 + Math.random() * 0.5),
      vy: Math.sin(ang) * speed * (0.9 + Math.random() * 0.5),
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * spin * 1.4,
      size: nextSize,
      eye: Math.random() > 0.5 ? 'left' : 'right',
      verts: makeVerts(seq, r),
    });
  }
  return out;
}

function rockPath(rock: Rock) {
  const b = Skia.PathBuilder.Make();
  const v0 = rock.verts[0]!;
  b.moveTo(v0.x, v0.y);
  for (let i = 1; i < rock.verts.length; i += 1) {
    const v = rock.verts[i]!;
    b.lineTo(v.x, v.y);
  }
  return b.close().detach();
}

export function AsteroidsGame({
  width,
  height,
  palette,
  settings,
  paused,
  onScore,
  onGameOver,
}: GameSceneProps) {
  const { sfx } = useGameAudio(settings);
  const sfxRef = useRef(sfx);
  sfxRef.current = sfx;

  const level = LEVELS[resolveLevel(settings)];
  const shipEye = (settings.shipEye as EyeSide) || 'left';
  const shipColor = colorForEye(palette, shipEye);
  const leftColor = colorForEye(palette, 'left');
  const rightColor = colorForEye(palette, 'right');
  const boardBg = palette.background;

  const [lives, setLives] = useState<number>(level.lives);
  const [score, setScore] = useState(0);
  const [destroyed, setDestroyed] = useState(0);
  const [ship, setShip] = useState({
    x: width / 2,
    y: height / 2,
    angle: -Math.PI / 2,
    vx: 0,
    vy: 0,
  });
  const [rocks, setRocks] = useState<Rock[]>(() =>
    spawnRocks(level.rocks, width, height, level.speed, level.spin, width / 2, height / 2),
  );
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [invulnUntil, setInvulnUntil] = useState(0);
  const [thrustOn, setThrustOn] = useState(false);

  const startMs = useRef(Date.now());
  const ended = useRef(false);
  const rotateDir = useRef(0);
  const thrusting = useRef(false);
  const fireCd = useRef(0);
  const wantFire = useRef(false);
  const thrustSfxAcc = useRef(0);

  const shipRef = useRef(ship);
  const rocksRef = useRef(rocks);
  const bulletsRef = useRef(bullets);
  const livesRef = useRef(lives);
  const scoreRef = useRef(score);
  const destroyedRef = useRef(destroyed);
  const invulnRef = useRef(invulnUntil);

  shipRef.current = ship;
  rocksRef.current = rocks;
  bulletsRef.current = bullets;
  livesRef.current = lives;
  scoreRef.current = score;
  destroyedRef.current = destroyed;
  invulnRef.current = invulnUntil;

  useEffect(() => {
    onScore(score, destroyed);
  }, [destroyed, onScore, score]);

  useEffect(() => {
    if (paused || ended.current) return;
    let frame = 0;
    let last = Date.now();

    const finish = () => {
      if (ended.current) return;
      ended.current = true;
      sfxRef.current('ast_die');
      onGameOver({
        score: scoreRef.current,
        bestMetric: destroyedRef.current,
        durationSec: Math.round((Date.now() - startMs.current) / 1000),
      });
    };

    const tick = () => {
      if (ended.current) return;
      const now = Date.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      let s = { ...shipRef.current };
      s.angle += rotateDir.current * 3.2 * dt;
      if (thrusting.current) {
        s.vx += Math.cos(s.angle) * 180 * dt;
        s.vy += Math.sin(s.angle) * 180 * dt;
        thrustSfxAcc.current += dt;
        if (thrustSfxAcc.current > 0.12) {
          thrustSfxAcc.current = 0;
          sfxRef.current('ast_thrust');
        }
      }
      s.vx *= 0.995;
      s.vy *= 0.995;
      const spd = Math.hypot(s.vx, s.vy);
      if (spd > 260) {
        s.vx = (s.vx / spd) * 260;
        s.vy = (s.vy / spd) * 260;
      }
      s.x = wrap(s.x + s.vx * dt, width);
      s.y = wrap(s.y + s.vy * dt, height);

      fireCd.current = Math.max(0, fireCd.current - dt);
      let nextBullets = [...bulletsRef.current];
      if (wantFire.current && fireCd.current <= 0) {
        fireCd.current = 0.22;
        seq += 1;
        nextBullets.push({
          id: `b-${seq}`,
          x: s.x + Math.cos(s.angle) * 14,
          y: s.y + Math.sin(s.angle) * 14,
          vx: Math.cos(s.angle) * 340 + s.vx * 0.2,
          vy: Math.sin(s.angle) * 340 + s.vy * 0.2,
          life: 1.1,
        });
        sfxRef.current('ast_shoot');
      }

      nextBullets = nextBullets
        .map((b) => ({
          ...b,
          x: wrap(b.x + b.vx * dt, width),
          y: wrap(b.y + b.vy * dt, height),
          life: b.life - dt,
        }))
        .filter((b) => b.life > 0);

      let nextRocks = rocksRef.current.map((r) => ({
        ...r,
        x: wrap(r.x + r.vx * dt, width),
        y: wrap(r.y + r.vy * dt, height),
        angle: r.angle + r.spin * dt,
      }));

      let nextScore = scoreRef.current;
      let nextDestroyed = destroyedRef.current;
      const spawned: Rock[] = [];
      const keptBullets: Bullet[] = [];

      for (const b of nextBullets) {
        let hit = false;
        const remain: Rock[] = [];
        for (const r of nextRocks) {
          if (hit) {
            remain.push(r);
            continue;
          }
          const rad = radiusFor(r.size);
          if (Math.hypot(b.x - r.x, b.y - r.y) < rad + 3) {
            hit = true;
            nextDestroyed += 1;
            nextScore += r.size === 'large' ? 20 : r.size === 'medium' ? 50 : 100;
            const kids = splitRock(r, level.speed * 1.1, level.spin);
            if (kids.length) {
              spawned.push(...kids);
              sfxRef.current('ast_split');
            } else {
              sfxRef.current('ast_bang');
            }
          } else {
            remain.push(r);
          }
        }
        nextRocks = remain;
        if (!hit) keptBullets.push(b);
      }
      nextRocks = [...nextRocks, ...spawned];

      if (now > invulnRef.current) {
        for (const r of nextRocks) {
          if (Math.hypot(s.x - r.x, s.y - r.y) < radiusFor(r.size) + 10) {
            const left = livesRef.current - 1;
            livesRef.current = left;
            setLives(left);
            invulnRef.current = now + 2000;
            setInvulnUntil(invulnRef.current);
            s = { x: width / 2, y: height / 2, angle: -Math.PI / 2, vx: 0, vy: 0 };
            sfxRef.current('ast_die');
            if (left <= 0) {
              finish();
              return;
            }
            break;
          }
        }
      }

      if (nextRocks.length === 0) {
        nextRocks = spawnRocks(
          level.rocks + 1,
          width,
          height,
          level.speed * 1.08,
          level.spin,
          s.x,
          s.y,
        );
        nextScore += 150;
      }

      shipRef.current = s;
      rocksRef.current = nextRocks;
      bulletsRef.current = keptBullets;
      scoreRef.current = nextScore;
      destroyedRef.current = nextDestroyed;
      setShip(s);
      setRocks(nextRocks);
      setBullets(keptBullets);
      setScore(nextScore);
      setDestroyed(nextDestroyed);

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [height, level, onGameOver, paused, width]);

  const setThrust = (on: boolean) => {
    thrusting.current = on;
    setThrustOn(on);
  };

  const pan = Gesture.Pan()
    .runOnJS(true)
    .onBegin((e) => {
      const dx = e.x - width / 2;
      rotateDir.current = dx < -30 ? -1 : dx > 30 ? 1 : 0;
      setThrust(e.y < height * 0.55);
      wantFire.current = true;
    })
    .onUpdate((e) => {
      const dx = e.x - width / 2;
      rotateDir.current = Math.abs(dx) < 24 ? 0 : dx < 0 ? -1 : 1;
      setThrust(e.y < height * 0.55);
      wantFire.current = true;
    })
    .onEnd(() => {
      rotateDir.current = 0;
      setThrust(false);
      wantFire.current = false;
    });

  const tap = Gesture.Tap()
    .runOnJS(true)
    .onEnd(() => {
      wantFire.current = true;
      fireCd.current = 0;
    });

  const gesture = Gesture.Simultaneous(pan, tap);
  const blink = Date.now() < invulnUntil && Math.floor(Date.now() / 120) % 2 === 0;

  const shipPath = Skia.PathBuilder.Make()
    .moveTo(14, 0)
    .lineTo(-10, 9)
    .lineTo(-6, 0)
    .lineTo(-10, -9)
    .close()
    .detach();

  return (
    <GestureDetector gesture={gesture}>
      <View style={[styles.fill, { backgroundColor: boardBg }]}>
        <Canvas style={{ width, height, backgroundColor: boardBg }}>
          <Rect x={0} y={0} width={width} height={height} color={boardBg} />

          {rocks.map((r) => {
            const fill = r.eye === 'left' ? leftColor : rightColor;
            const bw = borderFor(r.size);
            const path = rockPath(r);
            return (
              <Group
                key={r.id}
                transform={[
                  { translateX: r.x },
                  { translateY: r.y },
                  { rotate: r.angle },
                ]}
              >
                {bw > 0 ? (
                  <Group>
                    <Path path={path} color={fill} />
                    <Group transform={[{ scale: Math.max(0.35, 1 - bw / radiusFor(r.size)) }]}>
                      <Path path={path} color={boardBg} />
                    </Group>
                  </Group>
                ) : (
                  <Path path={path} color={fill} />
                )}
              </Group>
            );
          })}

          {bullets.map((b) => (
            <Circle key={b.id} cx={b.x} cy={b.y} r={2.5} color={shipColor} />
          ))}

          {!blink ? (
            <Group
              transform={[
                { translateX: ship.x },
                { translateY: ship.y },
                { rotate: ship.angle },
              ]}
            >
              <Path path={shipPath} color={shipColor} />
              {thrustOn ? (
                <Path
                  path={Skia.PathBuilder.Make()
                    .moveTo(-6, 0)
                    .lineTo(-16, 4)
                    .lineTo(-16, -4)
                    .close()
                    .detach()}
                  color={shipColor}
                />
              ) : null}
            </Group>
          ) : null}

          {Array.from({ length: lives }).map((_, i) => (
            <Circle key={`life-${i}`} cx={16 + i * 14} cy={height - 14} r={5} color={shipColor} />
          ))}
        </Canvas>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
