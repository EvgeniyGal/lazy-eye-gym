import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip, HeaderBar, Screen, Subtitle, Title } from '@/src/components/ui';
import { GAMES, type GameCategory, type GameId } from '@/src/games/catalog';
import { GAME_PREVIEWS } from '@/src/games/previews';
import { useT } from '@/src/i18n/I18nProvider';
import { getLocalizedGamesByCategory } from '@/src/i18n/localizeCatalog';
import { useAppStore } from '@/src/state/AppStore';
import { useColors } from '@/src/theme/ThemeProvider';
import { radii, spacing } from '@/src/theme/tokens';

export default function GamesHubScreen() {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const gap = spacing.md;
  const pad = spacing.lg;
  const tileW = (width - pad * 2 - gap) / 2;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        content: {
          padding: pad,
          gap: spacing.md,
          paddingBottom: spacing.xxl,
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
        grid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap,
          marginTop: spacing.sm,
        },
        tile: {
          width: tileW,
          backgroundColor: colors.surface,
          borderRadius: radii.lg,
          borderWidth: 1,
          borderColor: colors.outlineVariant,
          overflow: 'hidden',
        },
        previewWrap: {
          width: tileW,
          height: tileW,
          backgroundColor: colors.surfaceHigh,
          overflow: 'hidden',
        },
        preview: {
          width: tileW,
          height: tileW,
        },
        tileBody: {
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          gap: 2,
        },
        tileTitle: {
          color: colors.onSurface,
          fontWeight: '700',
          fontSize: 15,
        },
        tileTag: {
          color: colors.primary,
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 0.3,
        },
      }),
    [colors, gap, pad, tileW],
  );

  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useT();
  const { activeProfile } = useAppStore();
  const [category, setCategory] = useState<GameCategory>('all');
  const list = getLocalizedGamesByCategory(category, t);

  return (
    <Screen>
      <View style={{ paddingTop: insets.top }}>
        <HeaderBar title={t('gamesHub.header')} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Title>{t('gamesHub.title')}</Title>
        <Subtitle>{t('gamesHub.listHint')}</Subtitle>

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

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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

        <View style={styles.grid}>
          {list.map((game) => (
            <Pressable
              key={game.id}
              accessibilityRole="button"
              accessibilityLabel={game.title}
              onPress={() => router.push(`/(tabs)/games/${game.id as GameId}`)}
              style={({ pressed }) => [styles.tile, pressed && { opacity: 0.88 }]}
            >
              <View style={styles.previewWrap}>
                <Image
                  source={GAME_PREVIEWS[game.id]}
                  style={styles.preview}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.tileBody}>
                <Text style={styles.tileTag} numberOfLines={1}>
                  {game.tag}
                </Text>
                <Text style={styles.tileTitle} numberOfLines={2}>
                  {game.title}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}
