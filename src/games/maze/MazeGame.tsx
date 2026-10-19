import { Canvas, Circle, Group, Path, Rect, Skia } from '@shopify/react-native-skia';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import type { EyeSide } from '@/src/anaglyph/color';
import { colorForEye } from '@/src/anaglyph/palette';
import { disposeMazeSfx, initMazeSfx, playMazeSfx } from '@/src/audio/mazeSfx';
import { useT } from '@/src/i18n/I18nProvider';
import { useAppStore } from '@/src/state/AppStore';
import type { GameSceneProps } from '../types';
import {
  getMaze,
  mazeCols,
  mazeRows,
  pelletCells,
  scatterCorners,
  walkable,
  wrapC,
  type Dir,
  type MazeDef,
} from './mazes';

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

const GHOST_KINDS: GhostKind[] = ['chase', 'ambush', 'patrol', 'wander'];

const DIFFICULTY = {
  easy: { speedMul: 0.85, lives: 5, frightMs: 7500, ghostMul: 0.85 },
  hard: { speedMul: 1.15, lives: 3, frightMs: 5000, ghostMul: 1.05 },
  extraHard: { speedMul: 1.45, lives: 2, frightMs: 3200, ghostMul: 1.25 },
} as const;

type DifficultyKey = keyof typeof DIFFICULTY;

function resolveDifficulty(settings: Record<string, string | number | boolean>): DifficultyKey {
  const raw = String(settings.difficulty ?? 'easy');
  if (raw === 'hard' || raw === 'extraHard') return raw;
  return 'easy';
}

function dist(a: { r: number; c: number }, b: { r: number; c: number }) {
  return Math.hypot(a.r - b.r, a.c - b.c);
}

function ghostTarget(
  maze: MazeDef,
  g: Ghost,
  player: Actor,
  playerDir: Dir,
  mode: GhostMode,
): { r: number; c: number } {
  if (mode === 'eaten') return { ...maze.nest };
  if (mode === 'frightened') {
    return {
      r: Math.floor(Math.random() * mazeRows(maze)),
      c: Math.floor(Math.random() * mazeCols(maze)),
    };
  }
  if (mode === 'scatter') return scatterCorners(maze)[g.kind];
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

function chooseGhostDir(
  maze: MazeDef,
  g: Ghost,
  target: { r: number; c: number },
  frightened: boolean,
): Dir {
  const gr = Math.round(g.y);
  const gc = Math.round(g.x);
  const reverse = { x: -g.dir.x, y: -g.dir.y };
  let options = DIRS.filter((d) => {
    if (d.x === reverse.x && d.y === reverse.y && !frightened) return false;
    return walkable(maze, gr + d.y, gc + d.x, true);
  });
  if (!options.length) {
    options = DIRS.filter((d) => walkable(maze, gr + d.y, gc + d.x, true));
  }
  if (!options.length) return g.dir;
  if (frightened) return options[Math.floor(Math.random() * options.length)]!;
  let best = options[0]!;
  let bestD = Infinity;
  for (const d of options) {
    const nr = gr + d.y;
    const nc = wrapC(maze, nr, gc + d.x);
    const d2 = dist({ r: nr, c: nc }, target);
    if (d2 < bestD) {
      bestD = d2;
      best = d;
    }
  }
  return best;
}

function makeGhosts(maze: MazeDef): Ghost[] {
  return maze.ghostStarts.map((start, i) => ({
    kind: GHOST_KINDS[i] ?? 'wander',
    mode: 'scatter' as GhostMode,
    x: start.c,
    y: start.r,
    r: start.r,
    c: start.c,
    dir: { ...start.dir },
  }));
}

function actorAt(cell: { r: number; c: number }): Actor {
  return { r: cell.r, c: cell.c, x: cell.c, y: cell.r };
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
  const { t } = useT();
  const { prefs } = useAppStore();
  const maze = useMemo(() => getMaze(String(settings.maze ?? 'classic')), [settings.maze]);
  const difficulty = DIFFICULTY[resolveDifficulty(settings)];
  const rows = mazeRows(maze);
  const cols = mazeCols(maze);
  const scale = String(settings.scale ?? 'normal');
  const cell = (() => {
    const short = Math.min(width, height);
    const fit = Math.min(width / cols, height / rows);
    if (scale === 'small') return Math.max(10, fit * 0.96);
    if (scale === 'large') return Math.max(56, short / 4.5);
    // Normal — close-up follow camera (~7 tiles across)
    return Math.max(44, short / 7);
  })();
  const speed = 5.2 * difficulty.speedMul;
  // One setup control swaps both channels; actors always use the opposite eye.
  const wallEye: EyeSide = (() => {
    const channels = settings.channels;
    if (channels === 'wallsRight') return 'right';
    if (channels === 'wallsLeft') return 'left';
    return settings.wallEye === 'right' ? 'right' : 'left';
  })();
  const actorEye: EyeSide = wallEye === 'left' ? 'right' : 'left';
  const wallColor = colorForEye(palette, wallEye);
  const actorColor = colorForEye(palette, actorEye);
  const leftColor = colorForEye(palette, 'left');
  const rightColor = colorForEye(palette, 'right');
  const boardBg = palette.background;
  const startLives = difficulty.lives;
  const soundOn = Boolean(settings.sound ?? true) && prefs.soundEffects;

  const initialPellets = useMemo(() => pelletCells(maze), [maze]);

  const [player, setPlayer] = useState<Actor>(() => actorAt(maze.playerStart));
  const [ghosts, setGhosts] = useState<Ghost[]>(() => makeGhosts(maze));
  const [pellets, setPellets] = useState(initialPellets.pellets);
  const [powers, setPowers] = useState(initialPellets.powers);
  const [fruit, setFruit] = useState<{ r: number; c: number } | null>(null);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState<number>(startLives);
  const [frightenedUntil, setFrightenedUntil] = useState(0);
  const [mouthOpen, setMouthOpen] = useState(0.22);
  const [awaitingInput, setAwaitingInput] = useState(true);
  const [, setFrameTick] = useState(0);

  const dir = useRef<Dir>({ x: -1, y: 0 });
  const nextDir = useRef<Dir>({ x: -1, y: 0 });
  const startMs = useRef(Date.now());
  const sessionStarted = useRef(false);
  const ended = useRef(false);
  const modeClock = useRef(0);
  const scatterPhase = useRef(true);
  const pelletsLeftAtStart = useRef(initialPellets.pellets.length + initialPellets.powers.length);
  const fruitSpawned = useRef(false);
  const eatenCombo = useRef(0);
  const movingRef = useRef(false);
  const awaitingInputRef = useRef(true);
  const mazeRef = useRef(maze);
  const difficultyRef = useRef(difficulty);

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
  mazeRef.current = maze;
  difficultyRef.current = difficulty;

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
      const m = mazeRef.current;
      const p = actorAt(m.playerStart);
      const g = makeGhosts(m);
      playerRef.current = p;
      ghostsRef.current = g;
      setPlayer(p);
      setGhosts(g);
      dir.current = { x: -1, y: 0 };
      nextDir.current = { x: -1, y: 0 };
      movingRef.current = false;
      awaitingInputRef.current = true;
      setAwaitingInput(true);
      setFrightenedUntil(0);
      frightRef.current = 0;
      eatenCombo.current = 0;
    };

    const tick = () => {
      if (ended.current) return;
      const now = Date.now();
      if (awaitingInputRef.current) {
        last = now;
        frame = requestAnimationFrame(tick);
        return;
      }
      const m = mazeRef.current;
      const diff = difficultyRef.current;
      const mCols = mazeCols(m);
      acc += (now - last) / 1000;
      last = now;
      const levelSpeed = speed * (1 + (levelRef.current - 1) * 0.08);
      const step = 1 / (levelSpeed * 2.4);

      while (acc >= step) {
        acc -= step;
        modeClock.current += step;
        let justRespawned = false;

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
        const rc = wrapC(m, rr, Math.round(p.x));
        if (walkable(m, rr, rc)) {
          tr = rr;
          tc = rc;
        }
        const nearCenter = Math.abs(p.x - tc) < 0.28 && Math.abs(p.y - tr) < 0.28;
        const cur = dir.current;
        const isReverse = tryDir.x === -cur.x && tryDir.y === -cur.y && (tryDir.x !== 0 || tryDir.y !== 0);
        const canEnter = walkable(m, tr + tryDir.y, wrapC(m, tr + tryDir.y, tc + tryDir.x));

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
        const aheadC = wrapC(m, aheadR, tc + d.x);
        const aheadBlocked = !walkable(m, aheadR, aheadC);
        const moveStep = 0.2;

        let nx = p.x;
        let ny = p.y;

        if (aheadBlocked) {
          // Settle on the centre of the current path tile — never bounce into the wall
          const dx = tc - p.x;
          const dy = tr - p.y;
          const pullDist = Math.hypot(dx, dy);
          if (pullDist > 0.02) {
            const pull = Math.min(moveStep, pullDist);
            nx = p.x + (dx / pullDist) * pull;
            ny = p.y + (dy / pullDist) * pull;
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
          if (tr === m.tunnelRow || Math.round(ny) === m.tunnelRow) {
            if (nx < -0.5) nx = mCols - 0.5;
            if (nx > mCols - 0.5) nx = -0.5;
          }
          movingRef.current = true;
        }

        let nr = Math.round(ny);
        let nc = wrapC(m, nr, Math.round(nx));
        if (!walkable(m, nr, nc)) {
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
          const until = now + diff.frightMs;
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
          const f = { ...m.fruitCell };
          fruitRef.current = f;
          setFruit(f);
        }

        const stepGhost = (0.16 + levelRef.current * 0.01) * diff.ghostMul;
        const nextGhosts = ghostsRef.current.map((g) => {
          let mode: GhostMode = g.mode;
          if (g.mode === 'eaten') {
            if (Math.round(g.y) === m.nest.r && Math.round(g.x) === m.nest.c) mode = globalMode;
            else mode = 'eaten';
          } else if (frightened) mode = 'frightened';
          else mode = globalMode;

          const aligned =
            Math.abs(g.x - Math.round(g.x)) < 0.15 && Math.abs(g.y - Math.round(g.y)) < 0.15;
          let gdir = g.dir;
          if (aligned) {
            const target = ghostTarget(m, g, p, dir.current, mode);
            gdir = chooseGhostDir(m, { ...g, mode }, target, mode === 'frightened');
          }
          const spd =
            mode === 'frightened' ? stepGhost * 0.65 : mode === 'eaten' ? stepGhost * 1.6 : stepGhost;
          let gx = g.x + gdir.x * spd;
          let gy = g.y + gdir.y * spd;
          let gr = Math.round(gy);
          let gc = wrapC(m, gr, Math.round(gx));
          if (gr === m.tunnelRow) {
            if (gx < -0.5) gx = mCols - 0.5;
            if (gx > mCols - 0.5) gx = -0.5;
            gc = wrapC(m, gr, Math.round(gx));
          }
          if (!walkable(m, gr, gc, true)) {
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
            // Break the step loop (do not return — that stopped requestAnimationFrame)
            resetPositions();
            setPlayer(playerRef.current);
            setGhosts(ghostsRef.current);
            acc = 0;
            justRespawned = true;
            break;
          }
        }

        if (justRespawned) break;

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
          const fresh = pelletCells(m);
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

  const applyDir = (nx: number, ny: number) => {
    if (ended.current) return;
    if (awaitingInputRef.current) {
      awaitingInputRef.current = false;
      setAwaitingInput(false);
      if (!sessionStarted.current) {
        sessionStarted.current = true;
        startMs.current = Date.now();
      }
      dir.current = { x: nx, y: ny };
      const p = playerRef.current;
      const m = mazeRef.current;
      movingRef.current = walkable(m, p.r + ny, wrapC(m, p.r + ny, p.c + nx));
    }
    nextDir.current = { x: nx, y: ny };
  };

  const pan = Gesture.Pan()
    .runOnJS(true)
    .onEnd((e) => {
      const ax = Math.abs(e.translationX);
      const ay = Math.abs(e.translationY);
      if (ax < 10 && ay < 10) {
        if (awaitingInputRef.current) applyDir(dir.current.x || -1, dir.current.y);
        return;
      }
      if (ax > ay) {
        applyDir(e.translationX > 0 ? 1 : -1, 0);
      } else {
        applyDir(0, e.translationY > 0 ? 1 : -1);
      }
    });

  const tap = Gesture.Tap()
    .runOnJS(true)
    .onEnd(() => {
      applyDir(dir.current.x || -1, dir.current.y);
    });

  const gesture = Gesture.Exclusive(pan, tap);

  const frightened = Date.now() < frightenedUntil;

  // Camera: follow Pac-Man; clamp so small scale can show the whole maze centred
  const pacWorldX = player.x * cell + cell / 2;
  const pacWorldY = player.y * cell + cell / 2;
  const worldW = cols * cell;
  const worldH = rows * cell;
  const camX = (() => {
    if (worldW <= width) return (width - worldW) / 2;
    return Math.min(0, Math.max(width - worldW, width / 2 - pacWorldX));
  })();
  const camY = (() => {
    if (worldH <= height) return (height - worldH) / 2;
    return Math.min(0, Math.max(height - worldH, height / 2 - pacWorldY));
  })();

  const pacR = cell * 0.42;
  const pacPath = pacManPath(pacWorldX, pacWorldY, pacR, dir.current, mouthOpen);

  // Cull tiles roughly in view for weaker devices
  const pad = 2;
  const minC = Math.max(0, Math.floor((-camX) / cell) - pad);
  const maxC = Math.min(cols - 1, Math.ceil((width - camX) / cell) + pad);
  const minR = Math.max(0, Math.floor((-camY) / cell) - pad);
  const maxR = Math.min(rows - 1, Math.ceil((height - camY) / cell) + pad);

  return (
    <GestureDetector gesture={gesture}>
      <View style={[styles.fill, { backgroundColor: boardBg }]}>
        <Canvas style={{ width, height, backgroundColor: boardBg }}>
          <Rect x={0} y={0} width={width} height={height} color={boardBg} />
          <Group transform={[{ translateX: camX }, { translateY: camY }]}>
            {Array.from({ length: maxR - minR + 1 }, (_, i) => minR + i).map((r) =>
              Array.from({ length: maxC - minC + 1 }, (_, j) => minC + j).map((c) =>
                maze.grid[r]![c] === 1 ? (
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
              const gr = cell * 0.5;
              const fill = ghostFillColor(
                g.kind,
                g.mode,
                leftColor,
                rightColor,
                actorColor,
                Date.now(),
              );
              // Pupils glance toward movement
              const lookX = g.dir.x * cell * 0.07;
              const lookY = g.dir.y * cell * 0.07;
              const eyeY = cy - gr * 0.15;
              const eyeR = Math.max(3.5, cell * 0.11);
              const pupilR = Math.max(2.2, cell * 0.055);

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
        {awaitingInput && !paused ? (
          <View style={styles.hint} pointerEvents="none">
            <Text style={[styles.hintText, { color: actorColor }]}>{t('catalog.maze.swipeToStart')}</Text>
          </View>
        ) : null}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  hint: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintText: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.4,
    textAlign: 'center',
    paddingHorizontal: 24,
    opacity: 0.92,
  },
});
