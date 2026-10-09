import { Canvas, Circle, Rect } from '@shopify/react-native-skia';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import type { EyeSide } from '@/src/anaglyph/color';
import { colorForEye } from '@/src/anaglyph/palette';
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
      // Nest area — no pellets
      if (r >= 8 && r <= 11 && c >= 7 && c <= 11) continue;
      // Power pellets in classic-ish corners
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
  // chase behaviours
  if (g.kind === 'chase') return { r: player.r, c: player.c };
  if (g.kind === 'ambush') {
    return {
      r: Math.round(player.y + playerDir.y * 4),
      c: Math.round(player.x + playerDir.x * 4),
    };
  }
  if (g.kind === 'patrol') {
    const ahead = { r: Math.round(player.y + playerDir.y * 2), c: Math.round(player.x + playerDir.x * 2) };
    return {
      r: ahead.r * 2 - Math.round(g.y),
      c: ahead.c * 2 - Math.round(g.x),
    };
  }
  // wander — soft chase with noise
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

export function MazeGame({
  width,
  height,
  palette,
  settings,
  paused,
  onScore,
  onGameOver,
}: GameSceneProps) {
  const cell = Math.min(width / COLS, (height - 8) / ROWS);
  const ox = (width - cell * COLS) / 2;
  const oy = (height - cell * ROWS) / 2;
  const speed = 5.2 * Number(settings.speed ?? 1);
  const wallEye = (settings.wallEye as EyeSide) || 'left';
  const actorEye = (settings.actorEye as EyeSide) || 'right';
  const wallColor = colorForEye(palette, wallEye);
  const actorColor = colorForEye(palette, actorEye);
  const boardBg = palette.background;
  const startLives = Number(settings.lives ?? 3);

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

  const dir = useRef<Dir>({ x: -1, y: 0 });
  const nextDir = useRef<Dir>({ x: -1, y: 0 });
  const startMs = useRef(Date.now());
  const ended = useRef(false);
  const modeClock = useRef(0);
  const scatterPhase = useRef(true);
  const pelletsLeftAtStart = useRef(initialPellets.pellets.length + initialPellets.powers.length);
  const fruitSpawned = useRef(false);
  const eatenCombo = useRef(0);

  const playerRef = useRef(player);
  const ghostsRef = useRef(ghosts);
  const pelletsRef = useRef(pellets);
  const powersRef = useRef(powers);
  const fruitRef = useRef(fruit);
  const scoreRef = useRef(score);
  const levelRef = useRef(level);
  const livesRef = useRef(lives);
  const frightRef = useRef(frightenedUntil);

  playerRef.current = player;
  ghostsRef.current = ghosts;
  pelletsRef.current = pellets;
  powersRef.current = powers;
  fruitRef.current = fruit;
  scoreRef.current = score;
  levelRef.current = level;
  livesRef.current = lives;
  frightRef.current = frightenedUntil;

  useEffect(() => {
    onScore(score, level);
  }, [level, onScore, score]);

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

        // Scatter / chase cycle (~7s scatter, ~20s chase)
        if (modeClock.current > (scatterPhase.current ? 7 : 20)) {
          modeClock.current = 0;
          scatterPhase.current = !scatterPhase.current;
        }
        const globalMode: GhostMode = scatterPhase.current ? 'scatter' : 'chase';
        const frightened = now < frightRef.current;

        // Player move
        let p = { ...playerRef.current };
        const tryDir = nextDir.current;
        const tr = Math.round(p.y);
        const tc = Math.round(p.x);
        const canTurn =
          walkable(tr + tryDir.y, wrapC(tr + tryDir.y, tc + tryDir.x)) &&
          Math.abs(p.x - tc) < 0.2 &&
          Math.abs(p.y - tr) < 0.2;
        if (canTurn) dir.current = tryDir;
        const d = dir.current;
        let nx = p.x + d.x * 0.2;
        let ny = p.y + d.y * 0.2;
        let nr = Math.round(ny);
        let nc = wrapC(nr, Math.round(nx));
        if (nr === TUNNEL_ROW) {
          if (nx < -0.5) nx = COLS - 0.5;
          if (nx > COLS - 0.5) nx = -0.5;
          nc = wrapC(nr, Math.round(nx));
        }
        if (!walkable(nr, nc)) {
          nx = tc;
          ny = tr;
          nr = tr;
          nc = tc;
        } else {
          nc = wrapC(nr, nc);
        }
        p = { r: nr, c: nc, x: nx, y: ny };
        playerRef.current = p;

        // Collect pellets / powers / fruit
        let nextPellets = pelletsRef.current;
        let nextPowers = powersRef.current;
        const atePellet = nextPellets.some((dot) => dot.r === nr && dot.c === nc);
        if (atePellet) {
          nextPellets = nextPellets.filter((dot) => !(dot.r === nr && dot.c === nc));
          pelletsRef.current = nextPellets;
          scoreRef.current += 10;
          setPellets(nextPellets);
          setScore(scoreRef.current);
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
        }
        if (fruitRef.current && fruitRef.current.r === nr && fruitRef.current.c === nc) {
          fruitRef.current = null;
          setFruit(null);
          scoreRef.current += 100 * levelRef.current;
          setScore(scoreRef.current);
        }

        // Spawn fruit when half pellets cleared
        const remaining = nextPellets.length + nextPowers.length;
        if (!fruitSpawned.current && remaining <= pelletsLeftAtStart.current * 0.5) {
          fruitSpawned.current = true;
          const f = { r: 11, c: 9 };
          fruitRef.current = f;
          setFruit(f);
        }

        // Ghosts
        const stepGhost = 0.16 + levelRef.current * 0.01;
        const nextGhosts = ghostsRef.current.map((g) => {
          let mode: GhostMode = g.mode;
          if (g.mode === 'eaten') {
            if (Math.round(g.y) === 9 && Math.round(g.x) === 9) mode = globalMode;
            else mode = 'eaten';
          } else if (frightened) mode = 'frightened';
          else mode = globalMode;

          const aligned = Math.abs(g.x - Math.round(g.x)) < 0.15 && Math.abs(g.y - Math.round(g.y)) < 0.15;
          let gdir = g.dir;
          if (aligned) {
            const target = ghostTarget(g, p, dir.current, mode);
            gdir = chooseGhostDir({ ...g, mode }, target, mode === 'frightened');
          }
          const spd = mode === 'frightened' ? stepGhost * 0.65 : mode === 'eaten' ? stepGhost * 1.6 : stepGhost;
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

        // Collisions
        for (let i = 0; i < nextGhosts.length; i += 1) {
          const g = nextGhosts[i]!;
          if (Math.hypot(g.x - p.x, g.y - p.y) >= 0.55) continue;
          if (g.mode === 'frightened') {
            nextGhosts[i] = { ...g, mode: 'eaten', x: g.x, y: g.y };
            eatenCombo.current += 1;
            scoreRef.current += 200 * eatenCombo.current;
            setScore(scoreRef.current);
          } else if (g.mode !== 'eaten') {
            const left = livesRef.current - 1;
            livesRef.current = left;
            setLives(left);
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
            ghostsRef.current = ghostsRef.current;
            setPlayer(playerRef.current);
            setGhosts(ghostsRef.current);
            return;
          }
        }

        ghostsRef.current = nextGhosts;
        setGhosts(nextGhosts);
        setPlayer(p);

        // Level clear
        if (nextPellets.length === 0 && nextPowers.length === 0) {
          const nextLevel = levelRef.current + 1;
          levelRef.current = nextLevel;
          setLevel(nextLevel);
          scoreRef.current += 500;
          setScore(scoreRef.current);
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

  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.fill, { backgroundColor: boardBg }]}>
        <Canvas style={{ width, height, backgroundColor: boardBg }}>
          <Rect x={0} y={0} width={width} height={height} color={boardBg} />
          {MAZE.map((row, r) =>
            row.map((v, c) =>
              v === 1 ? (
                <Rect
                  key={`w-${r}-${c}`}
                  x={ox + c * cell}
                  y={oy + r * cell}
                  width={cell - 0.5}
                  height={cell - 0.5}
                  color={wallColor}
                />
              ) : null,
            ),
          )}
          {pellets.map((d) => (
            <Circle
              key={`p-${d.r}-${d.c}`}
              cx={ox + d.c * cell + cell / 2}
              cy={oy + d.r * cell + cell / 2}
              r={Math.max(1.5, cell * 0.1)}
              color={actorColor}
            />
          ))}
          {powers.map((d) => (
            <Circle
              key={`pw-${d.r}-${d.c}`}
              cx={ox + d.c * cell + cell / 2}
              cy={oy + d.r * cell + cell / 2}
              r={Math.max(3, cell * 0.22)}
              color={actorColor}
            />
          ))}
          {fruit ? (
            <Rect
              x={ox + fruit.c * cell + cell * 0.2}
              y={oy + fruit.r * cell + cell * 0.2}
              width={cell * 0.6}
              height={cell * 0.6}
              color={actorColor}
            />
          ) : null}
          <Circle
            cx={ox + player.x * cell + cell / 2}
            cy={oy + player.y * cell + cell / 2}
            r={cell * 0.35}
            color={actorColor}
          />
          {ghosts.map((g, i) => (
            <Circle
              key={`g-${i}`}
              cx={ox + g.x * cell + cell / 2}
              cy={oy + g.y * cell + cell / 2}
              r={cell * (g.mode === 'frightened' ? 0.26 : g.mode === 'eaten' ? 0.18 : 0.32)}
              color={actorColor}
              opacity={g.mode === 'frightened' ? 0.45 : g.mode === 'eaten' ? 0.3 : 0.85}
            />
          ))}
          {Array.from({ length: lives }).map((_, i) => (
            <Circle
              key={`life-${i}`}
              cx={ox + 10 + i * 12}
              cy={oy + ROWS * cell + 6}
              r={4}
              color={actorColor}
            />
          ))}
          {frightened ? (
            <Rect
              x={ox}
              y={oy - 4}
              width={COLS * cell}
              height={2}
              color={actorColor}
              opacity={0.5}
            />
          ) : null}
        </Canvas>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
