import { Canvas, Circle, Group, Path, Rect, Skia } from '@shopify/react-native-skia';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import type { EyeSide } from '@/src/anaglyph/color';
import { colorForEye } from '@/src/anaglyph/palette';
import type { GameSceneProps } from '../types';

/** Power-ups both paddles can grab to trick each other. */
type OrbKind = 'grow' | 'shrink' | 'turbo' | 'reverse';

type Side = 'player' | 'ai';

type Orb = {
  id: string;
  kind: OrbKind;
  eye: EyeSide;
  x: number;
  y: number;
  vx: number;
  vy: number;
};

type Buffs = {
  playerWideUntil: number;
  aiWideUntil: number;
  playerShrinkUntil: number;
  aiShrinkUntil: number;
  turboUntil: number;
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

const ORB_KINDS: OrbKind[] = ['grow', 'shrink', 'turbo', 'reverse'];

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

function emptyBuffs(): Buffs {
  return {
    playerWideUntil: 0,
    aiWideUntil: 0,
    playerShrinkUntil: 0,
    aiShrinkUntil: 0,
    turboUntil: 0,
  };
}

/** Cutout icons punched through the solid orb (drawn in optical background). */
function OrbIcon({
  kind,
  cx,
  cy,
  cut,
}: {
  kind: OrbKind;
  cx: number;
  cy: number;
  cut: string;
}) {
  if (kind === 'grow') {
    return (
      <Group>
        <Rect x={cx - 8} y={cy - 2.5} width={16} height={5} r={1.5} color={cut} />
        <Rect x={cx - 2.5} y={cy - 8} width={5} height={16} r={1.5} color={cut} />
      </Group>
    );
  }
  if (kind === 'shrink') {
    return <Rect x={cx - 9} y={cy - 2.5} width={18} height={5} r={1.5} color={cut} />;
  }
  if (kind === 'turbo') {
    // Two chevrons » pointing right
    const chevron = (ox: number) => {
      const p = Skia.Path.Make();
      p.moveTo(cx + ox - 4, cy - 8);
      p.lineTo(cx + ox + 4, cy);
      p.lineTo(cx + ox - 4, cy + 8);
      p.lineTo(cx + ox - 1, cy + 8);
      p.lineTo(cx + ox + 7, cy);
      p.lineTo(cx + ox - 1, cy - 8);
      p.close();
      return p;
    };
    return (
      <Group>
        <Path path={chevron(-5)} color={cut} />
        <Path path={chevron(2)} color={cut} />
      </Group>
    );
  }
  // reverse — ring + two arrowheads (cutout)
  const ring = Skia.Path.Make();
  ring.addCircle(cx, cy, 7.5);
  const tipA = Skia.Path.Make();
  tipA.moveTo(cx + 6, cy - 6);
  tipA.lineTo(cx + 11, cy - 1);
  tipA.lineTo(cx + 4, cy + 1);
  tipA.close();
  const tipB = Skia.Path.Make();
  tipB.moveTo(cx - 6, cy + 6);
  tipB.lineTo(cx - 11, cy + 1);
  tipB.lineTo(cx - 4, cy - 1);
  tipB.close();
  return (
    <Group>
      <Path path={ring} color={cut} style="stroke" strokeWidth={3.5} />
      <Path path={tipA} color={cut} />
      <Path path={tipB} color={cut} />
    </Group>
  );
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
  const orbR = 20;
  const baseSpeed = 220 * level.speed;
  const pointsToWin = level.pointsToWin;
  const aiLead = level.aiLead;
  const aiError = level.aiError;
  const aiSpeed = level.aiSpeed;

  const paddleEye = (settings.paddleEye as EyeSide) || 'left';
  const ballEyeSetting = (settings.ballEye as EyeSide) || 'right';
  const paddleColor = colorForEye(palette, paddleEye);
  const leftColor = colorForEye(palette, 'left');
  const rightColor = colorForEye(palette, 'right');
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
  const [buffs, setBuffs] = useState<Buffs>(() => emptyBuffs());
  const [ballEye, setBallEye] = useState<EyeSide>(ballEyeSetting);

  const startMs = useRef(Date.now());
  const ended = useRef(false);
  const pointerX = useRef(width / 2);
  const stateRef = useRef(state);
  const orbsRef = useRef(orbs);
  const buffsRef = useRef(buffs);
  const ballEyeRef = useRef(ballEye);
  const orbTimer = useRef(0);
  stateRef.current = state;
  orbsRef.current = orbs;
  buffsRef.current = buffs;
  ballEyeRef.current = ballEye;

  const ballColor = colorForEye(palette, ballEye);
  const aiPaddleColor = colorForEye(palette, ballEyeSetting);

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

    const flipBallColor = () => {
      const next: EyeSide = ballEyeRef.current === 'left' ? 'right' : 'left';
      ballEyeRef.current = next;
      setBallEye(next);
    };

    const applyOrb = (kind: OrbKind, collector: Side, s: State, now: number) => {
      const buff = { ...buffsRef.current };
      const until = now + 8000;
      if (kind === 'grow') {
        if (collector === 'player') buff.playerWideUntil = until;
        else buff.aiWideUntil = until;
      } else if (kind === 'shrink') {
        if (collector === 'player') buff.aiShrinkUntil = until;
        else buff.playerShrinkUntil = until;
      } else if (kind === 'turbo') {
        buff.turboUntil = now + 6000;
        const towardAi = collector === 'player';
        s.vy = towardAi ? -Math.abs(s.vy) * 1.25 : Math.abs(s.vy) * 1.25;
        s.vx *= 1.15;
      } else if (kind === 'reverse') {
        s.vx *= -1;
        s.vy *= -1;
      }
      buffsRef.current = buff;
      setBuffs(buff);
      flipBallColor();
    };

    const tick = () => {
      if (ended.current) return;
      const now = Date.now();
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;

      const buff = buffsRef.current;
      let playerW = basePaddleW;
      let aiW = basePaddleW;
      if (now < buff.playerWideUntil) playerW *= 1.5;
      if (now < buff.aiWideUntil) aiW *= 1.5;
      if (now < buff.playerShrinkUntil) playerW *= 0.55;
      if (now < buff.aiShrinkUntil) aiW *= 0.55;
      const turbo = now < buff.turboUntil ? 1.35 : 1;

      let s = { ...stateRef.current };
      s.playerX = Math.max(0, Math.min(width - playerW, pointerX.current - playerW / 2));

      let aiTargetX = s.ballX + s.vx * aiLead * (height / Math.max(80, Math.abs(s.vy)));
      const nearbyOrb = orbsRef.current.find(
        (o) => o.y < height * 0.45 && Math.abs(o.x - (s.aiX + aiW / 2)) < 120,
      );
      if (nearbyOrb && Math.random() > 0.35) {
        aiTargetX = nearbyOrb.x;
      }
      const aiTarget = aiTargetX - aiW / 2 + (Math.random() - 0.5) * aiError;
      if (s.aiX < aiTarget) s.aiX = Math.min(aiTarget, s.aiX + aiSpeed * dt);
      if (s.aiX > aiTarget) s.aiX = Math.max(aiTarget, s.aiX - aiSpeed * dt);
      s.aiX = Math.max(0, Math.min(width - aiW, s.aiX));

      const rallyBoost = 1 + Math.min(0.75, s.rally * 0.04);
      s.ballX += s.vx * dt * turbo * rallyBoost;
      s.ballY += s.vy * dt * turbo * rallyBoost;

      if (s.ballX <= ballR || s.ballX >= width - ballR) s.vx *= -1;
      s.ballX = Math.max(ballR, Math.min(width - ballR, s.ballX));

      const aiPadY = 28;
      const playerPadY = height - 36 - paddleH;

      if (
        s.ballY - ballR <= aiPadY + paddleH &&
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

      if (
        s.ballY + ballR >= playerPadY &&
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

      orbTimer.current += dt;
      let nextOrbs = orbsRef.current.map((o) => ({
        ...o,
        x: o.x + o.vx * dt,
        y: o.y + o.vy * dt,
      }));
      nextOrbs = nextOrbs.map((o) => {
        if (o.x < orbR || o.x > width - orbR) {
          return { ...o, vx: -o.vx, x: Math.max(orbR, Math.min(width - orbR, o.x)) };
        }
        return o;
      });

      if (orbTimer.current > 5.5 && nextOrbs.length < 3) {
        orbTimer.current = 0;
        orbSeq += 1;
        const towardPlayer = Math.random() > 0.5;
        nextOrbs.push({
          id: `orb-${orbSeq}`,
          kind: ORB_KINDS[Math.floor(Math.random() * ORB_KINDS.length)]!,
          eye: Math.random() > 0.5 ? 'left' : 'right',
          x: 48 + Math.random() * (width - 96),
          y: height * 0.5 + (towardPlayer ? -20 : 20),
          vx: (Math.random() - 0.5) * 60,
          vy: (towardPlayer ? 1 : -1) * (55 + Math.random() * 45),
        });
      }

      nextOrbs = nextOrbs.filter((o) => {
        if (o.y < -30 || o.y > height + 30) return false;

        const hitPlayer =
          o.y + orbR >= playerPadY &&
          o.y - orbR <= playerPadY + paddleH &&
          o.x >= s.playerX - 4 &&
          o.x <= s.playerX + playerW + 4;
        const hitAi =
          o.y - orbR <= aiPadY + paddleH &&
          o.y + orbR >= aiPadY &&
          o.x >= s.aiX - 4 &&
          o.x <= s.aiX + aiW + 4;

        // Only paddles claim power-ups — ball contact does nothing
        if (hitPlayer) {
          applyOrb(o.kind, 'player', s, now);
          return false;
        }
        if (hitAi) {
          applyOrb(o.kind, 'ai', s, now);
          return false;
        }
        return true;
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
  let playerW = basePaddleW;
  let aiW = basePaddleW;
  if (now < buffs.playerWideUntil) playerW *= 1.5;
  if (now < buffs.aiWideUntil) aiW *= 1.5;
  if (now < buffs.playerShrinkUntil) playerW *= 0.55;
  if (now < buffs.aiShrinkUntil) aiW *= 0.55;

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
          {pip(state.aiScore, 16, aiPaddleColor)}
          {pip(state.playerScore, height - 16, paddleColor)}

          {orbs.map((o) => {
            const fill = o.eye === 'left' ? leftColor : rightColor;
            return (
              <Group key={o.id}>
                {/* Solid dichoptic disc */}
                <Circle cx={o.x} cy={o.y} r={orbR} color={fill} />
                {/* Transparent cutout sign (optical background) */}
                <OrbIcon kind={o.kind} cx={o.x} cy={o.y} cut={boardBg} />
              </Group>
            );
          })}

          <Rect x={state.aiX} y={28} width={aiW} height={paddleH} color={aiPaddleColor} />
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
