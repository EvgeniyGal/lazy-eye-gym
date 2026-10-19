import { Canvas, Circle, Group, Path, Rect, Skia } from '@shopify/react-native-skia';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';

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

type Bullet = { id: string; x: number; y: number; vx: number; vy: number; life: number; heavy?: boolean };

type PowerKind = 'swap' | 'shield' | 'spray' | 'slow' | 'nova' | 'boost';

type PowerDrop = {
  id: string;
  kind: PowerKind;
  eye: EyeSide;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
};

const LEVELS = {
  easy: { rocks: 3, speed: 55, lives: 5, spin: 0.8 },
  hard: { rocks: 4, speed: 85, lives: 3, spin: 1.4 },
  extraHard: { rocks: 5, speed: 120, lives: 2, spin: 2.1 },
} as const;

type LevelKey = keyof typeof LEVELS;

const DECK_H = 108;
const SHIP_R = 14;
const THRUST = 210;
const ORB_R = 15;
const POWER_KINDS: PowerKind[] = ['swap', 'shield', 'spray', 'slow', 'nova', 'boost'];
const SLOW_MS = 6500;
const BOOST_MS = 6500;

type PadId = 'left' | 'right' | 'thrust' | 'fire';
type PadBox = { x: number; y: number; w: number; h: number };

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
  return 0;
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
  if (max <= 0) return 0;
  const n = v % max;
  return n < 0 ? n + max : n;
}

function edgeOffsets(x: number, y: number, r: number, w: number, h: number): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [{ x, y }];
  const left = x < r;
  const right = x > w - r;
  const top = y < r;
  const bottom = y > h - r;
  if (left) pts.push({ x: x + w, y });
  if (right) pts.push({ x: x - w, y });
  if (top) pts.push({ x, y: y + h });
  if (bottom) pts.push({ x, y: y - h });
  if (left && top) pts.push({ x: x + w, y: y + h });
  if (right && top) pts.push({ x: x - w, y: y + h });
  if (left && bottom) pts.push({ x: x + w, y: y - h });
  if (right && bottom) pts.push({ x: x - w, y: y - h });
  return pts;
}

function pickPower(): PowerKind {
  return POWER_KINDS[Math.floor(Math.random() * POWER_KINDS.length)]!;
}

function dropChance(size: RockSize) {
  if (size === 'large') return 0.38;
  if (size === 'medium') return 0.28;
  return 0.18;
}

function PowerIcon({ kind, cx, cy, cut }: { kind: PowerKind; cx: number; cy: number; cut: string }) {
  if (kind === 'shield') {
    return (
      <Path
        path={Skia.PathBuilder.Make()
          .moveTo(cx, cy - 8)
          .lineTo(cx + 7, cy - 3)
          .lineTo(cx + 7, cy + 2)
          .lineTo(cx, cy + 9)
          .lineTo(cx - 7, cy + 2)
          .lineTo(cx - 7, cy - 3)
          .close()
          .detach()}
        color={cut}
      />
    );
  }
  if (kind === 'spray') {
    return (
      <Group>
        <Rect x={cx - 1.5} y={cy - 9} width={3} height={12} color={cut} />
        <Rect x={cx - 7} y={cy - 5} width={3} height={10} color={cut} />
        <Rect x={cx + 4} y={cy - 5} width={3} height={10} color={cut} />
      </Group>
    );
  }
  if (kind === 'slow') {
    return (
      <Path
        path={Skia.PathBuilder.Make()
          .moveTo(cx - 7, cy - 6)
          .lineTo(cx, cy - 1)
          .lineTo(cx + 7, cy - 6)
          .lineTo(cx + 4, cy - 6)
          .lineTo(cx, cy - 3)
          .lineTo(cx - 4, cy - 6)
          .close()
          .moveTo(cx - 7, cy + 1)
          .lineTo(cx, cy + 6)
          .lineTo(cx + 7, cy + 1)
          .lineTo(cx + 4, cy + 1)
          .lineTo(cx, cy + 4)
          .lineTo(cx - 4, cy + 1)
          .close()
          .detach()}
        color={cut}
      />
    );
  }
  if (kind === 'nova') {
    return (
      <Group>
        <Circle cx={cx} cy={cy} r={3} color={cut} />
        <Rect x={cx - 1} y={cy - 9} width={2} height={5} color={cut} />
        <Rect x={cx - 1} y={cy + 4} width={2} height={5} color={cut} />
        <Rect x={cx - 9} y={cy - 1} width={5} height={2} color={cut} />
        <Rect x={cx + 4} y={cy - 1} width={5} height={2} color={cut} />
      </Group>
    );
  }
  if (kind === 'boost') {
    return (
      <Path
        path={Skia.PathBuilder.Make()
          .moveTo(cx, cy - 8)
          .lineTo(cx + 5, cy)
          .lineTo(cx + 1, cy)
          .lineTo(cx + 4, cy + 8)
          .lineTo(cx - 5, cy)
          .lineTo(cx - 1, cy)
          .close()
          .detach()}
        color={cut}
      />
    );
  }
  // swap
  const left = Skia.PathBuilder.Make()
    .moveTo(cx - 9, cy)
    .lineTo(cx - 1, cy - 7)
    .lineTo(cx - 1, cy + 7)
    .close()
    .detach();
  const right = Skia.PathBuilder.Make()
    .moveTo(cx + 9, cy)
    .lineTo(cx + 1, cy - 7)
    .lineTo(cx + 1, cy + 7)
    .close()
    .detach();
  return (
    <Group>
      <Path path={left} color={cut} />
      <Path path={right} color={cut} />
    </Group>
  );
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
  const [shipEye, setShipEye] = useState<EyeSide>('left');
  const shipColor = colorForEye(palette, shipEye);
  const leftColor = colorForEye(palette, 'left');
  const rightColor = colorForEye(palette, 'right');
  const boardBg = palette.background;
  const playH = Math.max(120, height - DECK_H);

  const [lives, setLives] = useState<number>(level.lives);
  const [score, setScore] = useState(0);
  const [destroyed, setDestroyed] = useState(0);
  const [ship, setShip] = useState({
    x: width / 2,
    y: playH / 2,
    angle: -Math.PI / 2,
    vx: 0,
    vy: 0,
  });
  const [rocks, setRocks] = useState<Rock[]>(() =>
    spawnRocks(level.rocks, width, playH, level.speed, level.spin, width / 2, playH / 2),
  );
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [drops, setDrops] = useState<PowerDrop[]>([]);
  const [invulnUntil, setInvulnUntil] = useState(0);
  const [thrustOn, setThrustOn] = useState(false);
  const [hasShield, setHasShield] = useState(false);
  const [slowUntil, setSlowUntil] = useState(0);
  const [boostUntil, setBoostUntil] = useState(0);
  const [novaFlash, setNovaFlash] = useState(0);
  const [padActive, setPadActive] = useState({ left: false, right: false, thrust: false, fire: false });

  const startMs = useRef(Date.now());
  const ended = useRef(false);
  const rotateDir = useRef(0);
  const thrusting = useRef(false);
  const fireCd = useRef(0);
  const wantFire = useRef(false);
  const thrustSfxAcc = useRef(0);
  const killsSinceDrop = useRef(0);
  const shipEyeRef = useRef(shipEye);
  const shieldRef = useRef(false);
  const slowRef = useRef(0);
  const boostRef = useRef(0);

  const shipRef = useRef(ship);
  const rocksRef = useRef(rocks);
  const bulletsRef = useRef(bullets);
  const dropsRef = useRef(drops);
  const livesRef = useRef(lives);
  const scoreRef = useRef(score);
  const destroyedRef = useRef(destroyed);
  const invulnRef = useRef(invulnUntil);

  shipRef.current = ship;
  rocksRef.current = rocks;
  bulletsRef.current = bullets;
  dropsRef.current = drops;
  livesRef.current = lives;
  scoreRef.current = score;
  destroyedRef.current = destroyed;
  invulnRef.current = invulnUntil;
  shipEyeRef.current = shipEye;
  shieldRef.current = hasShield;
  slowRef.current = slowUntil;
  boostRef.current = boostUntil;

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

    const spawnDropAt = (x: number, y: number, eye: EyeSide, into: PowerDrop[]) => {
      seq += 1;
      const ang = Math.random() * Math.PI * 2;
      into.push({
        id: `d-${seq}`,
        kind: pickPower(),
        eye,
        x,
        y,
        vx: Math.cos(ang) * 28,
        vy: Math.sin(ang) * 28,
        life: 12,
      });
      killsSinceDrop.current = 0;
    };

    const destroyRock = (
      r: Rock,
      nextScore: { n: number },
      nextDestroyed: { n: number },
      spawned: Rock[],
      nextDrops: PowerDrop[],
    ) => {
      nextDestroyed.n += 1;
      nextScore.n += r.size === 'large' ? 20 : r.size === 'medium' ? 50 : 100;
      const kids = splitRock(r, level.speed * 1.1, level.spin);
      if (kids.length) {
        spawned.push(...kids);
        sfxRef.current('ast_split');
      } else {
        sfxRef.current('ast_bang');
      }
      killsSinceDrop.current += 1;
      if (killsSinceDrop.current >= 4 || Math.random() < dropChance(r.size)) {
        spawnDropAt(r.x, r.y, r.eye, nextDrops);
      }
    };

    const tick = () => {
      if (ended.current) return;
      const now = Date.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const boosted = now < boostRef.current;
      const rotSpd = boosted ? 4.6 : 3.2;
      const thrust = boosted ? 320 : THRUST;
      const maxSpd = boosted ? 320 : 260;

      let s = { ...shipRef.current };
      s.angle += rotateDir.current * rotSpd * dt;
      if (thrusting.current) {
        s.vx += Math.cos(s.angle) * thrust * dt;
        s.vy += Math.sin(s.angle) * thrust * dt;
        thrustSfxAcc.current += dt;
        if (thrustSfxAcc.current > 0.12) {
          thrustSfxAcc.current = 0;
          sfxRef.current('ast_thrust');
        }
      }
      s.vx *= 0.995;
      s.vy *= 0.995;
      const spd = Math.hypot(s.vx, s.vy);
      if (spd > maxSpd) {
        s.vx = (s.vx / spd) * maxSpd;
        s.vy = (s.vy / spd) * maxSpd;
      }
      s.x = wrap(s.x + s.vx * dt, width);
      s.y = wrap(s.y + s.vy * dt, playH);

      fireCd.current = Math.max(0, fireCd.current - dt);
      let nextBullets = [...bulletsRef.current];
      if (wantFire.current && fireCd.current <= 0) {
        fireCd.current = boosted ? 0.14 : 0.22;
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
          y: wrap(b.y + b.vy * dt, playH),
          life: b.life - dt,
        }))
        .filter((b) => b.life > 0);

      const rockSlow = now < slowRef.current ? 0.35 : 1;
      let nextRocks = rocksRef.current.map((r) => ({
        ...r,
        x: wrap(r.x + r.vx * rockSlow * dt, width),
        y: wrap(r.y + r.vy * rockSlow * dt, playH),
        angle: r.angle + r.spin * rockSlow * dt,
      }));

      let nextDrops = dropsRef.current
        .map((d) => ({
          ...d,
          x: wrap(d.x + d.vx * dt, width),
          y: wrap(d.y + d.vy * dt, playH),
          life: d.life - dt,
        }))
        .filter((d) => d.life > 0);

      const scoreBox = { n: scoreRef.current };
      const destroyedBox = { n: destroyedRef.current };
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
          const pad = b.heavy ? 6 : 3;
          if (Math.hypot(b.x - r.x, b.y - r.y) < rad + pad) {
            hit = true;
            destroyRock(r, scoreBox, destroyedBox, spawned, nextDrops);
          } else {
            remain.push(r);
          }
        }
        nextRocks = remain;
        if (!hit) keptBullets.push(b);
      }
      nextRocks = [...nextRocks, ...spawned];

      // Pickup powers
      const keptDrops: PowerDrop[] = [];
      for (const d of nextDrops) {
        if (Math.hypot(d.x - s.x, d.y - s.y) < SHIP_R + ORB_R) {
          scoreBox.n += 15;
          if (d.kind === 'swap') {
            const nextEye: EyeSide = shipEyeRef.current === 'left' ? 'right' : 'left';
            shipEyeRef.current = nextEye;
            setShipEye(nextEye);
            nextRocks = nextRocks.map((r) => ({
              ...r,
              eye: r.eye === 'left' ? 'right' : 'left',
            }));
          } else if (d.kind === 'shield') {
            shieldRef.current = true;
            setHasShield(true);
          } else if (d.kind === 'spray') {
            const spreads = [-0.45, -0.22, 0, 0.22, 0.45];
            for (const off of spreads) {
              const ang = s.angle + off;
              seq += 1;
              keptBullets.push({
                id: `sp-${seq}`,
                x: s.x + Math.cos(ang) * 14,
                y: s.y + Math.sin(ang) * 14,
                vx: Math.cos(ang) * 400 + s.vx * 0.15,
                vy: Math.sin(ang) * 400 + s.vy * 0.15,
                life: 1.0,
                heavy: true,
              });
            }
            sfxRef.current('ast_shoot');
          } else if (d.kind === 'slow') {
            const until = now + SLOW_MS;
            slowRef.current = until;
            setSlowUntil(until);
          } else if (d.kind === 'nova') {
            const novaSpawned: Rock[] = [];
            const novaDrops: PowerDrop[] = [];
            const remain: Rock[] = [];
            for (const r of nextRocks) {
              if (Math.hypot(r.x - s.x, r.y - s.y) < 110) {
                destroyRock(r, scoreBox, destroyedBox, novaSpawned, novaDrops);
              } else {
                remain.push(r);
              }
            }
            nextRocks = [...remain, ...novaSpawned];
            keptDrops.push(...novaDrops);
            setNovaFlash(0.5);
            sfxRef.current('ast_bang');
          } else if (d.kind === 'boost') {
            const until = now + BOOST_MS;
            boostRef.current = until;
            setBoostUntil(until);
          }
          sfxRef.current('ast_split');
          continue;
        }
        keptDrops.push(d);
      }
      nextDrops = keptDrops;

      if (now > invulnRef.current) {
        for (const r of nextRocks) {
          if (Math.hypot(s.x - r.x, s.y - r.y) < radiusFor(r.size) + 10) {
            if (shieldRef.current) {
              shieldRef.current = false;
              setHasShield(false);
              invulnRef.current = now + 900;
              setInvulnUntil(invulnRef.current);
              sfxRef.current('ast_split');
              break;
            }
            const left = livesRef.current - 1;
            livesRef.current = left;
            setLives(left);
            invulnRef.current = now + 2000;
            setInvulnUntil(invulnRef.current);
            s = { x: width / 2, y: playH / 2, angle: -Math.PI / 2, vx: 0, vy: 0 };
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
          playH,
          level.speed * 1.08,
          level.spin,
          s.x,
          s.y,
        );
        scoreBox.n += 150;
        nextDrops = [];
        killsSinceDrop.current = 0;
      }

      shipRef.current = s;
      rocksRef.current = nextRocks;
      bulletsRef.current = keptBullets;
      dropsRef.current = nextDrops;
      scoreRef.current = scoreBox.n;
      destroyedRef.current = destroyedBox.n;
      setShip(s);
      setRocks(nextRocks);
      setBullets(keptBullets);
      setDrops(nextDrops);
      setScore(scoreBox.n);
      setDestroyed(destroyedBox.n);
      setNovaFlash((f) => (f > 0 ? Math.max(0, f - dt * 1.5) : 0));

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [level, onGameOver, paused, playH, width]);

  const padBoxes = useRef<Partial<Record<PadId, PadBox>>>({});
  const padRefs = useRef<Partial<Record<PadId, View | null>>>({});

  const measurePad = useCallback((id: PadId) => {
    const node = padRefs.current[id] as
      | (View & { measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void })
      | null;
    node?.measureInWindow?.((x, y, w, h) => {
      padBoxes.current[id] = { x, y, w, h };
    });
  }, []);

  const padAt = (pageX: number, pageY: number): PadId | null => {
    const expand = 12;
    let hit: PadId | null = null;
    (Object.keys(padBoxes.current) as PadId[]).forEach((id) => {
      const b = padBoxes.current[id];
      if (!b) return;
      if (
        pageX >= b.x - expand &&
        pageX <= b.x + b.w + expand &&
        pageY >= b.y - expand &&
        pageY <= b.y + b.h + expand
      ) {
        hit = id;
      }
    });
    return hit;
  };

  const applyTouches = (e: GestureResponderEvent) => {
    const touches = e.nativeEvent.touches;
    let left = false;
    let right = false;
    let thrust = false;
    let fire = false;
    for (let i = 0; i < touches.length; i += 1) {
      const t = touches[i]!;
      const id = padAt(t.pageX, t.pageY);
      if (id === 'left') left = true;
      else if (id === 'right') right = true;
      else if (id === 'thrust') thrust = true;
      else if (id === 'fire') fire = true;
    }

    if (left && !right) rotateDir.current = -1;
    else if (right && !left) rotateDir.current = 1;
    else rotateDir.current = 0;

    thrusting.current = thrust;
    setThrustOn(thrust);

    const wasFiring = wantFire.current;
    wantFire.current = fire;
    if (fire && !wasFiring) fireCd.current = 0;

    setPadActive({ left, right, thrust, fire });
  };

  const clearTouches = () => {
    rotateDir.current = 0;
    thrusting.current = false;
    wantFire.current = false;
    setThrustOn(false);
    setPadActive({ left: false, right: false, thrust: false, fire: false });
  };

  const blink = Date.now() < invulnUntil && Math.floor(Date.now() / 120) % 2 === 0;
  const boosted = Date.now() < boostUntil;
  const slowed = Date.now() < slowUntil;

  const shipPath = Skia.PathBuilder.Make()
    .moveTo(14, 0)
    .lineTo(-10, 9)
    .lineTo(-6, 0)
    .lineTo(-10, -9)
    .close()
    .detach();

  const thrustPath = Skia.PathBuilder.Make()
    .moveTo(-6, 0)
    .lineTo(-16, 4)
    .lineTo(-16, -4)
    .close()
    .detach();

  const padStyle = (on: boolean) => ({
    borderColor: shipColor,
    backgroundColor: shipColor,
    opacity: on ? 1 : 0.55,
  });

  return (
    <View style={[styles.fill, { backgroundColor: boardBg }]}>
      <Canvas style={{ width, height: playH, backgroundColor: boardBg }}>
        <Rect x={0} y={0} width={width} height={playH} color={boardBg} />

        {rocks.map((r) => {
          const fill = r.eye === 'left' ? leftColor : rightColor;
          const bw = borderFor(r.size);
          const path = rockPath(r);
          const rad = radiusFor(r.size);
          return edgeOffsets(r.x, r.y, rad, width, playH).map((p, i) => (
            <Group
              key={`${r.id}-${i}`}
              opacity={slowed ? 0.75 : 1}
              transform={[{ translateX: p.x }, { translateY: p.y }, { rotate: r.angle }]}
            >
              {bw > 0 ? (
                <Group>
                  <Path path={path} color={fill} />
                  <Group transform={[{ scale: Math.max(0.35, 1 - bw / rad) }]}>
                    <Path path={path} color={boardBg} />
                  </Group>
                </Group>
              ) : (
                <Path path={path} color={fill} />
              )}
            </Group>
          ));
        })}

        {drops.map((d) => {
          const fill = d.eye === 'left' ? leftColor : rightColor;
          return (
            <Group key={d.id}>
              <Circle cx={d.x} cy={d.y} r={ORB_R + 3} color={fill} opacity={0.3} />
              <Circle cx={d.x} cy={d.y} r={ORB_R} color={fill} />
              <PowerIcon kind={d.kind} cx={d.x} cy={d.y} cut={boardBg} />
            </Group>
          );
        })}

        {bullets.map((b) => (
          <Circle
            key={b.id}
            cx={b.x}
            cy={b.y}
            r={b.heavy ? 4 : 2.5}
            color={shipColor}
          />
        ))}

        {novaFlash > 0 ? (
          <Circle cx={ship.x} cy={ship.y} r={110} color={shipColor} opacity={novaFlash * 0.25} />
        ) : null}

        {!blink
          ? edgeOffsets(ship.x, ship.y, SHIP_R, width, playH).map((p, i) => (
              <Group
                key={`ship-${i}`}
                transform={[{ translateX: p.x }, { translateY: p.y }, { rotate: ship.angle }]}
              >
                {hasShield ? (
                  <Circle cx={0} cy={0} r={18} color={shipColor} opacity={0.28} />
                ) : null}
                <Path path={shipPath} color={shipColor} />
                {thrustOn ? <Path path={thrustPath} color={shipColor} /> : null}
                {boosted ? (
                  <Rect x={-8} y={10} width={16} height={3} color={shipColor} opacity={0.7} />
                ) : null}
              </Group>
            ))
          : null}

        {Array.from({ length: lives }).map((_, i) => (
          <Circle key={`life-${i}`} cx={16 + i * 14} cy={playH - 14} r={5} color={shipColor} />
        ))}
      </Canvas>

      <View
        style={[styles.deck, { height: DECK_H, width, backgroundColor: boardBg }]}
        onTouchStart={applyTouches}
        onTouchMove={applyTouches}
        onTouchEnd={applyTouches}
        onTouchCancel={clearTouches}
      >
        <View style={styles.deckLeft} pointerEvents="none">
          <View
            ref={(n) => {
              padRefs.current.left = n;
            }}
            style={[styles.pad, styles.padRotate, padStyle(padActive.left)]}
            onLayout={() => measurePad('left')}
          >
            <Text style={[styles.padLabel, { color: boardBg }]}>◀</Text>
          </View>
          <View
            ref={(n) => {
              padRefs.current.thrust = n;
            }}
            style={[styles.pad, styles.padThrust, padStyle(padActive.thrust)]}
            onLayout={() => measurePad('thrust')}
          >
            <Text style={[styles.padLabel, { color: boardBg }]}>▲</Text>
          </View>
          <View
            ref={(n) => {
              padRefs.current.right = n;
            }}
            style={[styles.pad, styles.padRotate, padStyle(padActive.right)]}
            onLayout={() => measurePad('right')}
          >
            <Text style={[styles.padLabel, { color: boardBg }]}>▶</Text>
          </View>
        </View>

        <View
          ref={(n) => {
            padRefs.current.fire = n;
          }}
          style={[styles.pad, styles.padFire, padStyle(padActive.fire)]}
          pointerEvents="none"
          onLayout={() => measurePad('fire')}
        >
          <Text style={[styles.padLabel, styles.fireLabel, { color: boardBg }]}>FIRE</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  deck: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 8,
    paddingTop: 6,
    gap: 12,
  },
  deckLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  pad: {
    borderWidth: 2,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  padRotate: {
    width: 56,
    height: 64,
  },
  padThrust: {
    width: 56,
    height: 72,
  },
  padFire: {
    width: 96,
    height: 80,
  },
  padLabel: {
    fontSize: 22,
    fontWeight: '700',
  },
  fireLabel: {
    fontSize: 16,
    letterSpacing: 1,
  },
});
