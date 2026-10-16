import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GameSettingsForm } from '@/src/components/GameSettingsForm';
import { Card, HeaderBar, PrimaryButton, Screen, StatBox, Subtitle, Title } from '@/src/components/ui';
import { getBestMetric, getBestScore, listSessionsForGame, type GameSession } from '@/src/db/sessions';
import type { GameId } from '@/src/games/catalog';
import { useT } from '@/src/i18n/I18nProvider';
import { getLocalizedGame } from '@/src/i18n/localizeCatalog';
import { useAppStore } from '@/src/state/AppStore';
import { useColors } from '@/src/theme/ThemeProvider';
import { spacing } from '@/src/theme/tokens';

export default function GameDetailScreen() {
  const colors = useColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
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
      }),
    [colors],
  );
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useT();
  const game = useMemo(() => getLocalizedGame(String(id), t), [id, t]);
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
          <Title>{t('gameDetail.notFound')}</Title>
          <PrimaryButton label={t('gameDetail.backToGames')} onPress={() => router.back()} />
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
          <Text style={styles.backText}>{t('gameDetail.games')}</Text>
        </Pressable>

        <Title>{game.title}</Title>
        <Subtitle>{game.blurb}</Subtitle>

        <View style={styles.stats}>
          <StatBox label={game.recordLabel} value={String(best)} accent={colors.primary} />
          <StatBox label={game.metricLabel} value={String(metric)} accent={colors.secondary} />
        </View>

        <Card>
          <Text style={styles.section}>{t('gameDetail.setup')}</Text>
          <Subtitle style={{ marginBottom: spacing.md }}>{t('gameDetail.setupHint')}</Subtitle>
          <GameSettingsForm
            game={game}
            settings={settings}
            onChange={(next) => setGameSettings(game.id, next)}
          />
        </Card>

        <PrimaryButton
          label={t('gameDetail.play', { name: game.shortTitle })}
          icon="play"
          onPress={() => router.push(`/game/${game.id as GameId}`)}
        />

        <Card>
          <Text style={styles.section}>{t('gameDetail.history')}</Text>
          {history.length === 0 ? (
            <Subtitle>{t('gameDetail.historyEmpty')}</Subtitle>
          ) : (
            history.map((session) => (
              <View key={session.id} style={styles.historyRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyScore}>
                    {t('gameDetail.historyScore', { score: session.score })}
                  </Text>
                  <Text style={styles.historyMeta}>
                    {t('gameDetail.historyMeta', {
                      when: new Date(session.endedAt).toLocaleString(),
                      duration: session.durationSec,
                      metricLabel: game.metricLabel,
                      metric: session.bestMetric,
                    })}
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
