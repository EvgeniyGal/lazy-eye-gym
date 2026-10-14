import { Canvas, Circle, Group, Rect, RoundedRect } from '@shopify/react-native-skia';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import type { EyeSide } from '@/src/anaglyph/color';
import { colorForEye } from '@/src/anaglyph/palette';
import { useGameAudio } from '@/src/audio/useGameAudio';
import type { GameSceneProps } from '../types';

type Alien = {
  id: string;
  col: number;
  row: number;
  eye: EyeSide;
  alive: boolean;
};

type Bullet = { id: string; x: number; y: number; vy: number; friendly: boolean };

const COLS = 8;
const LEVELS = {
  easy: { speed: 28, bombEvery: 2.4, lives: 5, rows: 4, fireMs: 320 },
  hard: { speed: 42, bombEvery: 1.6, lives: 3, rows: 5, fireMs: 260 },
  extraHard: { speed: 58, bombEvery: 1.05, lives: 2, rows: 6, fireMs: 210 },
} as const;

type LevelKey = keyof typeof LEVELS;

function resolveLevel(settings: Record<string, string | number | boolean>): LevelKey {
  const raw = String(settings.difficulty ?? 'easy');
  if (raw === 'hard' || raw === 'extraHard') return raw;
  return 'easy';
}

function makeWave(rows: number, wave: number): Alien[] {
  const list: Alien[] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      list.push({
        id: `a-${wave}-${r}-${c}`,
        col: c,
        row: r,
        eye: (r + c) % 2 === 0 ? 'left' : 'right',
        alive: true,
      });
    }
  }
  return list;
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

  const level = LEVELS[resolveLevel(settings)];
  const shipEye = (settings.shipEye as EyeSide) || 'left';
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
  const shipW = 36;
  const shipH = 14;

  const [lives, setLives] = useState<number>(level.lives);
  const [score, setScore] = useState(0);
  const [killed, setKilled] = useState(0);
  const [wave, setWave] = useState(0);
  const [shipX, setShipX] = useState(width / 2 - shipW / 2);
  const [aliens, setAliens] = useState<Alien[]>(() => makeWave(level.rows, 0));
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [pulse, setPulse] = useState(0);

  const startMs = useRef(Date.now());
  const ended = useRef(false);
  const dir = useRef(1);
  const originX = useRef(ox);
  const originY = useRef(40);
  const stepAcc = useRef(0);
  const bombAcc = useRef(0);
  const focusAcc = useRef(0);
  const fireCd = useRef(0);
  const pointerX = useRef(width / 2);
  const wantFire = useRef(false);

  const aliensRef = useRef(aliens);
  const bulletsRef = useRef(bullets);
  const livesRef = useRef(lives);
  const scoreRef = useRef(score);
  const killedRef = useRef(killed);
  const waveRef = useRef(wave);
  const focusRef = useRef(focusId);
  const shipXRef = useRef(shipX);

  aliensRef.current = aliens;
  bulletsRef.current = bullets;
  livesRef.current = lives;
  scoreRef.current = score;
  killedRef.current = killed;
  waveRef.current = wave;
  focusRef.current = focusId;
  shipXRef.current = shipX;

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

    const tick = () => {
      if (ended.current) return;
      const now = Date.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const sx = Math.max(8, Math.min(width - shipW - 8, pointerX.current - shipW / 2));
      shipXRef.current = sx;
      setShipX(sx);

      fireCd.current = Math.max(0, fireCd.current - dt);
      if (wantFire.current && fireCd.current <= 0) {
        fireCd.current = level.fireMs / 1000;
        seq += 1;
        bulletsRef.current = [
          ...bulletsRef.current,
          { id: `b-${seq}`, x: sx + shipW / 2, y: shipY, vy: -420, friendly: true },
        ];
        sfxRef.current('inv_shoot');
      }

      const speed = level.speed * (1 + waveRef.current * 0.12);
      stepAcc.current += dt;
      const stepEvery = Math.max(0.18, 0.55 - waveRef.current * 0.03);
      let nextAliens = aliensRef.current;
      if (stepAcc.current >= stepEvery) {
        stepAcc.current = 0;
        const alive = nextAliens.filter((a) => a.alive);
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

      bombAcc.current += dt;
      let nextBullets = bulletsRef.current
        .map((b) => ({ ...b, y: b.y + b.vy * dt }))
        .filter((b) => b.y > -20 && b.y < height + 20);

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
            vy: 180 + waveRef.current * 12,
            friendly: false,
          });
          sfxRef.current('inv_bomb');
        }
      }

      focusAcc.current += dt;
      if (focusAcc.current > 4.5 || !focusRef.current) {
        focusAcc.current = 0;
        const pool = nextAliens.filter((a) => a.alive);
        if (pool.length) {
          const pick = pool[Math.floor(Math.random() * pool.length)]!;
          focusRef.current = pick.id;
          setFocusId(pick.id);
        }
      }

      let nextScore = scoreRef.current;
      let nextKilled = killedRef.current;
      const kept: Bullet[] = [];
      for (const b of nextBullets) {
        if (!b.friendly) {
          if (
            b.y >= shipY &&
            b.y <= shipY + shipH &&
            b.x >= sx &&
            b.x <= sx + shipW
          ) {
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
        nextAliens = nextAliens.map((a) => {
          if (!a.alive || hit) return a;
          const ax = originX.current + a.col * cell;
          const ay = originY.current + a.row * cell;
          if (b.x >= ax && b.x <= ax + cell && b.y >= ay && b.y <= ay + cell * 0.75) {
            hit = true;
            const bonus = a.id === focusRef.current ? 40 : 0;
            nextScore += 10 + bonus;
            nextKilled += 1;
            sfxRef.current('inv_hit');
            if (a.id === focusRef.current) {
              focusRef.current = null;
              setFocusId(null);
            }
            return { ...a, alive: false };
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
        const nextWave = waveRef.current + 1;
        waveRef.current = nextWave;
        setWave(nextWave);
        nextAliens = makeWave(level.rows, nextWave);
        originX.current = ox;
        originY.current = 40;
        dir.current = 1;
        nextScore += 100;
        sfxRef.current('inv_wave');
      }

      aliensRef.current = nextAliens;
      bulletsRef.current = kept;
      scoreRef.current = nextScore;
      killedRef.current = nextKilled;
      setAliens(nextAliens);
      setBullets(kept);
      setScore(nextScore);
      setKilled(nextKilled);
      setPulse((p) => (p + dt * 4) % (Math.PI * 2));

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [cell, height, level, onGameOver, ox, paused, shipH, shipW, shipY, width]);

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
            const bodyX = x + 4;
            const bodyY = y + 5;
            const bodyW = cell - 8;
            const bodyH = cell * 0.52;
            return (
              <Group key={a.id}>
                {focused ? (
                  <Group>
                    <RoundedRect
                      x={bodyX - bw}
                      y={bodyY - bw}
                      width={bodyW + bw * 2}
                      height={bodyH + bw * 2}
                      r={5}
                      color={focusColor}
                    />
                    <RoundedRect
                      x={bodyX - 1}
                      y={bodyY - 1}
                      width={bodyW + 2}
                      height={bodyH + 2}
                      r={3}
                      color={boardBg}
                    />
                  </Group>
                ) : null}
                <RoundedRect x={bodyX} y={bodyY} width={bodyW} height={bodyH} r={3} color={fill} />
              </Group>
            );
          })}

          {bullets.map((b) => (
            <Rect
              key={b.id}
              x={b.x - 2}
              y={b.y - 6}
              width={4}
              height={10}
              color={b.friendly ? shipColor : focusColor}
            />
          ))}

          <RoundedRect x={shipX} y={shipY} width={shipW} height={shipH} r={4} color={shipColor} />
          <Rect x={shipX + shipW / 2 - 2} y={shipY - 6} width={4} height={8} color={shipColor} />

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
