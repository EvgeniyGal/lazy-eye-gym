import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Card, HeaderBar, PrimaryButton, Screen, Subtitle, Title } from '@/src/components/ui';
import { getTrainingStats } from '@/src/db/sessions';
import { GAMES } from '@/src/games/catalog';
import { useAppStore } from '@/src/state/AppStore';
import { colors, radii, spacing } from '@/src/theme/tokens';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { prefs, setLazyEyeEnabled } = useAppStore();
  const [stats, setStats] = useState({
    sessionCount: 0,
    totalMinutes: 0,
    scoreSum: 0,
    streak: 0,
    todaySeconds: 0,
  });

  useFocusEffect(
    useCallback(() => {
      void getTrainingStats().then(setStats);
    }, []),
  );

  const todayMins = Math.round(stats.todaySeconds / 60);
  const dailyGoal = 20;
  const progress = Math.min(100, Math.round((todayMins / dailyGoal) * 100));

  return (
    <Screen>
      <View style={{ paddingTop: insets.top }}>
        <HeaderBar
          title="Home"
          lazyEyeEnabled={prefs.lazyEyeEnabled}
          onToggle3D={() => setLazyEyeEnabled(!prefs.lazyEyeEnabled)}
        />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.hero}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>• Daily Session Ready</Text>
          </View>
          <Title>Welcome back, {prefs.displayName}!</Title>
          <Subtitle>
            Train your binocular visual cortex with balanced, dichoptic neural exercises.
          </Subtitle>
          <View style={styles.metrics}>
            <View style={styles.ring}>
              <Text style={styles.ringText}>{progress}%</Text>
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={styles.metricStrong}>Day {stats.streak} Streak</Text>
              <Text style={styles.metricMute}>
                {todayMins} of {dailyGoal} mins trained today
              </Text>
              <Text style={styles.xp}>+{Math.min(99, stats.sessionCount * 5)} XP today</Text>
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
          label="Start Gym / Select Game"
          icon="play"
          onPress={() => router.push('/(tabs)/games')}
        />

        <View style={styles.quickRow}>
          <Pressable style={styles.quick} onPress={() => router.push('/(tabs)/calibrate')}>
            <Ionicons name="options-outline" size={22} color={colors.primary} />
            <Text style={styles.quickTitle}>Quick Calibration</Text>
            <Text style={styles.quickSub}>Tune red/cyan balance</Text>
          </Pressable>
          <Pressable style={styles.quick} onPress={() => router.push('/(tabs)/guide')}>
            <Ionicons name="eye-outline" size={22} color={colors.secondary} />
            <Text style={styles.quickTitle}>How It Works</Text>
            <Text style={styles.quickSub}>Anaglyph glasses guide</Text>
          </Pressable>
        </View>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Recommended Routine</Text>
          <Text style={styles.sectionMeta}>13 Mins Total</Text>
        </View>
        {GAMES.slice(0, 2).map((game) => (
          <Pressable
            key={game.id}
            style={styles.routine}
            onPress={() => router.push(`/(tabs)/games/${game.id}`)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.routineTag}>{game.tag}</Text>
              <Text style={styles.routineTitle}>{game.title}</Text>
              <Text style={styles.routineSub}>{game.blurb}</Text>
            </View>
            <View style={styles.playCircle}>
              <Ionicons name="play" size={16} color={colors.primary} />
            </View>
          </Pressable>
        ))}

        <Card>
          <Text style={styles.sectionTitle}>Training progress</Text>
          <Subtitle style={{ marginTop: 4 }}>
            Local session stats only — not a clinical stereo-acuity measurement.
          </Subtitle>
          <View style={styles.statRow}>
            <View style={styles.stat}>
              <Text style={[styles.statNum, { color: colors.secondary }]}>{stats.streak}</Text>
              <Text style={styles.statLabel}>Day streak</Text>
            </View>
            <View style={styles.stat}>
              <Text style={[styles.statNum, { color: colors.primary }]}>{stats.sessionCount}</Text>
              <Text style={styles.statLabel}>Sessions</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{stats.totalMinutes}m</Text>
              <Text style={styles.statLabel}>Total time</Text>
            </View>
          </View>
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
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,240,255,0.12)',
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  metrics: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  ring: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringText: {
    color: colors.onSurface,
    fontWeight: '800',
  },
  metricStrong: {
    color: colors.onSurface,
    fontWeight: '700',
    fontSize: 16,
  },
  metricMute: {
    color: colors.onSurfaceVariant,
    fontSize: 13,
  },
  xp: {
    color: colors.tertiary,
    fontWeight: '700',
    fontSize: 12,
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
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    color: colors.onSurface,
    fontWeight: '700',
    fontSize: 16,
  },
  sectionMeta: {
    color: colors.onSurfaceVariant,
    fontSize: 12,
  },
  routine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  routineTag: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  routineTitle: {
    color: colors.onSurface,
    fontWeight: '700',
    fontSize: 16,
    marginTop: 2,
  },
  routineSub: {
    color: colors.onSurfaceVariant,
    fontSize: 12,
    marginTop: 4,
  },
  playCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  stat: {
    flex: 1,
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  statNum: {
    color: colors.onSurface,
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    color: colors.onSurfaceVariant,
    fontSize: 11,
    marginTop: 4,
    textTransform: 'uppercase',
  },
});
