import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, Chip, HeaderBar, Screen, Subtitle, Title } from '@/src/components/ui';
import { getBestMetric, getBestScore } from '@/src/db/sessions';
import { GAMES, type GameCategory, type GameId } from '@/src/games/catalog';
import { useT } from '@/src/i18n/I18nProvider';
import { getLocalizedGamesByCategory } from '@/src/i18n/localizeCatalog';
import { useAppStore } from '@/src/state/AppStore';
import { useColors } from '@/src/theme/ThemeProvider';
import { radii, spacing } from '@/src/theme/tokens';

export default function GamesHubScreen() {
  const colors = useColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        content: {
          padding: spacing.lg,
          gap: spacing.md,
        },
        setupBar: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: colors.surface,
          borderRadius: radii.md,
          padding: spacing.md,
          marginTop: spacing.sm,
          borderWidth: 1,
          borderColor: colors.outlineVariant,
        },
        setupText: {
          color: colors.onSurfaceVariant,
          fontSize: 12,
          flex: 1,
        },
        calTag: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
        },
        calText: {
          color: colors.tertiary,
          fontSize: 12,
          fontWeight: '700',
        },
        gameCard: {
          gap: spacing.sm,
        },
        tag: {
          color: colors.primary,
          fontSize: 11,
          fontWeight: '800',
          letterSpacing: 0.5,
        },
        gameTitle: {
          color: colors.onSurface,
          fontSize: 20,
          fontWeight: '700',
        },
        split: {
          gap: 4,
          marginTop: spacing.sm,
        },
        splitItem: {
          fontSize: 12,
          fontWeight: '600',
        },
        stats: {
          flexDirection: 'row',
          gap: spacing.md,
          marginTop: spacing.sm,
        },
        stat: {
          flex: 1,
          backgroundColor: colors.surfaceHigh,
          borderRadius: radii.md,
          padding: spacing.md,
        },
        statVal: {
          color: colors.onSurface,
          fontWeight: '800',
          fontSize: 18,
        },
        statLbl: {
          color: colors.onSurfaceVariant,
          fontSize: 11,
          marginTop: 2,
          textTransform: 'uppercase',
        },
        playBtn: {
          marginTop: spacing.sm,
          backgroundColor: colors.primary,
          borderRadius: radii.pill,
          minHeight: 48,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
        },
        playText: {
          color: colors.onPrimary,
          fontWeight: '800',
        },
      }),
    [colors],
  );
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useT();
  const { activeProfile } = useAppStore();
  const [category, setCategory] = useState<GameCategory>('all');
  const [records, setRecords] = useState<Record<string, { score: number; metric: number }>>({});

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const next: Record<string, { score: number; metric: number }> = {};
        for (const game of GAMES) {
          next[game.id] = {
            score: await getBestScore(game.id),
            metric: await getBestMetric(game.id),
          };
        }
        setRecords(next);
      })();
    }, []),
  );

  const list = getLocalizedGamesByCategory(category, t);

  return (
    <Screen>
      <View style={{ paddingTop: insets.top }}>
        <HeaderBar title={t('gamesHub.header')} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Title>{t('gamesHub.title')}</Title>
        <View style={styles.setupBar}>
          <Text style={styles.setupText}>
            {t('gamesHub.activeSetup', {
              left: Math.round(activeProfile.leftHue),
              right: Math.round(activeProfile.rightHue),
            })}
          </Text>
          <View style={styles.calTag}>
            <Ionicons name="checkmark-circle" size={14} color={colors.tertiary} />
            <Text style={styles.calText}>{t('gamesHub.calibrated')}</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: spacing.md }}>
          <Chip
            label={t('gamesHub.allGames', { count: GAMES.length })}
            active={category === 'all'}
            onPress={() => setCategory('all')}
          />
          <Chip
            label={t('gamesHub.reflex')}
            active={category === 'reflex'}
            onPress={() => setCategory('reflex')}
          />
          <Chip
            label={t('gamesHub.spatial')}
            active={category === 'spatial'}
            onPress={() => setCategory('spatial')}
          />
        </ScrollView>

        {list.map((game) => (
          <Card key={game.id} style={styles.gameCard}>
            <Text style={styles.tag}>{game.tag}</Text>
            <Text style={styles.gameTitle}>{game.title}</Text>
            <Subtitle>{game.blurb}</Subtitle>
            <View style={styles.split}>
              <Text style={[styles.splitItem, { color: colors.secondary }]}>
                {t('gamesHub.redL', { label: game.dichopticSplit.leftLabel })}
              </Text>
              <Text style={[styles.splitItem, { color: colors.primary }]}>
                {t('gamesHub.cyanR', { label: game.dichopticSplit.rightLabel })}
              </Text>
            </View>
            <View style={styles.stats}>
              <View style={styles.stat}>
                <Text style={styles.statVal}>{records[game.id]?.score ?? 0}</Text>
                <Text style={styles.statLbl}>{t('common.score')}</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statVal}>{records[game.id]?.metric ?? 0}</Text>
                <Text style={styles.statLbl}>{game.metricLabel}</Text>
              </View>
            </View>
            <Pressable
              style={styles.playBtn}
              onPress={() => router.push(`/(tabs)/games/${game.id as GameId}`)}
            >
              <Ionicons name="play" size={16} color={colors.onPrimary} />
              <Text style={styles.playText}>{t('gamesHub.openGame', { name: game.shortTitle })}</Text>
            </Pressable>
          </Card>
        ))}
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </Screen>
  );
}
