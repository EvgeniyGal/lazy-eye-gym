import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { insertSession } from '@/src/db/sessions';
import { getGame, type GameId } from '@/src/games/catalog';
import { useAppStore } from '@/src/state/AppStore';
import { colors, spacing } from '@/src/theme/tokens';
import type { GameResult } from '../types';
import { BreakerGame } from '../breaker/BreakerGame';
import { MazeGame } from '../maze/MazeGame';
import { PongGame } from '../pong/PongGame';
import { SnakeGame } from '../snake/SnakeGame';
import { TwentyFortyEightGame } from '../twenty48/TwentyFortyEightGame';

export function GameShell({ gameId }: { gameId: GameId }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { palette, activeProfile, getGameSettings } = useAppStore();
  const game = getGame(gameId)!;
  const settings = getGameSettings(gameId);

  const [paused, setPaused] = useState(false);
  const [score, setScore] = useState(0);
  const [metric, setMetric] = useState(0);
  const [ended, setEnded] = useState<GameResult | null>(null);
  const [runId, setRunId] = useState(0);
  const startedAt = useRef(new Date().toISOString());
  const startMs = useRef(Date.now());
  const savedRef = useRef(false);

  const boardBg = palette.background;
  const onLight = activeProfile.background === 'white';
  const hudFg = onLight ? '#111111' : colors.onSurface;
  const hudMuted = onLight ? '#444444' : colors.onSurfaceVariant;
  const hudBtnBg = onLight ? 'rgba(0,0,0,0.08)' : colors.surfaceHigh;

  const canvasH = Math.max(280, height - insets.top - insets.bottom - 120);

  const onScore = useCallback((s: number, m: number) => {
    setScore(s);
    setMetric(m);
  }, []);

  const onGameOver = useCallback(
    async (result: GameResult) => {
      setEnded(result);
      setPaused(true);
      if (savedRef.current) return;
      savedRef.current = true;
      await insertSession({
        gameId,
        startedAt: startedAt.current,
        endedAt: new Date().toISOString(),
        score: result.score,
        bestMetric: result.bestMetric,
        durationSec: result.durationSec,
        settingsJson: JSON.stringify(settings),
        profileSnapshotJson: JSON.stringify({
          profile: activeProfile,
        }),
      });
    },
    [activeProfile, gameId, settings],
  );

  const startFreshRun = useCallback(() => {
    savedRef.current = false;
    startedAt.current = new Date().toISOString();
    startMs.current = Date.now();
    setEnded(null);
    setPaused(false);
    setScore(0);
    setMetric(0);
    setRunId((id) => id + 1);
  }, []);

  useEffect(() => {
    savedRef.current = false;
    startedAt.current = new Date().toISOString();
    startMs.current = Date.now();
    setEnded(null);
    setPaused(false);
    setScore(0);
    setMetric(0);
    setRunId((id) => id + 1);
  }, [gameId]);

  const Scene = useMemo(() => {
    switch (gameId) {
      case '2048':
        return TwentyFortyEightGame;
      case 'pong':
        return PongGame;
      case 'maze':
        return MazeGame;
      case 'breaker':
        return BreakerGame;
      case 'snake':
        return SnakeGame;
      default:
        return TwentyFortyEightGame;
    }
  }, [gameId]);

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          backgroundColor: boardBg,
        },
      ]}
    >
      <View style={styles.hud}>
        <Pressable
          onPress={() => router.back()}
          style={[styles.iconBtn, { backgroundColor: hudBtnBg }]}
        >
          <Ionicons name="close" size={22} color={hudFg} />
        </Pressable>
        <View style={styles.hudCenter}>
          <Text style={[styles.hudTitle, { color: hudFg }]}>{game.shortTitle}</Text>
          <Text style={[styles.hudMeta, { color: hudMuted }]}>
            Score {score} · {game.metricLabel} {metric}
          </Text>
        </View>
        <Pressable
          onPress={() => setPaused((p) => !p)}
          style={[styles.iconBtn, { backgroundColor: hudBtnBg }]}
        >
          <Ionicons name={paused && !ended ? 'play' : 'pause'} size={20} color={hudFg} />
        </Pressable>
      </View>

      <View style={[styles.canvasWrap, { height: canvasH, backgroundColor: boardBg }]}>
        <Scene
          key={runId}
          gameId={gameId}
          width={width}
          height={canvasH}
          palette={palette}
          settings={settings}
          paused={paused || !!ended}
          onScore={onScore}
          onGameOver={onGameOver}
        />
      </View>

      {ended ? (
        <View style={[styles.overlay, { backgroundColor: onLight ? 'rgba(244,244,244,0.92)' : 'rgba(6,14,32,0.9)' }]}>
          <Text style={[styles.overlayTitle, { color: hudFg }]}>Session complete</Text>
          <Text style={[styles.overlayMeta, { color: hudMuted }]}>
            Score {ended.score} · {game.metricLabel} {ended.bestMetric} · {ended.durationSec}s
          </Text>
          <Pressable style={styles.primaryBtn} onPress={startFreshRun}>
            <Text style={styles.primaryBtnText}>Start again</Text>
          </Pressable>
          <Pressable
            style={[styles.secondaryBtn, { borderColor: onLight ? '#333' : colors.outline }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.secondaryBtnText, { color: hudFg }]}>Back to game setup</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  hud: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hudCenter: {
    flex: 1,
    alignItems: 'center',
  },
  hudTitle: {
    fontWeight: '700',
    fontSize: 16,
  },
  hudMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  canvasWrap: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  overlayTitle: {
    fontSize: 24,
    fontWeight: '800',
  },
  overlayMeta: {
    fontSize: 14,
    textAlign: 'center',
  },
  primaryBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 28,
    paddingVertical: 14,
    minWidth: 220,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: colors.onPrimary,
    fontWeight: '800',
  },
  secondaryBtn: {
    borderRadius: 999,
    borderWidth: 1.5,
    paddingHorizontal: 28,
    paddingVertical: 14,
    minWidth: 220,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontWeight: '700',
  },
});
