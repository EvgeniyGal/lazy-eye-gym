import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Card, HeaderBar, PrimaryButton, Screen, Subtitle, Title } from '@/src/components/ui';
import {
  formatDuration,
  getPlaytimeByGame,
  getTrainingStats,
  type GamePlaytime,
} from '@/src/db/sessions';
import { GAMES } from '@/src/games/catalog';
import { useAppStore } from '@/src/state/AppStore';
import { colors, radii, spacing } from '@/src/theme/tokens';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { prefs } = useAppStore();
  const [todaySeconds, setTodaySeconds] = useState(0);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [byGame, setByGame] = useState<GamePlaytime[]>([]);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const [stats, playtime] = await Promise.all([getTrainingStats(), getPlaytimeByGame()]);
        setTodaySeconds(stats.todaySeconds);
        setTotalMinutes(stats.totalMinutes);
        setByGame(playtime);
      })();
    }, []),
  );

  const playtimeRows = useMemo(() => {
    const map = new Map(byGame.map((row) => [row.gameId, row]));
    return GAMES.map((game) => {
      const stats = map.get(game.id);
      return {
        game,
        durationSec: stats?.durationSec ?? 0,
        sessionCount: stats?.sessionCount ?? 0,
      };
    });
  }, [byGame]);

  const hasAnyPlaytime = playtimeRows.some((row) => row.durationSec > 0 || row.sessionCount > 0);

  return (
    <Screen>
      <View style={{ paddingTop: insets.top }}>
        <HeaderBar title="Home" />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.hero}>
          <Title>Welcome back, {prefs.displayName}!</Title>
          <Subtitle>
            Play whenever you like — no planned sessions. Pick any game and train at your own pace.
          </Subtitle>
          <View style={styles.summaryRow}>
            <View style={styles.chip}>
              <Text style={styles.chipLabel}>Today</Text>
              <Text style={styles.chipValue}>{formatDuration(todaySeconds)}</Text>
            </View>
            <View style={styles.chip}>
              <Text style={styles.chipLabel}>All time</Text>
              <Text style={styles.chipValue}>
                {totalMinutes >= 60
                  ? formatDuration(totalMinutes * 60)
                  : `${totalMinutes}m`}
              </Text>
            </View>
          </View>
        </Card>

        <Card style={styles.notice}>
          <View style={styles.noticeRow}>
            <Ionicons name="shield-checkmark-outline" size={22} color={colors.secondary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.noticeTitle}>Important notice</Text>
              <Body style={{ color: colors.onSurfaceVariant, marginTop: 4 }}>
                LazyEye Gym is a casual training tool, not a certified medical device. Consult an eye
                care professional for diagnosis or treatment.
              </Body>
            </View>
          </View>
        </Card>

        <PrimaryButton
          label="Select Game"
          icon="play"
          onPress={() => router.push('/(tabs)/games')}
        />

        <View style={styles.quickRow}>
          <Pressable style={styles.quick} onPress={() => router.push('/(tabs)/settings')}>
            <Ionicons name="settings-outline" size={22} color={colors.primary} />
            <Text style={styles.quickTitle}>Settings</Text>
            <Text style={styles.quickSub}>Glasses, intensity, reminders</Text>
          </Pressable>
          <Pressable style={styles.quick} onPress={() => router.push('/(tabs)/guide')}>
            <Ionicons name="eye-outline" size={22} color={colors.secondary} />
            <Text style={styles.quickTitle}>How It Works</Text>
            <Text style={styles.quickSub}>Anaglyph glasses guide</Text>
          </Pressable>
        </View>

        <Card>
          <Text style={styles.sectionTitle}>Playtime by game</Text>
          <Subtitle style={{ marginTop: 4, marginBottom: spacing.md }}>
            How long you have played each game on this device.
          </Subtitle>
          {!hasAnyPlaytime ? (
            <Text style={styles.empty}>No playtime yet — pick a game to start.</Text>
          ) : (
            playtimeRows.map(({ game, durationSec, sessionCount }) => (
              <Pressable
                key={game.id}
                style={styles.playRow}
                onPress={() => router.push(`/(tabs)/games/${game.id}`)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.playTitle}>{game.title}</Text>
                  <Text style={styles.playMeta}>
                    {sessionCount} session{sessionCount === 1 ? '' : 's'}
                  </Text>
                </View>
                <Text style={styles.playTime}>{formatDuration(durationSec)}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.onSurfaceVariant} />
              </Pressable>
            ))
          )}
        </Card>
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  hero: {
    gap: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  chip: {
    flex: 1,
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  chipLabel: {
    color: colors.onSurfaceVariant,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  chipValue: {
    color: colors.onSurface,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  notice: {
    borderTopWidth: 2,
    borderTopColor: colors.secondaryContainer,
  },
  noticeRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  noticeTitle: {
    color: colors.onSurface,
    fontWeight: '700',
  },
  quickRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  quick: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    gap: 6,
  },
  quickTitle: {
    color: colors.onSurface,
    fontWeight: '700',
  },
  quickSub: {
    color: colors.onSurfaceVariant,
    fontSize: 12,
  },
  sectionTitle: {
    color: colors.onSurface,
    fontWeight: '700',
    fontSize: 16,
  },
  empty: {
    color: colors.onSurfaceVariant,
    fontSize: 14,
    lineHeight: 20,
  },
  playRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outlineVariant,
  },
  playTitle: {
    color: colors.onSurface,
    fontWeight: '700',
    fontSize: 15,
  },
  playMeta: {
    color: colors.onSurfaceVariant,
    fontSize: 12,
    marginTop: 2,
  },
  playTime: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 14,
  },
});
