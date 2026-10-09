import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, HeaderBar, PrimaryButton, Screen, Subtitle, Title } from '@/src/components/ui';
import { useAppStore } from '@/src/state/AppStore';
import { colors, radii, spacing } from '@/src/theme/tokens';

const FAQ = [
  {
    q: 'Why do parts of the game disappear if I close one eye?',
    a: 'That is the point of dichoptic therapy. Each eye receives different critical elements so both eyes must stay active for fusion.',
  },
  {
    q: 'Which glasses do I need?',
    a: 'Standard red/cyan anaglyph glasses. Default assumption: red over left, cyan over right — swap in Settings if your pair differs.',
  },
  {
    q: 'How long should I train?',
    a: 'Aim for short sessions of about 15–20 minutes. Rest if you feel eye strain.',
  },
];

export default function GuideScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [open, setOpen] = useState(0);

  return (
    <Screen>
      <View style={{ paddingTop: insets.top }}>
        <HeaderBar title="Guide" />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Title>How It Works</Title>
        <Subtitle>
          The science of dichoptic amblyopia training made simple. Rewire ocular suppression into
          stereo fusion.
        </Subtitle>

        <Card>
          <Text style={styles.section}>Neural fusion simulator</Text>
          <View style={styles.simRow}>
            <View style={[styles.simBox, { borderColor: colors.secondary }]}>
              <Text style={[styles.simEye, { color: colors.secondary }]}>Left Eye</Text>
              <Text style={styles.simMeta}>Red lens channel</Text>
              <Text style={styles.simMeta}>Paddle / Borders</Text>
            </View>
            <View style={[styles.simBox, { borderColor: colors.primary }]}>
              <Text style={[styles.simEye, { color: colors.primary }]}>Right Eye</Text>
              <Text style={styles.simMeta}>Cyan lens channel</Text>
              <Text style={styles.simMeta}>Target / Ball / Grid</Text>
            </View>
          </View>
          <View style={styles.fusion}>
            <Text style={styles.fusionTitle}>Visual Cortex Fusion</Text>
            <Text style={styles.fusionTag}>DICHOPTIC 2D</Text>
          </View>
        </Card>

        <Card>
          <Text style={styles.section}>Three steps to train</Text>
          {[
            {
              n: '1',
              t: 'Wear anaglyph glasses',
              d: 'Red over left eye, cyan over right eye (or swap in Settings).',
            },
            {
              n: '2',
              t: 'Set up eye colours',
              d: 'In Settings, match hues to your lenses and balance intensity until both eyes feel equally vivid.',
            },
            {
              n: '3',
              t: 'Play & merge',
              d: 'Game elements are split between eyes — succeed only when both contribute.',
            },
          ].map((step) => (
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
          <Text style={styles.section}>Clinical safety guideline</Text>
          <Subtitle>
            Prefer 15–20 minute sessions. Take a break if you notice strain, headache, or discomfort.
          </Subtitle>
        </Card>

        <Card>
          <Text style={styles.section}>FAQ</Text>
          {FAQ.map((item, index) => (
            <Pressable key={item.q} onPress={() => setOpen(index)} style={styles.faq}>
              <Text style={styles.faqQ}>{item.q}</Text>
              {open === index ? <Text style={styles.faqA}>{item.a}</Text> : null}
            </Pressable>
          ))}
        </Card>

        <PrimaryButton label="Got it, Let's Play!" icon="game-controller" onPress={() => router.push('/(tabs)/games')} />
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
});
