import { Canvas, Circle, Group, Path, Rect, Skia } from '@shopify/react-native-skia';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import type { EyeSide } from '@/src/anaglyph/color';
import { colorForEye } from '@/src/anaglyph/palette';
import { disposeMazeSfx, initMazeSfx, playMazeSfx } from '@/src/audio/mazeSfx';
import { useAppStore } from '@/src/state/AppStore';
import type { GameSceneProps } from '../types';

/**
 * Classic-style maze: 1 = wall, 0 = path, 2 = nest door (walkable for ghosts leaving).
 * Left/right tunnels at mid row wrap.
 */
const MAZE: number[][] = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 0, 1],
  [1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1],
  [1, 1, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 1, 1],
  [1, 1, 1, 1, 0, 1, 0, 1, 1, 2, 1, 1, 0, 1, 0, 1, 1, 1, 1],
  [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
  [1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1],
  [1, 1, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 1, 1],
  [1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1],
  [1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
  [1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1],
  [1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  [1, 0, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 1, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

const ROWS = MAZE.length;
const COLS = MAZE[0]!.length;
const TUNNEL_ROW = 9;

type Dir = { x: number; y: number };
type GhostKind = 'chase' | 'ambush' | 'patrol' | 'wander';
type GhostMode = 'scatter' | 'chase' | 'frightened' | 'eaten';

type Actor = { x: number; y: number; r: number; c: number };
type Ghost = Actor & {
  kind: GhostKind;
  mode: GhostMode;
  dir: Dir;
};

const DIRS: Dir[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

const SCATTER_CORNERS: Record<GhostKind, { r: number; c: number }> = {
  chase: { r: 1, c: COLS - 2 },
  ambush: { r: 1, c: 1 },
  patrol: { r: ROWS - 2, c: COLS - 2 },
  wander: { r: ROWS - 2, c: 1 },
};

function walkable(r: number, c: number, forGhost = false) {
  if (r < 0 || r >= ROWS) return false;
  let cc = c;
  if (r === TUNNEL_ROW) {
    if (c < 0) cc = COLS - 1;
    if (c >= COLS) cc = 0;
  } else if (c < 0 || c >= COLS) return false;
  const cell = MAZE[r]![cc]!;
  if (cell === 0) return true;
  if (forGhost && cell === 2) return true;
  return false;
}

function wrapC(r: number, c: number) {
  if (r === TUNNEL_ROW) {
    if (c < 0) return COLS - 1;
    if (c >= COLS) return 0;
  }
  return c;
}

function pelletCells() {
  const pellets: { r: number; c: number }[] = [];
  const powers: { r: number; c: number }[] = [];
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      if (MAZE[r]![c] !== 0) continue;
      if (r >= 8 && r <= 11 && c >= 7 && c <= 11) continue;
      if (
        (r === 3 && c === 1) ||
        (r === 3 && c === COLS - 2) ||
        (r === 15 && c === 1) ||
        (r === 15 && c === COLS - 2)
      ) {
        powers.push({ r, c });
      } else {
        pellets.push({ r, c });
      }
    }
  }
  return { pellets, powers };
}

function dist(a: { r: number; c: number }, b: { r: number; c: number }) {
  return Math.hypot(a.r - b.r, a.c - b.c);
}

function ghostTarget(
  g: Ghost,
  player: Actor,
  playerDir: Dir,
  mode: GhostMode,
): { r: number; c: number } {
  if (mode === 'eaten') return { r: 9, c: 9 };
  if (mode === 'frightened') {
    return {
      r: Math.floor(Math.random() * ROWS),
      c: Math.floor(Math.random() * COLS),
    };
  }
  if (mode === 'scatter') return SCATTER_CORNERS[g.kind];
  if (g.kind === 'chase') return { r: player.r, c: player.c };
  if (g.kind === 'ambush') {
    return {
      r: Math.round(player.y + playerDir.y * 4),
      c: Math.round(player.x + playerDir.x * 4),
    };
  }
  if (g.kind === 'patrol') {
    const ahead = {
      r: Math.round(player.y + playerDir.y * 2),
      c: Math.round(player.x + playerDir.x * 2),
    };
    return {
      r: ahead.r * 2 - Math.round(g.y),
      c: ahead.c * 2 - Math.round(g.x),
    };
  }
  return {
    r: player.r + (Math.random() > 0.5 ? 2 : -2),
    c: player.c + (Math.random() > 0.5 ? 2 : -2),
  };
}

function chooseGhostDir(g: Ghost, target: { r: number; c: number }, frightened: boolean): Dir {
  const gr = Math.round(g.y);
  const gc = Math.round(g.x);
  const reverse = { x: -g.dir.x, y: -g.dir.y };
  let options = DIRS.filter((d) => {
    if (d.x === reverse.x && d.y === reverse.y && !frightened) return false;
    return walkable(gr + d.y, gc + d.x, true);
  });
  if (!options.length) {
    options = DIRS.filter((d) => walkable(gr + d.y, gc + d.x, true));
  }
  if (!options.length) return g.dir;
  if (frightened) return options[Math.floor(Math.random() * options.length)]!;
  let best = options[0]!;
  let bestD = Infinity;
  for (const d of options) {
    const nr = gr + d.y;
    const nc = wrapC(nr, gc + d.x);
    const d2 = dist({ r: nr, c: nc }, target);
    if (d2 < bestD) {
      bestD = d2;
      best = d;
    }
  }
  return best;
}

function makeGhosts(): Ghost[] {
  return [
    { kind: 'chase', mode: 'scatter', x: 9, y: 9, r: 9, c: 9, dir: { x: -1, y: 0 } },
    { kind: 'ambush', mode: 'scatter', x: 8, y: 9, r: 9, c: 8, dir: { x: 1, y: 0 } },
    { kind: 'patrol', mode: 'scatter', x: 10, y: 9, r: 9, c: 10, dir: { x: -1, y: 0 } },
    { kind: 'wander', mode: 'scatter', x: 9, y: 10, r: 10, c: 9, dir: { x: 0, y: -1 } },
  ];
}

function facingAngle(dir: Dir) {
  // Screen space: +x right, +y down — matches Math.atan2(y, x)
  return Math.atan2(dir.y, dir.x);
}

/**
 * Classic Pac-Man “beak”: pie wedge from centre with straight jaw lines
 * (mouthPhase 0 ≈ closed, 1 ≈ fully open ~90°).
 *
 * Skia oval arcs use degrees with 0° = east and positive sweep = clockwise,
 * so the body arc from the upper jaw must use a negative (CCW) sweep.
 */
function pacManPath(cx: number, cy: number, radius: number, dir: Dir, mouthPhase: number) {
  const facing = facingAngle(dir);
  const phase = Math.max(0, Math.min(1, mouthPhase));
  const half = 0.12 + phase * 0.72;
  const upper = facing - half;
  const startDeg = (upper * 180) / Math.PI;
  const bodySweepDeg = -(360 - (half * 2 * 180) / Math.PI);
  const oval = Skia.XYWHRect(cx - radius, cy - radius, radius * 2, radius * 2);
  const jx = cx + Math.cos(upper) * radius;
  const jy = cy + Math.sin(upper) * radius;
  return Skia.PathBuilder.Make()
    .moveTo(cx, cy)
    .lineTo(jx, jy)
    .arcToOval(oval, startDeg, bodySweepDeg, false)
    .lineTo(cx, cy)
    .close()
    .detach();
}

/** Classic ghost silhouette: dome head + wavy skirt. */
function ghostBodyPath(cx: number, cy: number, radius: number) {
  const left = cx - radius;
  const right = cx + radius;
  const dome = Skia.XYWHRect(left, cy - radius * 0.95, radius * 2, radius * 2);
  const midY = cy + radius * 0.2;
  const valley = cy + radius * 0.55;
  const tip = cy + radius * 0.98;
  const third = (radius * 2) / 3;
  let b = Skia.PathBuilder.Make()
    .moveTo(left, midY)
    .lineTo(left, cy)
    .arcToOval(dome, 180, -180, false)
    .lineTo(right, midY);
  // Three skirt scallops, right → left
  for (let i = 0; i < 3; i += 1) {
    const x0 = right - i * third;
    const x1 = right - (i + 0.5) * third;
    const x2 = right - (i + 1) * third;
    b = b.lineTo(x0, valley).lineTo(x1, tip).lineTo(x2, valley);
  }
  return b.lineTo(left, midY).close().detach();
}

/** Ambush + wander ghosts flicker between glass channels for dichoptic training. */
function ghostFlickers(kind: GhostKind) {
  return kind === 'ambush' || kind === 'wander';
}

function ghostFillColor(
  kind: GhostKind,
  mode: GhostMode,
  leftColor: string,
  rightColor: string,
  actorColor: string,
  now: number,
) {
  if (mode === 'frightened') {
    // Fast flash between channels while vulnerable
    return Math.floor(now / 140) % 2 === 0 ? leftColor : rightColor;
  }
  if (ghostFlickers(kind)) {
    return Math.floor(now / 260) % 2 === 0 ? leftColor : rightColor;
  }
  // Steady ghosts: chase on actor channel, patrol on the opposite
  return kind === 'patrol' ? leftColor : actorColor;
}

export function MazeGame({
  width,
  height,
  palette,
  settings,
  paused,
  onScore,
  onGameOver,
}: GameSceneProps) {
  const { prefs } = useAppStore();
  // ~2× previous on-screen scale: fit ~7 tiles across the short side
  const cell = Math.max(44, Math.min(width, height) / 7);
  const speed = 5.2 * Number(settings.speed ?? 1);
  const wallEye = (settings.wallEye as EyeSide) || 'left';
  const actorEye = (settings.actorEye as EyeSide) || 'right';
  const wallColor = colorForEye(palette, wallEye);
  const actorColor = colorForEye(palette, actorEye);
  const leftColor = colorForEye(palette, 'left');
  const rightColor = colorForEye(palette, 'right');
  const boardBg = palette.background;
  const startLives = Number(settings.lives ?? 3);
  const soundOn = Boolean(settings.sound ?? true) && prefs.soundEffects;

  const initialPellets = useMemo(() => pelletCells(), []);

  const [player, setPlayer] = useState<Actor>({ r: 15, c: 9, x: 9, y: 15 });
  const [ghosts, setGhosts] = useState<Ghost[]>(() => makeGhosts());
  const [pellets, setPellets] = useState(initialPellets.pellets);
  const [powers, setPowers] = useState(initialPellets.powers);
  const [fruit, setFruit] = useState<{ r: number; c: number } | null>(null);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(startLives);
  const [frightenedUntil, setFrightenedUntil] = useState(0);
  const [mouthOpen, setMouthOpen] = useState(0.45);
  const [, setFrameTick] = useState(0);

  const dir = useRef<Dir>({ x: -1, y: 0 });
  const nextDir = useRef<Dir>({ x: -1, y: 0 });
  const startMs = useRef(Date.now());
  const ended = useRef(false);
  const modeClock = useRef(0);
  const scatterPhase = useRef(true);
  const pelletsLeftAtStart = useRef(initialPellets.pellets.length + initialPellets.powers.length);
  const fruitSpawned = useRef(false);
  const eatenCombo = useRef(0);
  const movingRef = useRef(true);

  const playerRef = useRef(player);
  const ghostsRef = useRef(ghosts);
  const pelletsRef = useRef(pellets);
  const powersRef = useRef(powers);
  const fruitRef = useRef(fruit);
  const scoreRef = useRef(score);
  const levelRef = useRef(level);
  const livesRef = useRef(lives);
  const frightRef = useRef(frightenedUntil);
  const soundRef = useRef(soundOn);
  const hapticRef = useRef(prefs.hapticFeedback);

  playerRef.current = player;
  ghostsRef.current = ghosts;
  pelletsRef.current = pellets;
  powersRef.current = powers;
  fruitRef.current = fruit;
  scoreRef.current = score;
  levelRef.current = level;
  livesRef.current = lives;
  frightRef.current = frightenedUntil;
  soundRef.current = soundOn;
  hapticRef.current = prefs.hapticFeedback;

  const sfx = (name: Parameters<typeof playMazeSfx>[0]) =>
    playMazeSfx(name, {
      soundEnabled: soundRef.current,
      hapticEnabled: hapticRef.current,
    });

  useEffect(() => {
    void initMazeSfx();
    return () => disposeMazeSfx();
  }, []);

  useEffect(() => {
    onScore(score, level);
  }, [level, onScore, score]);

  // Mouth + camera refresh while moving
  useEffect(() => {
    if (paused || ended.current) return;
    let frame = 0;
    const tick = () => {
      if (movingRef.current) {
        // Classic chomp cycle 0 → open → closed
        const t = Date.now() / 95;
        setMouthOpen(0.5 + 0.5 * Math.sin(t));
      } else {
        // Resting beak — slightly open, not chewing the wall
        setMouthOpen(0.22);
      }
      setFrameTick((n) => n + 1);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [paused]);

  useEffect(() => {
    if (paused || ended.current) return;
    let frame = 0;
    let acc = 0;
    let last = Date.now();

    const resetPositions = () => {
      const p = { r: 15, c: 9, x: 9, y: 15 };
      const g = makeGhosts();
      playerRef.current = p;
      ghostsRef.current = g;
      setPlayer(p);
      setGhosts(g);
      dir.current = { x: -1, y: 0 };
      nextDir.current = { x: -1, y: 0 };
      setFrightenedUntil(0);
      frightRef.current = 0;
      eatenCombo.current = 0;
    };

    const tick = () => {
      if (ended.current) return;
      const now = Date.now();
      acc += (now - last) / 1000;
      last = now;
      const levelSpeed = speed * (1 + (levelRef.current - 1) * 0.08);
      const step = 1 / (levelSpeed * 2.4);

      while (acc >= step) {
        acc -= step;
        modeClock.current += step;

        if (modeClock.current > (scatterPhase.current ? 7 : 20)) {
          modeClock.current = 0;
          scatterPhase.current = !scatterPhase.current;
        }
        const globalMode: GhostMode = scatterPhase.current ? 'scatter' : 'chase';
        const frightened = now < frightRef.current;

        let p = { ...playerRef.current };
        const tryDir = nextDir.current;
        // Authoritative tile = last walkable cell (avoid rounding into a wall)
        let tr = p.r;
        let tc = p.c;
        const rr = Math.round(p.y);
        const rc = wrapC(rr, Math.round(p.x));
        if (walkable(rr, rc)) {
          tr = rr;
          tc = rc;
        }
        const nearCenter = Math.abs(p.x - tc) < 0.28 && Math.abs(p.y - tr) < 0.28;
        const cur = dir.current;
        const isReverse = tryDir.x === -cur.x && tryDir.y === -cur.y && (tryDir.x !== 0 || tryDir.y !== 0);
        const canEnter =
          walkable(tr + tryDir.y, wrapC(tr + tryDir.y, tc + tryDir.x));

        // Arcade turns: reverse anytime; corner turns only near tile centre.
        // Always snap onto the corridor centreline when the facing changes.
        if (canEnter && (isReverse || nearCenter)) {
          if (cur.x !== tryDir.x || cur.y !== tryDir.y) {
            dir.current = tryDir;
            if (tryDir.x !== 0) {
              p.y = tr;
              p.r = tr;
            } else {
              p.x = tc;
              p.c = tc;
            }
          }
        }

        const d = dir.current;
        const aheadR = tr + d.y;
        const aheadC = wrapC(aheadR, tc + d.x);
        const aheadBlocked = !walkable(aheadR, aheadC);
        const moveStep = 0.2;

        let nx = p.x;
        let ny = p.y;

        if (aheadBlocked) {
          // Settle on the centre of the current path tile — never bounce into the wall
          const dx = tc - p.x;
          const dy = tr - p.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 0.02) {
            const pull = Math.min(moveStep, dist);
            nx = p.x + (dx / dist) * pull;
            ny = p.y + (dy / dist) * pull;
            movingRef.current = true;
          } else {
            nx = tc;
            ny = tr;
            movingRef.current = false;
          }
        } else {
          nx = p.x + d.x * moveStep;
          ny = p.y + d.y * moveStep;
          // Stay glued to the tunnel centreline (prevents drift after turns)
          if (d.x !== 0) ny = tr;
          if (d.y !== 0) nx = tc;
          if (tr === TUNNEL_ROW || Math.round(ny) === TUNNEL_ROW) {
            if (nx < -0.5) nx = COLS - 0.5;
            if (nx > COLS - 0.5) nx = -0.5;
          }
          movingRef.current = true;
        }

        let nr = Math.round(ny);
        let nc = wrapC(nr, Math.round(nx));
        if (!walkable(nr, nc)) {
          nr = tr;
          nc = tc;
        }
        p = { r: nr, c: nc, x: nx, y: ny };
        playerRef.current = p;

        let nextPellets = pelletsRef.current;
        let nextPowers = powersRef.current;
        const atePellet = nextPellets.some((dot) => dot.r === nr && dot.c === nc);
        if (atePellet) {
          nextPellets = nextPellets.filter((dot) => !(dot.r === nr && dot.c === nc));
          pelletsRef.current = nextPellets;
          scoreRef.current += 10;
          setPellets(nextPellets);
          setScore(scoreRef.current);
          sfx('chomp');
        }
        const atePower = nextPowers.some((dot) => dot.r === nr && dot.c === nc);
        if (atePower) {
          nextPowers = nextPowers.filter((dot) => !(dot.r === nr && dot.c === nc));
          powersRef.current = nextPowers;
          setPowers(nextPowers);
          scoreRef.current += 50;
          setScore(scoreRef.current);
          const until = now + 6000;
          frightRef.current = until;
          setFrightenedUntil(until);
          eatenCombo.current = 0;
          sfx('power');
        }
        if (fruitRef.current && fruitRef.current.r === nr && fruitRef.current.c === nc) {
          fruitRef.current = null;
          setFruit(null);
          scoreRef.current += 100 * levelRef.current;
          setScore(scoreRef.current);
          sfx('fruit');
        }

        const remaining = nextPellets.length + nextPowers.length;
        if (!fruitSpawned.current && remaining <= pelletsLeftAtStart.current * 0.5) {
          fruitSpawned.current = true;
          const f = { r: 11, c: 9 };
          fruitRef.current = f;
          setFruit(f);
        }

        const stepGhost = 0.16 + levelRef.current * 0.01;
        const nextGhosts = ghostsRef.current.map((g) => {
          let mode: GhostMode = g.mode;
          if (g.mode === 'eaten') {
            if (Math.round(g.y) === 9 && Math.round(g.x) === 9) mode = globalMode;
            else mode = 'eaten';
          } else if (frightened) mode = 'frightened';
          else mode = globalMode;

          const aligned =
            Math.abs(g.x - Math.round(g.x)) < 0.15 && Math.abs(g.y - Math.round(g.y)) < 0.15;
          let gdir = g.dir;
          if (aligned) {
            const target = ghostTarget(g, p, dir.current, mode);
            gdir = chooseGhostDir({ ...g, mode }, target, mode === 'frightened');
          }
          const spd =
            mode === 'frightened' ? stepGhost * 0.65 : mode === 'eaten' ? stepGhost * 1.6 : stepGhost;
          let gx = g.x + gdir.x * spd;
          let gy = g.y + gdir.y * spd;
          let gr = Math.round(gy);
          let gc = wrapC(gr, Math.round(gx));
          if (gr === TUNNEL_ROW) {
            if (gx < -0.5) gx = COLS - 0.5;
            if (gx > COLS - 0.5) gx = -0.5;
            gc = wrapC(gr, Math.round(gx));
          }
          if (!walkable(gr, gc, true)) {
            gx = Math.round(g.x);
            gy = Math.round(g.y);
            gr = Math.round(gy);
            gc = Math.round(gx);
          }
          return { ...g, mode, dir: gdir, x: gx, y: gy, r: gr, c: gc };
        });

        for (let i = 0; i < nextGhosts.length; i += 1) {
          const g = nextGhosts[i]!;
          if (Math.hypot(g.x - p.x, g.y - p.y) >= 0.55) continue;
          if (g.mode === 'frightened') {
            nextGhosts[i] = { ...g, mode: 'eaten', x: g.x, y: g.y };
            eatenCombo.current += 1;
            scoreRef.current += 200 * eatenCombo.current;
            setScore(scoreRef.current);
            sfx('ghost');
          } else if (g.mode !== 'eaten') {
            const left = livesRef.current - 1;
            livesRef.current = left;
            setLives(left);
            sfx('death');
            if (left <= 0) {
              ended.current = true;
              onGameOver({
                score: scoreRef.current,
                bestMetric: levelRef.current,
                durationSec: Math.round((Date.now() - startMs.current) / 1000),
              });
              ghostsRef.current = nextGhosts;
              setGhosts(nextGhosts);
              setPlayer(p);
              return;
            }
            resetPositions();
            setPlayer(playerRef.current);
            setGhosts(ghostsRef.current);
            return;
          }
        }

        ghostsRef.current = nextGhosts;
        setGhosts(nextGhosts);
        setPlayer(p);

        if (nextPellets.length === 0 && nextPowers.length === 0) {
          const nextLevel = levelRef.current + 1;
          levelRef.current = nextLevel;
          setLevel(nextLevel);
          scoreRef.current += 500;
          setScore(scoreRef.current);
          sfx('level');
          const fresh = pelletCells();
          pelletsRef.current = fresh.pellets;
          powersRef.current = fresh.powers;
          setPellets(fresh.pellets);
          setPowers(fresh.powers);
          pelletsLeftAtStart.current = fresh.pellets.length + fresh.powers.length;
          fruitSpawned.current = false;
          fruitRef.current = null;
          setFruit(null);
          resetPositions();
          modeClock.current = 0;
          scatterPhase.current = true;
        }
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [onGameOver, paused, speed]);

  const pan = Gesture.Pan()
    .runOnJS(true)
    .onEnd((e) => {
      if (Math.abs(e.translationX) > Math.abs(e.translationY)) {
        nextDir.current = { x: e.translationX > 0 ? 1 : -1, y: 0 };
      } else {
        nextDir.current = { x: 0, y: e.translationY > 0 ? 1 : -1 };
      }
    });

  const frightened = Date.now() < frightenedUntil;

  // Camera: keep Pac-Man centred; world scrolls around him
  const pacWorldX = player.x * cell + cell / 2;
  const pacWorldY = player.y * cell + cell / 2;
  const camX = width / 2 - pacWorldX;
  const camY = height / 2 - pacWorldY;

  const pacR = cell * 0.42;
  const pacPath = pacManPath(pacWorldX, pacWorldY, pacR, dir.current, mouthOpen);

  // Cull tiles roughly in view for weaker devices
  const pad = 2;
  const minC = Math.max(0, Math.floor((-camX) / cell) - pad);
  const maxC = Math.min(COLS - 1, Math.ceil((width - camX) / cell) + pad);
  const minR = Math.max(0, Math.floor((-camY) / cell) - pad);
  const maxR = Math.min(ROWS - 1, Math.ceil((height - camY) / cell) + pad);

  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.fill, { backgroundColor: boardBg }]}>
        <Canvas style={{ width, height, backgroundColor: boardBg }}>
          <Rect x={0} y={0} width={width} height={height} color={boardBg} />
          <Group transform={[{ translateX: camX }, { translateY: camY }]}>
            {Array.from({ length: maxR - minR + 1 }, (_, i) => minR + i).map((r) =>
              Array.from({ length: maxC - minC + 1 }, (_, j) => minC + j).map((c) =>
                MAZE[r]![c] === 1 ? (
                  <Rect
                    key={`w-${r}-${c}`}
                    x={c * cell}
                    y={r * cell}
                    width={cell - 1}
                    height={cell - 1}
                    color={wallColor}
                  />
                ) : null,
              ),
            )}
            {pellets.map((d) => (
              <Circle
                key={`p-${d.r}-${d.c}`}
                cx={d.c * cell + cell / 2}
                cy={d.r * cell + cell / 2}
                r={Math.max(3, cell * 0.12)}
                color={actorColor}
              />
            ))}
            {powers.map((d) => (
              <Circle
                key={`pw-${d.r}-${d.c}`}
                cx={d.c * cell + cell / 2}
                cy={d.r * cell + cell / 2}
                r={Math.max(6, cell * 0.24)}
                color={actorColor}
              />
            ))}
            {fruit ? (
              <Rect
                x={fruit.c * cell + cell * 0.18}
                y={fruit.r * cell + cell * 0.18}
                width={cell * 0.64}
                height={cell * 0.64}
                color={actorColor}
              />
            ) : null}
            {ghosts.map((g, i) => {
              const cx = g.x * cell + cell / 2;
              const cy = g.y * cell + cell / 2;
              const gr = cell * 0.4;
              const fill = ghostFillColor(
                g.kind,
                g.mode,
                leftColor,
                rightColor,
                actorColor,
                Date.now(),
              );
              // Pupils glance toward movement
              const lookX = g.dir.x * cell * 0.06;
              const lookY = g.dir.y * cell * 0.06;
              const eyeY = cy - gr * 0.15;
              const eyeR = Math.max(3, cell * 0.09);
              const pupilR = Math.max(1.8, cell * 0.045);

              if (g.mode === 'eaten') {
                return (
                  <Group key={`g-${i}`}>
                    <Circle cx={cx - gr * 0.32} cy={eyeY} r={eyeR} color={boardBg} />
                    <Circle cx={cx + gr * 0.32} cy={eyeY} r={eyeR} color={boardBg} />
                    <Circle
                      cx={cx - gr * 0.32 + lookX}
                      cy={eyeY + lookY}
                      r={pupilR}
                      color={actorColor}
                    />
                    <Circle
                      cx={cx + gr * 0.32 + lookX}
                      cy={eyeY + lookY}
                      r={pupilR}
                      color={actorColor}
                    />
                  </Group>
                );
              }

              return (
                <Group key={`g-${i}`}>
                  <Path path={ghostBodyPath(cx, cy, gr)} color={fill} />
                  {/* Eye whites punched through with optical background */}
                  <Circle cx={cx - gr * 0.32} cy={eyeY} r={eyeR} color={boardBg} />
                  <Circle cx={cx + gr * 0.32} cy={eyeY} r={eyeR} color={boardBg} />
                  <Circle
                    cx={cx - gr * 0.32 + lookX}
                    cy={eyeY + lookY}
                    r={pupilR}
                    color={g.mode === 'frightened' ? fill : actorColor}
                  />
                  <Circle
                    cx={cx + gr * 0.32 + lookX}
                    cy={eyeY + lookY}
                    r={pupilR}
                    color={g.mode === 'frightened' ? fill : actorColor}
                  />
                </Group>
              );
            })}
            <Path path={pacPath} color={actorColor} />
          </Group>

          {/* HUD stays screen-fixed */}
          {Array.from({ length: lives }).map((_, i) => (
            <Circle
              key={`life-${i}`}
              cx={18 + i * 18}
              cy={height - 18}
              r={7}
              color={actorColor}
            />
          ))}
          {frightened ? (
            <Rect x={0} y={0} width={width} height={4} color={actorColor} opacity={0.55} />
          ) : null}
        </Canvas>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
