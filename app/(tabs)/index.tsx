import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isHomeSupportCardVisible, snoozeHomeSupportCard } from '@/src/billing/tipJar';
import { Body, Card, HeaderBar, PrimaryButton, Screen, Subtitle, Title } from '@/src/components/ui';
import {
  formatDuration,
  getPlaytimeByGame,
  getTrainingStats,
  type GamePlaytime,
} from '@/src/db/sessions';
import { useT } from '@/src/i18n/I18nProvider';
import { getLocalizedGames } from '@/src/i18n/localizeCatalog';
import { useAppStore } from '@/src/state/AppStore';
import { useColors } from '@/src/theme/ThemeProvider';
import { radii, spacing } from '@/src/theme/tokens';

export default function HomeScreen() {
  const colors = useColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
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
        supportActions: {
          flexDirection: 'row',
          gap: spacing.sm,
          marginTop: spacing.md,
          flexWrap: 'wrap',
        },
        supportCta: {
          backgroundColor: colors.primary,
          borderRadius: radii.md,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
        },
        supportCtaText: {
          color: colors.onPrimary,
          fontWeight: '700',
          fontSize: 13,
        },
        supportLater: {
          borderRadius: radii.md,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          borderWidth: 1,
          borderColor: colors.outlineVariant,
        },
        supportLaterText: {
          color: colors.onSurfaceVariant,
          fontWeight: '600',
          fontSize: 13,
        },
      }),
    [colors],
  );
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useT();
  const { prefs } = useAppStore();
  const [todaySeconds, setTodaySeconds] = useState(0);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [byGame, setByGame] = useState<GamePlaytime[]>([]);
  const [showSupportCard, setShowSupportCard] = useState(isHomeSupportCardVisible);

  useFocusEffect(
    useCallback(() => {
      setShowSupportCard(isHomeSupportCardVisible());
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
    return getLocalizedGames(t).map((game) => {
      const stats = map.get(game.id);
      return {
        game,
        durationSec: stats?.durationSec ?? 0,
        sessionCount: stats?.sessionCount ?? 0,
      };
    });
  }, [byGame, t]);

  const hasAnyPlaytime = playtimeRows.some((row) => row.durationSec > 0 || row.sessionCount > 0);

  return (
    <Screen>
      <View style={{ paddingTop: insets.top }}>
        <HeaderBar title={t('home.header')} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.hero}>
          <Title>{t('home.welcome', { name: prefs.displayName })}</Title>
          <Subtitle>{t('home.subtitle')}</Subtitle>
          <View style={styles.summaryRow}>
            <View style={styles.chip}>
              <Text style={styles.chipLabel}>{t('home.today')}</Text>
              <Text style={styles.chipValue}>{formatDuration(todaySeconds)}</Text>
            </View>
            <View style={styles.chip}>
              <Text style={styles.chipLabel}>{t('home.allTime')}</Text>
              <Text style={styles.chipValue}>
                {totalMinutes >= 60
                  ? formatDuration(totalMinutes * 60)
                  : t('common.minutesShort', { count: totalMinutes })}
              </Text>
            </View>
          </View>
        </Card>

        {showSupportCard ? (
          <Card style={styles.notice}>
            <View style={styles.noticeRow}>
              <Ionicons name="heart-outline" size={22} color={colors.secondary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.noticeTitle}>{t('home.supportCardTitle')}</Text>
                <Body style={{ color: colors.onSurfaceVariant, marginTop: 4 }}>
                  {t('home.supportCardBody')}
                </Body>
                <View style={styles.supportActions}>
                  <Pressable
                    accessibilityRole="button"
                    style={styles.supportCta}
                    onPress={() => router.push('/(tabs)/settings/support')}
                  >
                    <Text style={styles.supportCtaText}>{t('home.supportCardCta')}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    style={styles.supportLater}
                    onPress={() => {
                      snoozeHomeSupportCard();
                      setShowSupportCard(false);
                    }}
                  >
                    <Text style={styles.supportLaterText}>{t('home.supportCardLater')}</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Card>
        ) : null}

        <Card style={styles.notice}>
          <View style={styles.noticeRow}>
            <Ionicons name="shield-checkmark-outline" size={22} color={colors.secondary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.noticeTitle}>{t('home.noticeTitle')}</Text>
              <Body style={{ color: colors.onSurfaceVariant, marginTop: 4 }}>
                {t('home.noticeBody')}
              </Body>
            </View>
          </View>
        </Card>

        <PrimaryButton
          label={t('home.selectGame')}
          icon="play"
          onPress={() => router.push('/(tabs)/games')}
        />

        <View style={styles.quickRow}>
          <Pressable style={styles.quick} onPress={() => router.push('/(tabs)/settings')}>
            <Ionicons name="settings-outline" size={22} color={colors.primary} />
            <Text style={styles.quickTitle}>{t('home.settingsTitle')}</Text>
            <Text style={styles.quickSub}>{t('home.settingsSub')}</Text>
          </Pressable>
          <Pressable style={styles.quick} onPress={() => router.push('/(tabs)/guide')}>
            <Ionicons name="eye-outline" size={22} color={colors.secondary} />
            <Text style={styles.quickTitle}>{t('home.guideTitle')}</Text>
            <Text style={styles.quickSub}>{t('home.guideSub')}</Text>
          </Pressable>
        </View>

        <Card>
          <Text style={styles.sectionTitle}>{t('home.playtimeTitle')}</Text>
          <Subtitle style={{ marginTop: 4, marginBottom: spacing.md }}>
            {t('home.playtimeSub')}
          </Subtitle>
          {!hasAnyPlaytime ? (
            <Text style={styles.empty}>{t('home.playtimeEmpty')}</Text>
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
                    {t(sessionCount === 1 ? 'common.sessions_one' : 'common.sessions_other', {
                      count: sessionCount,
                    })}
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
