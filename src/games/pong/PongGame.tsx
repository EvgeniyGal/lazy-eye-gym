import {
  Canvas,
  Circle,
  Group,
  Rect,
  Text as SkText,
  matchFont,
} from '@shopify/react-native-skia';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
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

const ORB_GLYPH: Record<OrbKind, string> = {
  grow: '+',
  shrink: '−',
  turbo: '»',
  reverse: '↻',
};

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
  const orbR = 14;
  const baseSpeed = 220 * level.speed;
  const pointsToWin = level.pointsToWin;
  const aiLead = level.aiLead;
  const aiError = level.aiError;
  const aiSpeed = level.aiSpeed;

  const paddleEye = (settings.paddleEye as EyeSide) || 'left';
  const ballEye = (settings.ballEye as EyeSide) || 'right';
  const paddleColor = colorForEye(palette, paddleEye);
  const ballColor = colorForEye(palette, ballEye);
  const boardBg = palette.background;
  const neutral = palette.neutral;
  const onLight = boardBg === '#f4f4f4';
  const glyphColor = onLight ? '#111111' : '#f5f5f5';

  const glyphFont = useMemo(
    () =>
      matchFont({
        fontFamily: Platform.select({ ios: 'Helvetica', default: 'sans-serif' })!,
        fontSize: 16,
        fontWeight: '800',
      }),
    [],
  );

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

  const startMs = useRef(Date.now());
  const ended = useRef(false);
  const pointerX = useRef(width / 2);
  const stateRef = useRef(state);
  const orbsRef = useRef(orbs);
  const buffsRef = useRef(buffs);
  const orbTimer = useRef(0);
  stateRef.current = state;
  orbsRef.current = orbs;
  buffsRef.current = buffs;

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

    const applyOrb = (kind: OrbKind, collector: Side, s: State, now: number) => {
      const b = { ...buffsRef.current };
      const until = now + 8000;
      if (kind === 'grow') {
        if (collector === 'player') b.playerWideUntil = until;
        else b.aiWideUntil = until;
      } else if (kind === 'shrink') {
        // Shrink the opponent — the trick shot
        if (collector === 'player') b.aiShrinkUntil = until;
        else b.playerShrinkUntil = until;
      } else if (kind === 'turbo') {
        b.turboUntil = now + 6000;
        // Nudge ball toward the opponent
        const towardAi = collector === 'player';
        s.vy = towardAi ? -Math.abs(s.vy) * 1.25 : Math.abs(s.vy) * 1.25;
        s.vx *= 1.15;
      } else if (kind === 'reverse') {
        s.vx *= -1;
        s.vy *= -1;
      }
      buffsRef.current = b;
      setBuffs(b);
    };

    const tick = () => {
      if (ended.current) return;
      const now = Date.now();
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;

      const b = buffsRef.current;
      let playerW = basePaddleW;
      let aiW = basePaddleW;
      if (now < b.playerWideUntil) playerW *= 1.5;
      if (now < b.aiWideUntil) aiW *= 1.5;
      if (now < b.playerShrinkUntil) playerW *= 0.55;
      if (now < b.aiShrinkUntil) aiW *= 0.55;
      const turbo = now < b.turboUntil ? 1.35 : 1;

      let s = { ...stateRef.current };
      s.playerX = Math.max(0, Math.min(width - playerW, pointerX.current - playerW / 2));

      // Predictive AI — also steers toward nearby orbs when helpful
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

      // AI paddle (top)
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

      // Player paddle (bottom)
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

      // Scoring
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

      // Power orbs — drift both ways so either side can claim them
      orbTimer.current += dt;
      let nextOrbs = orbsRef.current.map((o) => ({
        ...o,
        x: o.x + o.vx * dt,
        y: o.y + o.vy * dt,
      }));
      nextOrbs = nextOrbs.map((o) => {
        if (o.x < orbR || o.x > width - orbR) return { ...o, vx: -o.vx, x: Math.max(orbR, Math.min(width - orbR, o.x)) };
        return o;
      });

      if (orbTimer.current > 5.5 && nextOrbs.length < 3) {
        orbTimer.current = 0;
        orbSeq += 1;
        const towardPlayer = Math.random() > 0.5;
        nextOrbs.push({
          id: `orb-${orbSeq}`,
          kind: ORB_KINDS[Math.floor(Math.random() * ORB_KINDS.length)]!,
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
        const hitBall = Math.hypot(o.x - s.ballX, o.y - s.ballY) < ballR + orbR;

        if (hitPlayer) {
          applyOrb(o.kind, 'player', s, now);
          return false;
        }
        if (hitAi) {
          applyOrb(o.kind, 'ai', s, now);
          return false;
        }
        if (hitBall) {
          // Ball claim goes to whoever the ball is moving toward (receiver is at risk / reward)
          const collector: Side = s.vy > 0 ? 'player' : 'ai';
          applyOrb(o.kind, collector, s, now);
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
          {pip(state.aiScore, 16, ballColor)}
          {pip(state.playerScore, height - 16, paddleColor)}

          {orbs.map((o) => {
            const glyph = ORB_GLYPH[o.kind];
            const tw = glyphFont.measureText(glyph).width;
            return (
              <Group key={o.id}>
                <Circle cx={o.x} cy={o.y} r={orbR} color={ballColor} opacity={0.9} />
                <Circle cx={o.x} cy={o.y} r={orbR - 3} color={boardBg} opacity={0.92} />
                <SkText
                  x={o.x - tw / 2}
                  y={o.y + 6}
                  text={glyph}
                  font={glyphFont}
                  color={glyphColor}
                />
              </Group>
            );
          })}

          <Rect x={state.aiX} y={28} width={aiW} height={paddleH} color={ballColor} />
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
