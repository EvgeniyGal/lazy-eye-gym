import { Canvas, Circle, Group, Path, Rect, RoundedRect, Skia } from '@shopify/react-native-skia';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import type { EyeSide } from '@/src/anaglyph/color';
import { colorForEye } from '@/src/anaglyph/palette';
import { useGameAudio } from '@/src/audio/useGameAudio';
import { PowerOrb } from '../shared/powerOrbs';
import { POWER_SPAWN_SFX, sfxForPowerKind } from '../shared/powerSfx';
import type { GameSceneProps } from '../types';
import {
  kindHp,
  STAGES_PER_DIFFICULTY,
  wavesForDifficulty,
  type WaveLayout,
} from './invadersStages';

type AlienKind = 1 | 2 | 3 | 4;

type Alien = {
  id: string;
  col: number;
  row: number;
  kind: AlienKind;
  hp: number;
  maxHp: number;
  eye: EyeSide;
  alive: boolean;
};

type Bullet = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  friendly: boolean;
  rocket?: boolean;
};

type PowerKind = 'repulsor' | 'shield' | 'overdrive' | 'rocket' | 'bomb' | 'swap';

type PowerDrop = {
  id: string;
  kind: PowerKind;
  eye: EyeSide;
  x: number;
  y: number;
};

type Bunker = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
};

const COLS = 8;
const ORB_R = 16;
const OVERDRIVE_MS = 6000;
const DROP_FALL = 70;
const POWER_KINDS: PowerKind[] = ['repulsor', 'shield', 'overdrive', 'rocket', 'bomb', 'swap'];

/** Chance a destroyed alien drops a power orb (any kind can drop). */
function dropChanceForKind(kind: AlienKind): number {
  if (kind === 4) return 0.55;
  if (kind === 3) return 0.42;
  if (kind === 2) return 0.28;
  return 0.16;
}

function pickPowerKind(): PowerKind {
  return POWER_KINDS[Math.floor(Math.random() * POWER_KINDS.length)]!;
}

const LEVELS = {
  easy: { speed: 28, bombEvery: 2.4, lives: 5, fireMs: 580 },
  hard: { speed: 42, bombEvery: 1.6, lives: 3, fireMs: 480 },
  extraHard: { speed: 58, bombEvery: 1.05, lives: 2, fireMs: 400 },
} as const;

type LevelKey = keyof typeof LEVELS;

function resolveLevel(settings: Record<string, string | number | boolean>): LevelKey {
  const raw = String(settings.difficulty ?? 'easy');
  if (raw === 'hard' || raw === 'extraHard') return raw;
  return 'easy';
}

function buildWave(difficulty: LevelKey, stageIndex: number): { aliens: Alien[]; layout: WaveLayout } {
  const pack = wavesForDifficulty(difficulty);
  const layout = pack[Math.min(pack.length - 1, stageIndex)]!;
  const aliens: Alien[] = [];
  for (let r = 0; r < layout.grid.length; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const code = layout.grid[r]![c] ?? 0;
      if (code <= 0) continue;
      const kind = Math.min(4, Math.max(1, code)) as AlienKind;
      const hp = kindHp(kind);
      aliens.push({
        id: `a-${stageIndex}-${r}-${c}`,
        col: c,
        row: r,
        kind,
        hp,
        maxHp: hp,
        eye: (r + c) % 2 === 0 ? 'left' : 'right',
        alive: true,
      });
    }
  }
  return { aliens, layout };
}

function makeBunkers(width: number, shipY: number, enabled: boolean | undefined): Bunker[] {
  if (!enabled) return [];
  const count = 4;
  const pad = 20;
  const gap = 18;
  const totalGaps = count - 1;
  const w = (width - pad * 2 - gap * totalGaps) / count;
  const h = 14;
  const y = shipY - 48;
  const list: Bunker[] = [];
  for (let i = 0; i < count; i += 1) {
    list.push({
      id: `bk-${i}`,
      x: pad + i * (w + gap),
      y,
      w,
      h,
      hp: 3,
    });
  }
  return list;
}

function alienPath(kind: AlienKind, x: number, y: number, cell: number) {
  const cx = x + cell / 2;
  const cy = y + cell * 0.42;
  if (kind === 1) {
    // Drone — small chevron
    const s = cell * 0.28;
    return Skia.PathBuilder.Make()
      .moveTo(cx, cy - s)
      .lineTo(cx + s, cy + s * 0.55)
      .lineTo(cx + s * 0.35, cy + s * 0.35)
      .lineTo(cx, cy + s * 0.15)
      .lineTo(cx - s * 0.35, cy + s * 0.35)
      .lineTo(cx - s, cy + s * 0.55)
      .close()
      .detach();
  }
  if (kind === 2) {
    // Fighter — classic wide body + wing nubs
    const bw = cell * 0.38;
    const bh = cell * 0.22;
    return Skia.PathBuilder.Make()
      .moveTo(cx - bw, cy)
      .lineTo(cx - bw * 0.55, cy - bh)
      .lineTo(cx + bw * 0.55, cy - bh)
      .lineTo(cx + bw, cy)
      .lineTo(cx + bw * 0.7, cy + bh * 0.85)
      .lineTo(cx + bw * 0.25, cy + bh * 0.45)
      .lineTo(cx - bw * 0.25, cy + bh * 0.45)
      .lineTo(cx - bw * 0.7, cy + bh * 0.85)
      .close()
      .detach();
  }
  if (kind === 3) {
    // Cruiser — tall oval body + side fins
    const rx = cell * 0.28;
    const ry = cell * 0.34;
    const oval = Skia.XYWHRect(cx - rx, cy - ry, rx * 2, ry * 2);
    return Skia.PathBuilder.Make()
      .addOval(oval)
      .moveTo(cx - rx - cell * 0.12, cy)
      .lineTo(cx - rx, cy - cell * 0.1)
      .lineTo(cx - rx, cy + cell * 0.1)
      .close()
      .moveTo(cx + rx + cell * 0.12, cy)
      .lineTo(cx + rx, cy - cell * 0.1)
      .lineTo(cx + rx, cy + cell * 0.1)
      .close()
      .detach();
  }
  // Fortress — blocky armor with notches
  const s = cell * 0.36;
  return Skia.PathBuilder.Make()
    .moveTo(cx - s, cy - s * 0.7)
    .lineTo(cx - s * 0.35, cy - s * 0.7)
    .lineTo(cx - s * 0.35, cy - s)
    .lineTo(cx + s * 0.35, cy - s)
    .lineTo(cx + s * 0.35, cy - s * 0.7)
    .lineTo(cx + s, cy - s * 0.7)
    .lineTo(cx + s, cy + s * 0.75)
    .lineTo(cx + s * 0.45, cy + s * 0.75)
    .lineTo(cx + s * 0.45, cy + s * 0.4)
    .lineTo(cx - s * 0.45, cy + s * 0.4)
    .lineTo(cx - s * 0.45, cy + s * 0.75)
    .lineTo(cx - s, cy + s * 0.75)
    .close()
    .detach();
}

let seq = 0;

export function InvadersGame({
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

  const difficulty = resolveLevel(settings);
  const level = LEVELS[difficulty];
  const totalStages = STAGES_PER_DIFFICULTY;
  const [shipEye, setShipEye] = useState<EyeSide>('left');
  const focusEye: EyeSide = shipEye === 'left' ? 'right' : 'left';
  const shipColor = colorForEye(palette, shipEye);
  const leftColor = colorForEye(palette, 'left');
  const rightColor = colorForEye(palette, 'right');
  const focusColor = colorForEye(palette, focusEye);
  const boardBg = palette.background;

  const cell = Math.min((width - 24) / COLS, 36);
  const gridW = cell * COLS;
  const ox = (width - gridW) / 2;
  const shipY = height - 52;
  const baseShipW = 36;
  const shipH = 14;

  const initial = buildWave(difficulty, 0);

  const [lives, setLives] = useState<number>(level.lives);
  const [score, setScore] = useState(0);
  const [killed, setKilled] = useState(0);
  const [stage, setStage] = useState(0);
  const [shipX, setShipX] = useState(width / 2 - baseShipW / 2);
  const [aliens, setAliens] = useState<Alien[]>(initial.aliens);
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [drops, setDrops] = useState<PowerDrop[]>([]);
  const [bunkers, setBunkers] = useState<Bunker[]>(() => makeBunkers(width, shipY, initial.layout.bunkers));
  const [focusId, setFocusId] = useState<string | null>(null);
  const [pulse, setPulse] = useState(0);
  const [hasShield, setHasShield] = useState(false);
  const [overdriveUntil, setOverdriveUntil] = useState(0);
  const [bombFlash, setBombFlash] = useState(0);

  const startMs = useRef(Date.now());
  const ended = useRef(false);
  const dir = useRef(1);
  const originX = useRef(ox);
  const originY = useRef(initial.layout.topY);
  const stepAcc = useRef(0);
  const bombAcc = useRef(0);
  const focusAcc = useRef(0);
  const fireCd = useRef(0);
  const pointerX = useRef(width / 2);
  const wantFire = useRef(false);
  const killsSinceDrop = useRef(0);
  const shipEyeRef = useRef(shipEye);

  const aliensRef = useRef(aliens);
  const bulletsRef = useRef(bullets);
  const dropsRef = useRef(drops);
  const bunkersRef = useRef(bunkers);
  const livesRef = useRef(lives);
  const scoreRef = useRef(score);
  const killedRef = useRef(killed);
  const stageRef = useRef(stage);
  const focusRef = useRef(focusId);
  const shipXRef = useRef(shipX);
  const shieldRef = useRef(hasShield);
  const overdriveRef = useRef(overdriveUntil);

  aliensRef.current = aliens;
  bulletsRef.current = bullets;
  dropsRef.current = drops;
  bunkersRef.current = bunkers;
  livesRef.current = lives;
  scoreRef.current = score;
  killedRef.current = killed;
  stageRef.current = stage;
  focusRef.current = focusId;
  shipXRef.current = shipX;
  shieldRef.current = hasShield;
  overdriveRef.current = overdriveUntil;
  shipEyeRef.current = shipEye;

  const overdriveActive = Date.now() < overdriveUntil;
  const shipW = baseShipW * (overdriveActive ? 1.45 : 1);

  useEffect(() => {
    onScore(score, killed);
  }, [killed, onScore, score]);

  useEffect(() => {
    if (paused || ended.current) return;
    let frame = 0;
    let last = Date.now();

    const finish = () => {
      if (ended.current) return;
      ended.current = true;
      sfxRef.current('inv_die');
      onGameOver({
        score: scoreRef.current,
        bestMetric: killedRef.current,
        durationSec: Math.round((Date.now() - startMs.current) / 1000),
      });
    };

    const pickFocus = (pool: Alien[]) => {
      if (!pool.length) return;
      const fortresses = pool.filter((a) => a.kind === 4);
      const from = fortresses.length ? fortresses : pool;
      const pick = from[Math.floor(Math.random() * from.length)]!;
      focusRef.current = pick.id;
      setFocusId(pick.id);
    };

    const tick = () => {
      if (ended.current) return;
      const now = Date.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const boosted = now < overdriveRef.current;
      const curShipW = baseShipW * (boosted ? 1.45 : 1);
      const follow = boosted ? 1 : 0.55;
      const targetX = Math.max(8, Math.min(width - curShipW - 8, pointerX.current - curShipW / 2));
      const sx = shipXRef.current + (targetX - shipXRef.current) * Math.min(1, follow + dt * 8);
      shipXRef.current = sx;
      setShipX(sx);

      fireCd.current = Math.max(0, fireCd.current - dt);
      if (wantFire.current && fireCd.current <= 0) {
        fireCd.current = level.fireMs / 1000;
        seq += 1;
        bulletsRef.current = [
          ...bulletsRef.current,
          { id: `b-${seq}`, x: sx + curShipW / 2, y: shipY, vx: 0, vy: -420, friendly: true },
        ];
        sfxRef.current('inv_shoot');
      }

      const speed = level.speed * (1 + stageRef.current * 0.08);
      stepAcc.current += dt;
      const stepEvery = Math.max(0.2, 0.55 - stageRef.current * 0.02);
      let nextAliens = aliensRef.current;
      if (stepAcc.current >= stepEvery) {
        stepAcc.current = 0;
        const alive = nextAliens.filter((a) => a.alive);
        if (alive.length) {
          const minC = Math.min(...alive.map((a) => a.col));
          const maxC = Math.max(...alive.map((a) => a.col));
          const left = originX.current + minC * cell;
          const right = originX.current + (maxC + 1) * cell;
          let drop = false;
          if (dir.current > 0 && right + speed * stepEvery > width - 8) {
            dir.current = -1;
            drop = true;
          } else if (dir.current < 0 && left - speed * stepEvery < 8) {
            dir.current = 1;
            drop = true;
          }
          if (drop) originY.current += cell * 0.55;
          else originX.current += dir.current * Math.max(6, speed * stepEvery * 0.35);
        }
      }

      bombAcc.current += dt;
      let nextBullets = bulletsRef.current
        .map((b) => ({ ...b, x: b.x + b.vx * dt, y: b.y + b.vy * dt }))
        .filter((b) => b.y > -40 && b.y < height + 20 && b.x > -40 && b.x < width + 40);

      let nextDrops = dropsRef.current
        .map((d) => ({ ...d, y: d.y + DROP_FALL * dt }))
        .filter((d) => d.y < height + 30);

      let nextBunkers = [...bunkersRef.current];

      if (bombAcc.current >= level.bombEvery) {
        bombAcc.current = 0;
        const shooters = nextAliens.filter((a) => a.alive);
        if (shooters.length) {
          const a = shooters[Math.floor(Math.random() * shooters.length)]!;
          seq += 1;
          nextBullets.push({
            id: `bb-${seq}`,
            x: originX.current + a.col * cell + cell / 2,
            y: originY.current + a.row * cell + cell,
            vx: 0,
            vy: 180 + stageRef.current * 10,
            friendly: false,
          });
          sfxRef.current('inv_bomb');
        }
      }

      focusAcc.current += dt;
      if (focusAcc.current > 4.5 || !focusRef.current) {
        focusAcc.current = 0;
        pickFocus(nextAliens.filter((a) => a.alive));
      }

      let nextScore = scoreRef.current;
      let nextKilled = killedRef.current;

      const applyAlienDamage = (
        pool: Alien[],
        pred: (a: Alien) => boolean,
        amount: number,
      ): Alien[] =>
        pool.map((a) => {
          if (!a.alive || !pred(a)) return a;
          const hp = a.hp - amount;
          if (hp <= 0) {
            const bonus = a.id === focusRef.current ? 40 : 0;
            nextScore += 10 * a.maxHp + bonus;
            nextKilled += 1;
            if (a.id === focusRef.current) {
              focusRef.current = null;
              setFocusId(null);
            }
            return { ...a, hp: 0, alive: false };
          }
          return { ...a, hp };
        });

      const spawnDrop = (ax: number, ay: number, eye: EyeSide) => {
        seq += 1;
        nextDrops.push({
          id: `d-${seq}`,
          kind: pickPowerKind(),
          eye,
          x: ax + cell / 2,
          y: ay + cell / 2,
        });
        killsSinceDrop.current = 0;
        sfxRef.current(POWER_SPAWN_SFX);
      };

      // Power pickup
      const remainingDrops: PowerDrop[] = [];
      for (const d of nextDrops) {
        if (
          d.y + ORB_R >= shipY &&
          d.y - ORB_R <= shipY + shipH &&
          d.x >= sx - 8 &&
          d.x <= sx + curShipW + 8
        ) {
          if (d.kind === 'repulsor') {
            originY.current = Math.max(24, originY.current - cell);
          } else if (d.kind === 'shield') {
            shieldRef.current = true;
            setHasShield(true);
          } else if (d.kind === 'overdrive') {
            const until = now + OVERDRIVE_MS;
            overdriveRef.current = until;
            setOverdriveUntil(until);
          } else if (d.kind === 'rocket') {
            const cx = sx + curShipW / 2;
            const spreads = [-110, -55, 0, 55, 110];
            for (const vx of spreads) {
              seq += 1;
              nextBullets.push({
                id: `rk-${seq}`,
                x: cx,
                y: shipY - 4,
                vx,
                vy: -520,
                friendly: true,
                rocket: true,
              });
            }
            sfxRef.current('inv_shoot');
          } else if (d.kind === 'bomb') {
            const shipCol = Math.round((sx + curShipW / 2 - originX.current) / cell);
            nextAliens = applyAlienDamage(
              nextAliens,
              (a) => Math.abs(a.col - shipCol) <= 1,
              2,
            );
            setBombFlash(0.55);
            sfxRef.current('inv_bomb');
          } else if (d.kind === 'swap') {
            const nextEye: EyeSide = shipEyeRef.current === 'left' ? 'right' : 'left';
            shipEyeRef.current = nextEye;
            setShipEye(nextEye);
            nextAliens = nextAliens.map((a) =>
              a.alive ? { ...a, eye: a.eye === 'left' ? 'right' : 'left' } : a,
            );
          }
          nextScore += 15;
          sfxRef.current(sfxForPowerKind(d.kind));
          continue;
        }
        remainingDrops.push(d);
      }
      nextDrops = remainingDrops;

      const kept: Bullet[] = [];

      const hitBunker = (bx: number, by: number, friendly: boolean) => {
        for (let i = 0; i < nextBunkers.length; i += 1) {
          const bk = nextBunkers[i]!;
          if (bx >= bk.x && bx <= bk.x + bk.w && by >= bk.y && by <= bk.y + bk.h) {
            const hp = bk.hp - 1;
            if (hp <= 0) nextBunkers = nextBunkers.filter((_, j) => j !== i);
            else nextBunkers = nextBunkers.map((b, j) => (j === i ? { ...b, hp } : b));
            if (!friendly) sfxRef.current('inv_hit');
            return true;
          }
        }
        return false;
      };

      for (const b of nextBullets) {
        if (hitBunker(b.x, b.y, b.friendly)) continue;

        if (!b.friendly) {
          if (b.y >= shipY && b.y <= shipY + shipH && b.x >= sx && b.x <= sx + curShipW) {
            if (shieldRef.current) {
              shieldRef.current = false;
              setHasShield(false);
              sfxRef.current('inv_hit');
              continue;
            }
            const left = livesRef.current - 1;
            livesRef.current = left;
            setLives(left);
            sfxRef.current('inv_die');
            if (left <= 0) {
              finish();
              return;
            }
            continue;
          }
          kept.push(b);
          continue;
        }

        let hit = false;
        const dmg = b.rocket ? 2 : 1;
        const pad = b.rocket ? 4 : 0;
        nextAliens = nextAliens.map((a) => {
          if (!a.alive || hit) return a;
          const ax = originX.current + a.col * cell;
          const ay = originY.current + a.row * cell;
          if (
            b.x >= ax - pad &&
            b.x <= ax + cell + pad &&
            b.y >= ay - pad &&
            b.y <= ay + cell * 0.8 + pad
          ) {
            hit = true;
            const hp = a.hp - dmg;
            if (hp <= 0) {
              const bonus = a.id === focusRef.current ? 40 : 0;
              nextScore += 10 * a.maxHp + bonus;
              nextKilled += 1;
              sfxRef.current('inv_hit');
              if (a.id === focusRef.current) {
                focusRef.current = null;
                setFocusId(null);
              }
              killsSinceDrop.current += 1;
              const forceDrop = killsSinceDrop.current >= 4;
              if (forceDrop || Math.random() < dropChanceForKind(a.kind)) {
                spawnDrop(ax, ay, a.eye);
              }
              return { ...a, hp: 0, alive: false };
            }
            sfxRef.current('inv_hit');
            return { ...a, hp };
          }
          return a;
        });
        if (!hit) kept.push(b);
      }

      const lowest = nextAliens
        .filter((a) => a.alive)
        .reduce((m, a) => Math.max(m, originY.current + (a.row + 1) * cell), 0);
      if (lowest >= shipY - 4) {
        finish();
        return;
      }

      if (!nextAliens.some((a) => a.alive)) {
        const nextStage = stageRef.current + 1;
        nextScore += 100;
        sfxRef.current('inv_wave');
        if (nextStage >= totalStages) {
          scoreRef.current = nextScore;
          killedRef.current = nextKilled;
          setScore(nextScore);
          setKilled(nextKilled);
          finish();
          return;
        }
        stageRef.current = nextStage;
        setStage(nextStage);
        const rebuilt = buildWave(difficulty, nextStage);
        nextAliens = rebuilt.aliens;
        originX.current = ox;
        originY.current = rebuilt.layout.topY;
        dir.current = 1;
        nextBunkers = makeBunkers(width, shipY, rebuilt.layout.bunkers);
        focusRef.current = null;
        setFocusId(null);
        focusAcc.current = 5;
        killsSinceDrop.current = 0;
        nextDrops = [];
      }

      aliensRef.current = nextAliens;
      bulletsRef.current = kept;
      dropsRef.current = nextDrops;
      bunkersRef.current = nextBunkers;
      scoreRef.current = nextScore;
      killedRef.current = nextKilled;
      setAliens(nextAliens);
      setBullets(kept);
      setDrops(nextDrops);
      setBunkers(nextBunkers);
      setScore(nextScore);
      setKilled(nextKilled);
      setBombFlash((f) => (f > 0 ? Math.max(0, f - dt * 1.4) : 0));
      setPulse((p) => (p + dt * 4) % (Math.PI * 2));

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [
    baseShipW,
    cell,
    difficulty,
    height,
    level,
    onGameOver,
    ox,
    paused,
    shipH,
    shipY,
    totalStages,
    width,
  ]);

  const pan = Gesture.Pan()
    .runOnJS(true)
    .onBegin((e) => {
      pointerX.current = e.x;
      wantFire.current = true;
    })
    .onUpdate((e) => {
      pointerX.current = e.x;
      wantFire.current = true;
    })
    .onEnd(() => {
      wantFire.current = false;
    });

  const tap = Gesture.Tap()
    .runOnJS(true)
    .onEnd((e) => {
      pointerX.current = e.x;
      wantFire.current = true;
      fireCd.current = 0;
    });

  const gesture = Gesture.Simultaneous(pan, tap);

  return (
    <GestureDetector gesture={gesture}>
      <View style={[styles.fill, { backgroundColor: boardBg }]}>
        <Canvas style={{ width, height, backgroundColor: boardBg }}>
          <Rect x={0} y={0} width={width} height={height} color={boardBg} />

          {aliens.map((a) => {
            if (!a.alive) return null;
            const x = originX.current + a.col * cell;
            const y = originY.current + a.row * cell;
            const fill = a.eye === 'left' ? leftColor : rightColor;
            const focused = a.id === focusId;
            const bump = focused ? 2 + Math.sin(pulse) * 1.5 : 0;
            const bw = 3 + bump;
            const path = alienPath(a.kind, x, y, cell);
            const damaged = a.hp < a.maxHp;
            return (
              <Group key={a.id} opacity={damaged ? 0.55 + (a.hp / a.maxHp) * 0.45 : 1}>
                {focused ? (
                  <RoundedRect
                    x={x + 2 - bw}
                    y={y + 2 - bw}
                    width={cell - 4 + bw * 2}
                    height={cell * 0.7 + bw * 2}
                    r={5}
                    color={focusColor}
                  />
                ) : null}
                <Path path={path} color={fill} />
              </Group>
            );
          })}

          {bunkers.map((bk) => (
            <Group key={bk.id} opacity={0.45 + (bk.hp / 3) * 0.55}>
              <RoundedRect x={bk.x} y={bk.y} width={bk.w} height={bk.h} r={3} color={shipColor} />
              <RoundedRect
                x={bk.x + 3}
                y={bk.y + 3}
                width={bk.w - 6}
                height={bk.h - 6}
                r={2}
                color={boardBg}
              />
            </Group>
          ))}

          {drops.map((d) => (
            <PowerOrb
              key={d.id}
              kind={d.kind}
              cx={d.x}
              cy={d.y}
              r={ORB_R}
              leftColor={leftColor}
              rightColor={rightColor}
              boardBg={boardBg}
              blinkT={Date.now() / 1000}
            />
          ))}

          {bullets.map((b) =>
            b.rocket ? (
              <Path
                key={b.id}
                path={Skia.PathBuilder.Make()
                  .moveTo(b.x, b.y - 10)
                  .lineTo(b.x + 5, b.y + 4)
                  .lineTo(b.x - 5, b.y + 4)
                  .close()
                  .detach()}
                color={shipColor}
              />
            ) : (
              <Rect
                key={b.id}
                x={b.x - 2}
                y={b.y - 6}
                width={4}
                height={10}
                color={b.friendly ? shipColor : focusColor}
              />
            ),
          )}

          {bombFlash > 0 ? (
            <Rect x={0} y={0} width={width} height={height} color={focusColor} opacity={bombFlash * 0.35} />
          ) : null}

          <RoundedRect x={shipX} y={shipY} width={shipW} height={shipH} r={4} color={shipColor} />
          <Rect x={shipX + shipW / 2 - 2} y={shipY - 6} width={4} height={8} color={shipColor} />
          {hasShield ? (
            <RoundedRect
              x={shipX - 3}
              y={shipY - 3}
              width={shipW + 6}
              height={shipH + 6}
              r={6}
              color={focusColor}
              opacity={0.35}
            />
          ) : null}
          {overdriveActive ? (
            <Rect
              x={shipX + 4}
              y={shipY + shipH + 2}
              width={shipW - 8}
              height={3}
              color={focusColor}
              opacity={0.7}
            />
          ) : null}

          {Array.from({ length: lives }).map((_, i) => (
            <Circle key={`life-${i}`} cx={16 + i * 14} cy={height - 14} r={5} color={shipColor} />
          ))}

          {Array.from({ length: totalStages }).map((_, i) => (
            <Rect
              key={`st-${i}`}
              x={width - 14 - (totalStages - 1 - i) * 5.5}
              y={10}
              width={4}
              height={7}
              color={shipColor}
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
