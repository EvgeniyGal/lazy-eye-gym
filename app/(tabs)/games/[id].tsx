import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GameSettingsForm } from '@/src/components/GameSettingsForm';
import { Card, HeaderBar, PrimaryButton, Screen, StatBox, Subtitle, Title } from '@/src/components/ui';
import { getBestMetric, getBestScore, listSessionsForGame, type GameSession } from '@/src/db/sessions';
import { getGame, type GameId } from '@/src/games/catalog';
import { useAppStore } from '@/src/state/AppStore';
import { colors, spacing } from '@/src/theme/tokens';

export default function GameDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const game = getGame(String(id));
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getGameSettings, setGameSettings } = useAppStore();
  const [best, setBest] = useState(0);
  const [metric, setMetric] = useState(0);
  const [history, setHistory] = useState<GameSession[]>([]);

  const settings = useMemo(
    () => (game ? getGameSettings(game.id) : {}),
    [game, getGameSettings],
  );

  useFocusEffect(
    useCallback(() => {
      if (!game) return;
      void (async () => {
        setBest(await getBestScore(game.id));
        setMetric(await getBestMetric(game.id));
        setHistory(await listSessionsForGame(game.id, 20));
      })();
    }, [game]),
  );

  if (!game) {
    return (
      <Screen>
        <View style={{ padding: spacing.xl, paddingTop: insets.top + spacing.xl }}>
          <Title>Game not found</Title>
          <PrimaryButton label="Back to games" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ paddingTop: insets.top }}>
        <HeaderBar title={game.shortTitle} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={18} color={colors.primary} />
          <Text style={styles.backText}>Games</Text>
        </Pressable>

        <Title>{game.title}</Title>
        <Subtitle>{game.blurb}</Subtitle>

        <View style={styles.stats}>
          <StatBox label={game.recordLabel} value={String(best)} accent={colors.primary} />
          <StatBox label={game.metricLabel} value={String(metric)} accent={colors.secondary} />
        </View>

        <Card>
          <Text style={styles.section}>Game setup</Text>
          <Subtitle style={{ marginBottom: spacing.md }}>
            Level, colours, and eye roles for this training mode.
          </Subtitle>
          <GameSettingsForm
            game={game}
            settings={settings}
            onChange={(next) => setGameSettings(game.id, next)}
          />
        </Card>

        <PrimaryButton
          label={`Play ${game.shortTitle}`}
          icon="play"
          onPress={() => router.push(`/game/${game.id as GameId}`)}
        />

        <Card>
          <Text style={styles.section}>Session history</Text>
          {history.length === 0 ? (
            <Subtitle>No sessions yet. Play a round to start your local record.</Subtitle>
          ) : (
            history.map((session) => (
              <View key={session.id} style={styles.historyRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyScore}>Score {session.score}</Text>
                  <Text style={styles.historyMeta}>
                    {new Date(session.endedAt).toLocaleString()} · {session.durationSec}s ·{' '}
                    {game.metricLabel} {session.bestMetric}
                  </Text>
                </View>
              </View>
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
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  backText: {
    color: colors.primary,
    fontWeight: '600',
  },
  stats: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  section: {
    color: colors.onSurface,
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 4,
  },
  historyRow: {
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
  },
  historyScore: {
    color: colors.onSurface,
    fontWeight: '700',
  },
  historyMeta: {
    color: colors.onSurfaceVariant,
    fontSize: 12,
    marginTop: 4,
  },
});
