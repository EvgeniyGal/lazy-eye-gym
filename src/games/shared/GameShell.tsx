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
  const startedAt = useRef(new Date().toISOString());
  const startMs = useRef(Date.now());

  const canvasH = Math.max(280, height - insets.top - insets.bottom - 120);

  const onScore = useCallback((s: number, m: number) => {
    setScore(s);
    setMetric(m);
  }, []);

  const onGameOver = useCallback(
    async (result: GameResult) => {
      setEnded(result);
      setPaused(true);
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

  useEffect(() => {
    startedAt.current = new Date().toISOString();
    startMs.current = Date.now();
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
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.hud}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="close" size={22} color={colors.onSurface} />
        </Pressable>
        <View style={styles.hudCenter}>
          <Text style={styles.hudTitle}>{game.shortTitle}</Text>
          <Text style={styles.hudMeta}>
            Score {score} · {game.metricLabel} {metric}
          </Text>
        </View>
        <Pressable onPress={() => setPaused((p) => !p)} style={styles.iconBtn}>
          <Ionicons name={paused ? 'play' : 'pause'} size={20} color={colors.onSurface} />
        </Pressable>
      </View>

      <View style={[styles.canvasWrap, { height: canvasH }]}>
        <Scene
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
        <View style={styles.overlay}>
          <Text style={styles.overlayTitle}>Session complete</Text>
          <Text style={styles.overlayMeta}>
            Score {ended.score} · {game.metricLabel} {ended.bestMetric} · {ended.durationSec}s
          </Text>
          <Pressable style={styles.doneBtn} onPress={() => router.back()}>
            <Text style={styles.doneText}>Save & exit</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
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
    backgroundColor: colors.surfaceHigh,
  },
  hudCenter: {
    flex: 1,
    alignItems: 'center',
  },
  hudTitle: {
    color: colors.onSurface,
    fontWeight: '700',
    fontSize: 16,
  },
  hudMeta: {
    color: colors.onSurfaceVariant,
    fontSize: 12,
    marginTop: 2,
  },
  canvasWrap: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(6,14,32,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  overlayTitle: {
    color: colors.onSurface,
    fontSize: 24,
    fontWeight: '800',
  },
  overlayMeta: {
    color: colors.onSurfaceVariant,
    fontSize: 14,
  },
  doneBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  doneText: {
    color: colors.onPrimary,
    fontWeight: '800',
  },
});
