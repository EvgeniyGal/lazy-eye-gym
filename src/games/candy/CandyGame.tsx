import { Canvas, Circle, Group, Rect, RoundedRect } from '@shopify/react-native-skia';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { colorForEye } from '@/src/anaglyph/palette';
import { useGameAudio } from '@/src/audio/useGameAudio';
import type { GameSceneProps } from '../types';
import {
  COLS,
  ROWS,
  adjacent,
  createBoard,
  eyeForKind,
  markFocus,
  movesFor,
  resolveBoard,
  swapCells,
  targetFor,
  type Cell,
  type DiffKey,
  type Kind,
} from './candyLogic';

function resolveDiff(settings: Record<string, string | number | boolean>): DiffKey {
  const raw = String(settings.difficulty ?? 'easy');
  if (raw === 'hard' || raw === 'extraHard') return raw;
  return 'easy';
}

const SHAPES: Record<Kind, 'circle' | 'square' | 'diamond'> = {
  0: 'circle',
  1: 'square',
  2: 'diamond',
  3: 'circle',
  4: 'square',
  5: 'diamond',
};

export function CandyGame({
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
  const target = targetFor(diff);

  const [board, setBoard] = useState<Cell[][]>(() => markFocus(createBoard()));
  const [moves, setMoves] = useState(movesFor(diff));
  const [cleared, setCleared] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<{ r: number; c: number } | null>(null);
  const [pulse, setPulse] = useState(0);
  const [clearsSinceFocus, setClearsSinceFocus] = useState(0);

  const startMs = useRef(Date.now());
  const ended = useRef(false);
  const boardRef = useRef(board);
  boardRef.current = board;

  const hudH = 36;
  const canvasH = height - hudH;
  const pad = 8;
  const cellSize = Math.min((width - pad * 2) / COLS, (canvasH - pad * 2) / ROWS);
  const gridW = cellSize * COLS;
  const gridH = cellSize * ROWS;
  const ox = (width - gridW) / 2;
  const oy = (canvasH - gridH) / 2;

  useEffect(() => {
    onScore(score, cleared);
  }, [cleared, onScore, score]);

  useEffect(() => {
    if (paused || ended.current) return;
    let frame = 0;
    let last = Date.now();
    const tick = () => {
      const now = Date.now();
      const dt = (now - last) / 1000;
      last = now;
      setPulse((p) => (p + dt * 4) % (Math.PI * 2));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [paused]);

  const finish = (won: boolean, nextScore: number, nextCleared: number) => {
    if (ended.current) return;
    ended.current = true;
    sfx(won ? 'brk_stage' : 't48_over');
    onGameOver({
      score: nextScore,
      bestMetric: nextCleared,
      durationSec: Math.round((Date.now() - startMs.current) / 1000),
    });
  };

  const applyResolved = (nextBoard: Cell[][], gain: number, clearedN: number) => {
    let b = nextBoard;
    let focusMeter = clearsSinceFocus + 1;
    if (focusMeter >= 8) {
      b = markFocus(b);
      focusMeter = 0;
    }
    setClearsSinceFocus(focusMeter);
    const nextCleared = cleared + clearedN;
    const nextScore = score + gain;
    setBoard(b);
    setCleared(nextCleared);
    setScore(nextScore);
    if (nextScore >= target) finish(true, nextScore + 200, nextCleared);
  };

  const trySwap = (r1: number, c1: number, r2: number, c2: number) => {
    if (ended.current || paused) return;
    if (!adjacent(r1, c1, r2, c2)) return;
    const swapped = swapCells(boardRef.current, r1, c1, r2, c2);
    const resolved = resolveBoard(swapped);
    if (!resolved.cleared) {
      sfx('ast_die');
      return;
    }
    const nextMoves = moves - 1;
    setMoves(nextMoves);
    sfx('t48_merge');
    const nextScore = score + resolved.scoreGain;
    const nextCleared = cleared + resolved.cleared;
    applyResolved(resolved.board, resolved.scoreGain, resolved.cleared);
    if (nextScore >= target) return;
    if (nextMoves <= 0) finish(false, nextScore, nextCleared);
  };

  const onTapCell = (r: number, c: number) => {
    if (!selected) {
      setSelected({ r, c });
      sfx('t48_move');
      return;
    }
    if (selected.r === r && selected.c === c) {
      setSelected(null);
      return;
    }
    trySwap(selected.r, selected.c, r, c);
    setSelected(null);
  };

  const tap = Gesture.Pan()
    .runOnJS(true)
    .onBegin((e) => {
      const c = Math.floor((e.x - ox) / cellSize);
      const r = Math.floor((e.y - oy) / cellSize);
      if (r >= 0 && c >= 0 && r < ROWS && c < COLS) onTapCell(r, c);
    })
    .onEnd((e) => {
      if (!selected) return;
      const c = Math.floor((e.x - ox) / cellSize);
      const r = Math.floor((e.y - oy) / cellSize);
      if (r >= 0 && c >= 0 && r < ROWS && c < COLS) {
        if (selected.r !== r || selected.c !== c) {
          trySwap(selected.r, selected.c, r, c);
          setSelected(null);
        }
      }
    });

  const colorFor = (kind: Kind) =>
    eyeForKind(kind) === 'left' ? leftColor : rightColor;

  return (
    <GestureDetector gesture={tap}>
      <View style={[styles.fill, { backgroundColor: boardBg }]}>
        <View style={[styles.hud, { height: hudH }]}>
          <Text style={[styles.hudText, { color: leftColor }]}>
            Score {score}/{target}
          </Text>
          <Text style={[styles.hudText, { color: rightColor }]}>Moves {moves}</Text>
        </View>
        <Canvas style={{ width, height: canvasH }}>
          <Rect x={0} y={0} width={width} height={canvasH} color={boardBg} />
          {board.map((row, r) =>
            row.map((tile, c) => {
              const x = ox + c * cellSize;
              const y = oy + r * cellSize;
              const fill = colorFor(tile.kind);
              const cx = x + cellSize / 2;
              const cy = y + cellSize / 2;
              const rad = cellSize * 0.32;
              const sel = selected?.r === r && selected?.c === c;
              const shape = SHAPES[tile.kind];
              return (
                <Group key={tile.id}>
                  {sel || tile.focus ? (
                    <RoundedRect
                      x={x + 2}
                      y={y + 2}
                      width={cellSize - 4}
                      height={cellSize - 4}
                      r={6}
                      color={eyeForKind(tile.kind) === 'left' ? rightColor : leftColor}
                      opacity={0.35 + (tile.focus ? Math.sin(pulse) * 0.2 : 0)}
                    />
                  ) : null}
                  {shape === 'circle' ? (
                    <Circle cx={cx} cy={cy} r={rad} color={fill} />
                  ) : shape === 'square' ? (
                    <RoundedRect
                      x={cx - rad}
                      y={cy - rad}
                      width={rad * 2}
                      height={rad * 2}
                      r={4}
                      color={fill}
                    />
                  ) : (
                    <Group transform={[{ translateX: cx }, { translateY: cy }, { rotate: Math.PI / 4 }]}>
                      <RoundedRect
                        x={-rad * 0.85}
                        y={-rad * 0.85}
                        width={rad * 1.7}
                        height={rad * 1.7}
                        r={3}
                        color={fill}
                      />
                    </Group>
                  )}
                  {tile.special === 'line' ? (
                    <Rect x={cx - 1.5} y={cy - rad} width={3} height={rad * 2} color={boardBg} />
                  ) : null}
                  {tile.special === 'bomb' ? (
                    <Circle cx={cx} cy={cy} r={rad * 0.35} color={boardBg} />
                  ) : null}
                </Group>
              );
            }),
          )}
        </Canvas>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  hud: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  hudText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
