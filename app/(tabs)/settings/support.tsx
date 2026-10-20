import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  isTipJarAvailable,
  TIP_HINT_KEYS,
  TIP_LABEL_KEYS,
  TIP_PRODUCT_IDS,
  type TipProductId,
} from '@/src/billing/tipJar';
import { useTipJar } from '@/src/billing/useTipJar';
import { SettingsBack } from '@/src/components/settings/SettingsBack';
import { useSettingsStyles } from '@/src/components/settings/styles';
import { Body, Card, HeaderBar, Screen, Subtitle, Title } from '@/src/components/ui';
import { useT } from '@/src/i18n/I18nProvider';
import { useColors } from '@/src/theme/ThemeProvider';
import { radii, spacing } from '@/src/theme/tokens';

function TipOptions() {
  const { t } = useT();
  const colors = useColors();
  const styles = useSupportStyles();
  const { connected, productsById, purchasingSku, thanked, purchase } = useTipJar();

  const rows = useMemo(
    () =>
      TIP_PRODUCT_IDS.map((id) => {
        const product = productsById.get(id);
        return {
          id,
          label: t(TIP_LABEL_KEYS[id]),
          hint: t(TIP_HINT_KEYS[id]),
          price: product?.displayPrice ?? null,
        };
      }),
    [productsById, t],
  );

  const busy = purchasingSku != null;
  const waitingForProducts = connected && productsById.size === 0;

  return (
    <>
      {thanked ? (
        <Card style={styles.thanksCard}>
          <View style={styles.thanksRow}>
            <Ionicons name="heart" size={22} color={colors.secondary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.thanksTitle}>{t('support.thankYouTitle')}</Text>
              <Body style={{ color: colors.onSurfaceVariant, marginTop: 4 }}>
                {t('support.thankYouBody')}
              </Body>
            </View>
          </View>
        </Card>
      ) : null}

      {!connected || waitingForProducts ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>{t('support.loading')}</Text>
        </View>
      ) : null}

      {rows.map((row) => {
        const active = purchasingSku === row.id;
        const disabled = busy || !connected || !row.price;
        return (
          <Pressable
            key={row.id}
            accessibilityRole="button"
            disabled={disabled}
            onPress={() => void purchase(row.id as TipProductId)}
            style={[styles.tipRow, disabled && styles.tipRowDisabled]}
          >
            <View style={styles.tipIcon}>
              <Ionicons
                name={row.id === 'tip_coffee' ? 'cafe-outline' : row.id === 'tip_boost' ? 'rocket-outline' : 'trophy-outline'}
                size={22}
                color={colors.secondary}
              />
            </View>
            <View style={styles.tipTextWrap}>
              <Text style={styles.tipTitle}>{row.label}</Text>
              <Text style={styles.tipHint}>{row.hint}</Text>
            </View>
            {active ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={styles.tipPrice}>{row.price ?? '—'}</Text>
            )}
          </Pressable>
        );
      })}
    </>
  );
}

function UnavailableNotice() {
  const { t } = useT();
  const colors = useColors();
  const styles = useSupportStyles();
  return (
    <Card>
      <View style={styles.thanksRow}>
        <Ionicons name="information-circle-outline" size={22} color={colors.onSurfaceVariant} />
        <Body style={{ flex: 1, color: colors.onSurfaceVariant }}>{t('support.unavailable')}</Body>
      </View>
    </Card>
  );
}

export default function SupportSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const styles = useSettingsStyles();
  const available = isTipJarAvailable();

  return (
    <Screen>
      <View style={{ paddingTop: insets.top }}>
        <HeaderBar title={t('support.title')} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SettingsBack />
        <Title>{t('support.title')}</Title>
        <Subtitle>{t('support.lead')}</Subtitle>
        <Body style={{ marginTop: -spacing.sm }}>{t('support.reassure')}</Body>

        {available ? <TipOptions /> : <UnavailableNotice />}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </Screen>
  );
}

function useSupportStyles() {
  const colors = useColors();
  return useMemo(
    () =>
      StyleSheet.create({
        thanksCard: {
          borderTopWidth: 2,
          borderTopColor: colors.secondaryContainer,
        },
        thanksRow: {
          flexDirection: 'row',
          gap: spacing.md,
          alignItems: 'flex-start',
        },
        thanksTitle: {
          color: colors.onSurface,
          fontWeight: '700',
          fontSize: 16,
        },
        loadingRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingVertical: spacing.sm,
        },
        loadingText: {
          color: colors.onSurfaceVariant,
          fontSize: 14,
        },
        tipRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.md,
          backgroundColor: colors.surface,
          borderRadius: radii.lg,
          borderWidth: 1,
          borderColor: colors.outlineVariant,
        },
        tipRowDisabled: {
          opacity: 0.55,
        },
        tipIcon: {
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surfaceHigh,
        },
        tipTextWrap: {
          flex: 1,
          gap: 4,
        },
        tipTitle: {
          color: colors.onSurface,
          fontWeight: '700',
          fontSize: 16,
        },
        tipHint: {
          color: colors.onSurfaceVariant,
          fontSize: 13,
          lineHeight: 18,
        },
        tipPrice: {
          color: colors.primary,
          fontWeight: '800',
          fontSize: 15,
        },
      }),
    [colors],
  );
}
