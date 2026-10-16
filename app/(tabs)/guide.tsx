import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, HeaderBar, PrimaryButton, Screen, Subtitle, Title } from '@/src/components/ui';
import { useT } from '@/src/i18n/I18nProvider';
import { useColors } from '@/src/theme/ThemeProvider';
import { radii, spacing } from '@/src/theme/tokens';

export default function GuideScreen() {
  const colors = useColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        content: {
          padding: spacing.lg,
          gap: spacing.lg,
        },
        section: {
          color: colors.onSurface,
          fontWeight: '700',
          fontSize: 16,
          marginBottom: spacing.md,
        },
        simRow: {
          flexDirection: 'row',
          gap: spacing.md,
        },
        simBox: {
          flex: 1,
          borderWidth: 1.5,
          borderRadius: radii.lg,
          padding: spacing.md,
          gap: 4,
          backgroundColor: colors.surfaceHigh,
        },
        simEye: {
          fontWeight: '800',
        },
        simMeta: {
          color: colors.onSurfaceVariant,
          fontSize: 12,
        },
        fusion: {
          marginTop: spacing.md,
          backgroundColor: colors.surfaceHighest,
          borderRadius: radii.md,
          padding: spacing.md,
          alignItems: 'center',
          gap: 6,
        },
        fusionTitle: {
          color: colors.onSurface,
          fontWeight: '700',
        },
        fusionTag: {
          color: colors.primary,
          fontWeight: '800',
          fontSize: 12,
        },
        step: {
          flexDirection: 'row',
          gap: spacing.md,
          marginBottom: spacing.md,
        },
        stepNum: {
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
        },
        stepNumText: {
          color: colors.onPrimary,
          fontWeight: '800',
        },
        stepTitle: {
          color: colors.onSurface,
          fontWeight: '700',
        },
        stepDesc: {
          color: colors.onSurfaceVariant,
          fontSize: 13,
          marginTop: 4,
          lineHeight: 18,
        },
        safety: {
          borderColor: colors.tertiary,
        },
        faq: {
          paddingVertical: spacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.outlineVariant,
        },
        faqQ: {
          color: colors.onSurface,
          fontWeight: '600',
        },
        faqA: {
          color: colors.onSurfaceVariant,
          marginTop: spacing.sm,
          lineHeight: 20,
        },
      }),
    [colors],
  );
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useT();
  const [open, setOpen] = useState(0);

  const faq = [
    { q: t('guide.faq1q'), a: t('guide.faq1a') },
    { q: t('guide.faq2q'), a: t('guide.faq2a') },
    { q: t('guide.faq3q'), a: t('guide.faq3a') },
  ];
  const steps = [
    { n: '1', t: t('guide.step1Title'), d: t('guide.step1Desc') },
    { n: '2', t: t('guide.step2Title'), d: t('guide.step2Desc') },
    { n: '3', t: t('guide.step3Title'), d: t('guide.step3Desc') },
  ];

  return (
    <Screen>
      <View style={{ paddingTop: insets.top }}>
        <HeaderBar title={t('guide.header')} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Title>{t('guide.title')}</Title>
        <Subtitle>{t('guide.subtitle')}</Subtitle>

        <Card>
          <Text style={styles.section}>{t('guide.neuralTitle')}</Text>
          <View style={styles.simRow}>
            <View style={[styles.simBox, { borderColor: colors.secondary }]}>
              <Text style={[styles.simEye, { color: colors.secondary }]}>{t('guide.leftEye')}</Text>
              <Text style={styles.simMeta}>{t('guide.leftMeta1')}</Text>
              <Text style={styles.simMeta}>{t('guide.leftMeta2')}</Text>
            </View>
            <View style={[styles.simBox, { borderColor: colors.primary }]}>
              <Text style={[styles.simEye, { color: colors.primary }]}>{t('guide.rightEye')}</Text>
              <Text style={styles.simMeta}>{t('guide.rightMeta1')}</Text>
              <Text style={styles.simMeta}>{t('guide.rightMeta2')}</Text>
            </View>
          </View>
          <View style={styles.fusion}>
            <Text style={styles.fusionTitle}>{t('guide.fusionTitle')}</Text>
            <Text style={styles.fusionTag}>{t('guide.fusionTag')}</Text>
          </View>
        </Card>

        <Card>
          <Text style={styles.section}>{t('guide.stepsTitle')}</Text>
          {steps.map((step) => (
            <View key={step.n} style={styles.step}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>{step.n}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTitle}>{step.t}</Text>
                <Text style={styles.stepDesc}>{step.d}</Text>
              </View>
            </View>
          ))}
        </Card>

        <Card style={styles.safety}>
          <Text style={styles.section}>{t('guide.safetyTitle')}</Text>
          <Subtitle>{t('guide.safetyBody')}</Subtitle>
        </Card>

        <Card>
          <Text style={styles.section}>{t('guide.faqTitle')}</Text>
          {faq.map((item, index) => (
            <Pressable key={item.q} onPress={() => setOpen(index)} style={styles.faq}>
              <Text style={styles.faqQ}>{item.q}</Text>
              {open === index ? <Text style={styles.faqA}>{item.a}</Text> : null}
            </Pressable>
          ))}
        </Card>

        <PrimaryButton
          label={t('guide.cta')}
          icon="game-controller"
          onPress={() => router.push('/(tabs)/games')}
        />
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </Screen>
  );
}
