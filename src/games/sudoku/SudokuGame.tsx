import {
  Canvas,
  Group,
  Rect,
  RoundedRect,
  Text as SkText,
  matchFont,
} from '@shopify/react-native-skia';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import type { EyeSide } from '@/src/anaglyph/color';
import { colorForEye } from '@/src/anaglyph/palette';
import { useGameAudio } from '@/src/audio/useGameAudio';
import type { GameSceneProps } from '../types';
import {
  conflicts,
  filledCount,
  generatePuzzle,
  isComplete,
  type DiffKey,
} from './sudokuLogic';

function resolveDiff(settings: Record<string, string | number | boolean>): DiffKey {
  const raw = String(settings.difficulty ?? 'easy');
  if (raw === 'hard' || raw === 'extraHard') return raw;
  return 'easy';
}

const MISTAKE_LIMIT: Record<DiffKey, number> = { easy: 99, hard: 5, extraHard: 3 };

export function SudokuGame({
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
  const [gridEye, setGridEye] = useState<EyeSide>((settings.gridEye as EyeSide) || 'left');
  const fillEye: EyeSide = gridEye === 'left' ? 'right' : 'left';
  const gridColor = colorForEye(palette, gridEye);
  const fillColor = colorForEye(palette, fillEye);
  const boardBg = palette.background;

  const initial = useMemo(() => generatePuzzle(diff), [diff]);
  const [clues] = useState(initial.clues);
  const [solution] = useState(initial.solution);
  const [board, setBoard] = useState(() => clues.map((row) => [...row]));
  const [selected, setSelected] = useState<{ r: number; c: number } | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [filled, setFilled] = useState(0);
  const [score, setScore] = useState(0);
  const [pulse, setPulse] = useState(0);

  const startMs = useRef(Date.now());
  const ended = useRef(false);
  const swapAcc = useRef(0);

  const padH = 72;
  const playH = height - padH;
  const cell = Math.min((width - 16) / 9, (playH - 16) / 9);
  const gridW = cell * 9;
  const ox = (width - gridW) / 2;
  const oy = (playH - gridW) / 2;

  const font = useMemo(
    () =>
      matchFont({
        fontFamily: Platform.select({ ios: 'Helvetica', default: 'sans-serif' })!,
        fontSize: Math.max(12, cell * 0.48),
        fontWeight: '700',
      }),
    [cell],
  );

  useEffect(() => {
    onScore(score, filled);
  }, [filled, onScore, score]);

  useEffect(() => {
    if (paused || ended.current) return;
    let frame = 0;
    let last = Date.now();
    const tick = () => {
      const now = Date.now();
      const dt = (now - last) / 1000;
      last = now;
      swapAcc.current += dt;
      if (swapAcc.current >= 45) {
        swapAcc.current = 0;
        setGridEye((e) => (e === 'left' ? 'right' : 'left'));
      }
      setPulse((p) => (p + dt * 4) % (Math.PI * 2));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [paused]);

  const finish = (won: boolean, nextFilled: number, nextScore: number) => {
    if (ended.current) return;
    ended.current = true;
    const result = {
      score: nextScore,
      bestMetric: nextFilled,
      durationSec: Math.round((Date.now() - startMs.current) / 1000),
    };
    setTimeout(() => {
      onGameOver(result);
      sfx(won ? 'brk_stage' : 't48_over');
    }, 0);
  };

  const placeDigit = (n: number) => {
    if (ended.current || !selected) return;
    const { r, c } = selected;
    if (clues[r]![c]) return;
    const next = board.map((row) => [...row]);
    if (n === 0) {
      next[r]![c] = 0;
      setBoard(next);
      const f = filledCount(next, clues);
      setFilled(f);
      return;
    }
    if (solution[r]![c] !== n) {
      const m = mistakes + 1;
      setMistakes(m);
      sfx('ast_die');
      if (m >= MISTAKE_LIMIT[diff]) {
        finish(false, filled, Math.max(0, score - 50));
      }
      return;
    }
    next[r]![c] = n;
    setBoard(next);
    const f = filledCount(next, clues);
    const elapsed = (Date.now() - startMs.current) / 1000;
    const nextScore = f * 15 + Math.max(0, Math.floor(500 - elapsed)) - mistakes * 20;
    setFilled(f);
    setScore(nextScore);
    sfx('t48_merge');
    if (isComplete(next, solution)) finish(true, f, nextScore + 250);
  };

  return (
    <View style={[styles.fill, { backgroundColor: boardBg }]}>
      <Pressable
        style={{ width, height: playH }}
        onPress={(e) => {
          const x = e.nativeEvent.locationX;
          const y = e.nativeEvent.locationY;
          const c = Math.floor((x - ox) / cell);
          const r = Math.floor((y - oy) / cell);
          if (r >= 0 && c >= 0 && r < 9 && c < 9) setSelected({ r, c });
        }}
      >
        <Canvas style={{ width, height: playH }}>
          <Rect x={0} y={0} width={width} height={playH} color={boardBg} />
          {Array.from({ length: 10 }).map((_, i) => {
            const thick = i % 3 === 0;
            return (
              <Group key={`line-${i}`}>
                <Rect
                  x={ox + i * cell}
                  y={oy}
                  width={thick ? 2.5 : 1}
                  height={gridW}
                  color={gridColor}
                  opacity={thick ? 0.95 : 0.45}
                />
                <Rect
                  x={ox}
                  y={oy + i * cell}
                  width={gridW}
                  height={thick ? 2.5 : 1}
                  color={gridColor}
                  opacity={thick ? 0.95 : 0.45}
                />
              </Group>
            );
          })}
          {board.map((row, r) =>
            row.map((val, c) => {
              const x = ox + c * cell;
              const y = oy + r * cell;
              const given = !!clues[r]![c];
              const sel = selected?.r === r && selected?.c === c;
              const bad = !given && val > 0 && conflicts(board, r, c);
              return (
                <Group key={`${r}-${c}`}>
                  {sel ? (
                    <RoundedRect
                      x={x + 2}
                      y={y + 2}
                      width={cell - 4}
                      height={cell - 4}
                      r={3}
                      color={fillColor}
                      opacity={0.25 + Math.sin(pulse) * 0.08}
                    />
                  ) : null}
                  {bad ? (
                    <RoundedRect
                      x={x + 3}
                      y={y + 3}
                      width={cell - 6}
                      height={cell - 6}
                      r={3}
                      color={fillColor}
                      opacity={0.35 + Math.sin(pulse * 2) * 0.2}
                    />
                  ) : null}
                  {val > 0 ? (
                    <SkText
                      x={x + cell * 0.32}
                      y={y + cell * 0.68}
                      text={String(val)}
                      font={font}
                      color={given ? gridColor : fillColor}
                    />
                  ) : null}
                </Group>
              );
            }),
          )}
        </Canvas>
      </Pressable>

      <View style={[styles.pad, { height: padH, width }]}>
        <View style={styles.padRow}>
          {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
            <Pressable
              key={n}
              style={[styles.key, { borderColor: fillColor, backgroundColor: fillColor }]}
              onPress={() => placeDigit(n)}
            >
              <Text style={[styles.keyText, { color: boardBg }]}>{n}</Text>
            </Pressable>
          ))}
          <Pressable
            style={[styles.key, styles.clearKey, { borderColor: gridColor }]}
            onPress={() => placeDigit(0)}
          >
            <Text style={[styles.keyText, { color: gridColor }]}>⌫</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  pad: {
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  padRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 4,
  },
  key: {
    width: 30,
    height: 36,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearKey: {
    backgroundColor: 'transparent',
    width: 36,
  },
  keyText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
