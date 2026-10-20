import {
  Canvas,
  Group,
  Rect,
  RoundedRect,
  Text as SkText,
  matchFont,
} from '@shopify/react-native-skia';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { colorForEye } from '@/src/anaglyph/palette';
import { useGameAudio } from '@/src/audio/useGameAudio';
import type { GameSceneProps } from '../types';
import {
  cardsHome,
  deal,
  isRed,
  isWon,
  peekCard,
  rankLabel,
  suitGlyph,
  tryMove,
  drawStock,
  type DiffKey,
  type GameState,
  type Sel,
} from './solitaireLogic';

function resolveDiff(settings: Record<string, string | number | boolean>): DiffKey {
  const raw = String(settings.difficulty ?? 'easy');
  if (raw === 'hard' || raw === 'extraHard') return raw;
  return 'easy';
}

type Hit =
  | { kind: 'stock' }
  | { kind: 'waste' }
  | { kind: 'foundation'; i: number }
  | { kind: 'tableau'; col: number; index: number };

export function SolitaireGame({
  width,
  height,
  palette,
  settings,
  paused,
  onScore,
  onGameOver,
}: GameSceneProps) {
  const { sfx } = useGameAudio(settings);
  const diff = resolveDiff(settings);
  const leftColor = colorForEye(palette, 'left');
  const rightColor = colorForEye(palette, 'right');
  const boardBg = palette.background;
  const backColor = colorForEye(palette, 'left');

  const [state, setState] = useState<GameState>(() => deal(diff));
  const [sel, setSel] = useState<Sel | null>(null);
  const [home, setHome] = useState(0);
  const [score, setScore] = useState(0);

  const startMs = useRef(Date.now());
  const ended = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const pad = 6;
  const cardW = Math.min(52, (width - pad * 8) / 7);
  const cardH = cardW * 1.4;
  const topY = 10;
  const tabY = topY + cardH + 16;
  const stackGap = Math.min(18, cardH * 0.28);

  const font = useMemo(
    () =>
      matchFont({
        fontFamily: Platform.select({ ios: 'Helvetica', default: 'sans-serif' })!,
        fontSize: Math.max(10, cardW * 0.32),
        fontWeight: '700',
      }),
    [cardW],
  );

  useEffect(() => {
    onScore(score, home);
  }, [home, onScore, score]);

  const finish = (nextHome: number, nextScore: number) => {
    if (ended.current) return;
    ended.current = true;
    sfx('brk_stage');
    onGameOver({
      score: nextScore,
      bestMetric: nextHome,
      durationSec: Math.round((Date.now() - startMs.current) / 1000),
    });
  };

  const applyState = (next: GameState, scoreDelta = 0) => {
    const h = cardsHome(next);
    const nextScore = score + scoreDelta;
    setState(next);
    setHome(h);
    setScore(nextScore);
    if (isWon(next)) finish(h, nextScore + 300);
  };

  const hitTest = (x: number, y: number): Hit | null => {
    // stock
    if (x >= pad && x <= pad + cardW && y >= topY && y <= topY + cardH) return { kind: 'stock' };
    // waste
    const wx = pad + cardW + 8;
    if (x >= wx && x <= wx + cardW && y >= topY && y <= topY + cardH) return { kind: 'waste' };
    // foundations
    for (let i = 0; i < 4; i += 1) {
      const fx = width - pad - (4 - i) * (cardW + 6);
      if (x >= fx && x <= fx + cardW && y >= topY && y <= topY + cardH) {
        return { kind: 'foundation', i };
      }
    }
    // tableau
    for (let col = 0; col < 7; col += 1) {
      const cx = pad + col * (cardW + pad);
      const pile = stateRef.current.tableau[col]!;
      if (!pile.length) {
        if (x >= cx && x <= cx + cardW && y >= tabY && y <= tabY + cardH) {
          return { kind: 'tableau', col, index: 0 };
        }
        continue;
      }
      for (let i = pile.length - 1; i >= 0; i -= 1) {
        const cy = tabY + i * stackGap;
        const h = i === pile.length - 1 ? cardH : stackGap;
        if (x >= cx && x <= cx + cardW && y >= cy && y <= cy + h) {
          return { kind: 'tableau', col, index: i };
        }
      }
    }
    return null;
  };

  const onTap = (x: number, y: number) => {
    if (ended.current || paused) return;
    const hit = hitTest(x, y);
    if (!hit) {
      setSel(null);
      return;
    }
    if (hit.kind === 'stock') {
      const next = drawStock(stateRef.current);
      if (next !== stateRef.current) {
        applyState(next, 0);
        sfx('t48_move');
      }
      setSel(null);
      return;
    }

    const asSel = (): Sel | null => {
      if (hit.kind === 'waste') return { where: 'waste' };
      if (hit.kind === 'foundation') return { where: 'foundation', i: hit.i };
      return { where: 'tableau', col: hit.col, index: hit.index };
    };

    const target = asSel();
    if (!target) return;

    if (!sel) {
      const card = peekCard(stateRef.current, target);
      if (!card || (target.where === 'tableau' && !card.faceUp)) return;
      // empty tableau tap without selection — ignore
      if (target.where === 'tableau') {
        const pile = stateRef.current.tableau[target.col]!;
        if (!pile.length) return;
      }
      if (target.where === 'foundation') {
        const pile = stateRef.current.foundations[target.i]!;
        if (!pile.length) return;
      }
      setSel(target);
      sfx('t48_move');
      return;
    }

    // auto foundation helper: double-tap same selection tries foundations
    if (
      sel.where === target.where &&
      ((sel.where === 'waste' && target.where === 'waste') ||
        (sel.where === 'tableau' &&
          target.where === 'tableau' &&
          sel.col === (target as { col: number }).col &&
          sel.index === (target as { index: number }).index))
    ) {
      const card = peekCard(stateRef.current, sel);
      if (card) {
        for (let i = 0; i < 4; i += 1) {
          const moved = tryMove(stateRef.current, sel, { where: 'foundation', i });
          if (moved) {
            applyState(moved, 15);
            sfx('t48_merge');
            setSel(null);
            return;
          }
        }
      }
      setSel(null);
      return;
    }

    const moved = tryMove(stateRef.current, sel, target);
    if (moved) {
      const delta = target.where === 'foundation' ? 15 : 5;
      applyState(moved, delta);
      sfx('t48_merge');
    } else {
      sfx('ast_die');
    }
    setSel(null);
  };

  const tap = Gesture.Tap()
    .runOnJS(true)
    .onEnd((e) => onTap(e.x, e.y));

  const drawCard = (
    card: { suit: import('./solitaireLogic').Suit; rank: number; faceUp: boolean; id: string },
    x: number,
    y: number,
    highlight: boolean,
  ) => {
    const color = card.faceUp ? (isRed(card.suit) ? leftColor : rightColor) : backColor;
    return (
      <Group key={`${card.id}-${x}-${y}`}>
        <RoundedRect x={x} y={y} width={cardW} height={cardH} r={5} color={color} opacity={card.faceUp ? 0.92 : 0.55} />
        <RoundedRect
          x={x + 2}
          y={y + 2}
          width={cardW - 4}
          height={cardH - 4}
          r={4}
          color={boardBg}
          opacity={card.faceUp ? 0.15 : 0.35}
        />
        {highlight ? (
          <RoundedRect
            x={x - 2}
            y={y - 2}
            width={cardW + 4}
            height={cardH + 4}
            r={6}
            color={rightColor}
            opacity={0.45}
          />
        ) : null}
        {card.faceUp ? (
          <SkText
            x={x + 4}
            y={y + cardH * 0.38}
            text={`${rankLabel(card.rank)}${suitGlyph(card.suit)}`}
            font={font}
            color={boardBg}
          />
        ) : null}
      </Group>
    );
  };

  const selectedMatch = (s: Sel) => {
    if (!sel) return false;
    if (sel.where !== s.where) return false;
    if (sel.where === 'waste') return true;
    if (sel.where === 'foundation' && s.where === 'foundation') return sel.i === s.i;
    if (sel.where === 'tableau' && s.where === 'tableau') {
      return sel.col === s.col && s.index >= sel.index;
    }
    return false;
  };

  return (
    <GestureDetector gesture={tap}>
      <View style={[styles.fill, { backgroundColor: boardBg }]}>
        <Canvas style={{ width, height }}>
          <Rect x={0} y={0} width={width} height={height} color={boardBg} />

          {/* stock */}
          <RoundedRect
            x={pad}
            y={topY}
            width={cardW}
            height={cardH}
            r={5}
            color={backColor}
            opacity={state.stock.length ? 0.55 : 0.2}
          />

          {/* waste */}
          {state.waste.length
            ? drawCard(
                state.waste[state.waste.length - 1]!,
                pad + cardW + 8,
                topY,
                selectedMatch({ where: 'waste' }),
              )
            : (
              <RoundedRect
                x={pad + cardW + 8}
                y={topY}
                width={cardW}
                height={cardH}
                r={5}
                color={rightColor}
                opacity={0.15}
              />
            )}

          {/* foundations */}
          {state.foundations.map((pile, i) => {
            const fx = width - pad - (4 - i) * (cardW + 6);
            if (!pile.length) {
              return (
                <RoundedRect
                  key={`f-${i}`}
                  x={fx}
                  y={topY}
                  width={cardW}
                  height={cardH}
                  r={5}
                  color={leftColor}
                  opacity={0.18}
                />
              );
            }
            return drawCard(
              pile[pile.length - 1]!,
              fx,
              topY,
              selectedMatch({ where: 'foundation', i }),
            );
          })}

          {/* tableau */}
          {state.tableau.map((pile, col) => {
            const cx = pad + col * (cardW + pad);
            if (!pile.length) {
              return (
                <RoundedRect
                  key={`t-${col}`}
                  x={cx}
                  y={tabY}
                  width={cardW}
                  height={cardH}
                  r={5}
                  color={rightColor}
                  opacity={0.12}
                />
              );
            }
            return (
              <Group key={`t-${col}`}>
                {pile.map((card, index) =>
                  drawCard(
                    card,
                    cx,
                    tabY + index * stackGap,
                    selectedMatch({ where: 'tableau', col, index }),
                  ),
                )}
              </Group>
            );
          })}
        </Canvas>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
