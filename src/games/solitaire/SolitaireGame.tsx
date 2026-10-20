import {
  Canvas,
  Circle,
  Group,
  Path,
  Rect,
  RoundedRect,
  Skia,
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
  tryMove,
  drawStock,
  type DiffKey,
  type GameState,
  type Sel,
  type Suit,
} from './solitaireLogic';

/** Skia paths — Helvetica/sans often mis-render Unicode ♥♦♣♠. */
function SuitMark({
  suit,
  cx,
  cy,
  size,
  color,
}: {
  suit: Suit;
  cx: number;
  cy: number;
  size: number;
  color: string;
}) {
  const s = size;
  if (suit === 'D') {
    return (
      <Path
        path={Skia.PathBuilder.Make()
          .moveTo(cx, cy - s)
          .lineTo(cx + s * 0.72, cy)
          .lineTo(cx, cy + s)
          .lineTo(cx - s * 0.72, cy)
          .close()
          .detach()}
        color={color}
      />
    );
  }
  if (suit === 'H') {
    const r = s * 0.42;
    return (
      <Group>
        <Circle cx={cx - r * 0.85} cy={cy - r * 0.35} r={r} color={color} />
        <Circle cx={cx + r * 0.85} cy={cy - r * 0.35} r={r} color={color} />
        <Path
          path={Skia.PathBuilder.Make()
            .moveTo(cx - s * 0.95, cy - r * 0.1)
            .lineTo(cx, cy + s * 0.95)
            .lineTo(cx + s * 0.95, cy - r * 0.1)
            .close()
            .detach()}
          color={color}
        />
      </Group>
    );
  }
  if (suit === 'S') {
    const r = s * 0.38;
    return (
      <Group>
        <Circle cx={cx - r * 0.85} cy={cy + r * 0.15} r={r} color={color} />
        <Circle cx={cx + r * 0.85} cy={cy + r * 0.15} r={r} color={color} />
        <Path
          path={Skia.PathBuilder.Make()
            .moveTo(cx - s * 0.9, cy + r * 0.25)
            .lineTo(cx, cy - s)
            .lineTo(cx + s * 0.9, cy + r * 0.25)
            .close()
            .detach()}
          color={color}
        />
        <Rect x={cx - s * 0.14} y={cy + s * 0.15} width={s * 0.28} height={s * 0.75} color={color} />
        <Path
          path={Skia.PathBuilder.Make()
            .moveTo(cx - s * 0.55, cy + s * 0.95)
            .lineTo(cx, cy + s * 0.45)
            .lineTo(cx + s * 0.55, cy + s * 0.95)
            .close()
            .detach()}
          color={color}
        />
      </Group>
    );
  }
  const r = s * 0.36;
  return (
    <Group>
      <Circle cx={cx} cy={cy - r * 0.95} r={r} color={color} />
      <Circle cx={cx - r * 0.95} cy={cy + r * 0.2} r={r} color={color} />
      <Circle cx={cx + r * 0.95} cy={cy + r * 0.2} r={r} color={color} />
      <Rect x={cx - s * 0.14} y={cy + s * 0.05} width={s * 0.28} height={s * 0.85} color={color} />
      <Path
        path={Skia.PathBuilder.Make()
          .moveTo(cx - s * 0.5, cy + s * 0.95)
          .lineTo(cx, cy + s * 0.4)
          .lineTo(cx + s * 0.5, cy + s * 0.95)
          .close()
          .detach()}
        color={color}
      />
    </Group>
  );
}

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

  const pad = 8;
  // Horizontal rows: 7 tableau lanes stacked vertically, cards fan left→right.
  const topH = Math.min(72, height * 0.16);
  const cardH = Math.min(64, Math.max(40, (height - topH - pad * 3) / 7 - 4));
  const cardW = Math.min(cardH / 1.35, 50);
  const topY = pad;
  const tabY0 = topY + topH + pad;
  const rowGap = Math.max(cardH + 4, (height - tabY0 - pad) / 7);
  const fanGap = Math.max(16, cardW * 0.38);

  const font = useMemo(
    () =>
      matchFont({
        fontFamily: Platform.select({ ios: 'Helvetica', default: 'sans-serif' })!,
        fontSize: Math.max(10, cardW * 0.34),
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
    const result = {
      score: nextScore,
      bestMetric: nextHome,
      durationSec: Math.round((Date.now() - startMs.current) / 1000),
    };
    setTimeout(() => {
      onGameOver(result);
      sfx('brk_stage');
    }, 0);
  };

  const applyState = (next: GameState, scoreDelta = 0) => {
    const h = cardsHome(next);
    const nextScore = score + scoreDelta;
    setState(next);
    setHome(h);
    setScore(nextScore);
    if (isWon(next)) finish(h, nextScore + 300);
  };

  const rowY = (col: number) => tabY0 + col * rowGap;

  const hitTest = (x: number, y: number): Hit | null => {
    if (x >= pad && x <= pad + cardW && y >= topY && y <= topY + cardH) return { kind: 'stock' };
    const wx = pad + cardW + 10;
    if (x >= wx && x <= wx + cardW && y >= topY && y <= topY + cardH) return { kind: 'waste' };
    for (let i = 0; i < 4; i += 1) {
      const fx = width - pad - (4 - i) * (cardW + 8);
      if (x >= fx && x <= fx + cardW && y >= topY && y <= topY + cardH) {
        return { kind: 'foundation', i };
      }
    }
    for (let col = 0; col < 7; col += 1) {
      const cy = rowY(col);
      if (y < cy || y > cy + cardH) continue;
      const pile = stateRef.current.tableau[col]!;
      if (!pile.length) {
        if (x >= pad && x <= pad + cardW + 24) return { kind: 'tableau', col, index: 0 };
        continue;
      }
      // Prefer topmost (rightmost) card under the tap.
      for (let i = pile.length - 1; i >= 0; i -= 1) {
        const cx = pad + i * fanGap;
        const w = i === pile.length - 1 ? cardW : fanGap;
        if (x >= cx && x <= cx + w) return { kind: 'tableau', col, index: i };
      }
      // Tap past the last card still targets this row (drop onto pile top).
      const lastX = pad + (pile.length - 1) * fanGap;
      if (x > lastX && x < width - pad) {
        return { kind: 'tableau', col, index: pile.length - 1 };
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

    // Dropping onto a tableau row always stacks onto that column's top.
    const dest: Sel =
      target.where === 'tableau'
        ? {
            where: 'tableau',
            col: target.col,
            index: Math.max(0, stateRef.current.tableau[target.col]!.length - 1),
          }
        : target;

    const moved = tryMove(stateRef.current, sel, dest);
    if (moved) {
      const delta = dest.where === 'foundation' ? 15 : 5;
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
    card: { suit: Suit; rank: number; faceUp: boolean; id: string },
    x: number,
    y: number,
    highlight: boolean,
  ) => {
    const color = card.faceUp ? (isRed(card.suit) ? leftColor : rightColor) : backColor;
    return (
      <Group key={`${card.id}-${x}-${y}`}>
        <RoundedRect
          x={x}
          y={y}
          width={cardW}
          height={cardH}
          r={5}
          color={color}
          opacity={card.faceUp ? 0.92 : 0.55}
        />
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
          <Group>
            <SkText
              x={x + 4}
              y={y + Math.max(12, cardW * 0.36)}
              text={rankLabel(card.rank)}
              font={font}
              color={boardBg}
            />
            <SuitMark
              suit={card.suit}
              cx={x + cardW * 0.55}
              cy={y + cardH * 0.58}
              size={cardW * 0.2}
              color={boardBg}
            />
          </Group>
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

          <RoundedRect
            x={pad}
            y={topY}
            width={cardW}
            height={cardH}
            r={5}
            color={backColor}
            opacity={state.stock.length ? 0.55 : 0.2}
          />

          {state.waste.length ? (
            drawCard(
              state.waste[state.waste.length - 1]!,
              pad + cardW + 10,
              topY,
              selectedMatch({ where: 'waste' }),
            )
          ) : (
            <RoundedRect
              x={pad + cardW + 10}
              y={topY}
              width={cardW}
              height={cardH}
              r={5}
              color={rightColor}
              opacity={0.15}
            />
          )}

          {state.foundations.map((pile, i) => {
            const fx = width - pad - (4 - i) * (cardW + 8);
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

          {state.tableau.map((pile, col) => {
            const cy = rowY(col);
            if (!pile.length) {
              return (
                <RoundedRect
                  key={`t-${col}`}
                  x={pad}
                  y={cy}
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
                    pad + index * fanGap,
                    cy,
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
