import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DichopticText } from '@/src/components/DichopticText';
import {
  Card,
  HeaderBar,
  PrimaryButton,
  Screen,
  Segmented,
  Subtitle,
  Title,
  ToggleRow,
} from '@/src/components/ui';
import { backgroundCss } from '@/src/anaglyph/color';
import { useAppStore } from '@/src/state/AppStore';
import { colors, radii, spacing } from '@/src/theme/tokens';

export default function CalibrateScreen() {
  const insets = useSafeAreaInsets();
  const {
    prefs,
    setLazyEyeEnabled,
    updatePrefs,
    activeProfile,
    intensity,
    setIntensity,
    saveProfile,
    swapEyes,
    applyRedCyanPreset,
  } = useAppStore();

  const previewBg = backgroundCss(activeProfile.background);

  return (
    <Screen>
      <View style={{ paddingTop: insets.top }}>
        <HeaderBar
          title="Calibrate"
          lazyEyeEnabled={prefs.lazyEyeEnabled}
          onToggle3D={() => setLazyEyeEnabled(!prefs.lazyEyeEnabled)}
        />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Title>Vision & Anaglyph Setup</Title>
        <Subtitle>
          Personalize your dichoptic contrast balance to defeat lazy eye suppression effectively.
        </Subtitle>

        <Card>
          <Text style={styles.section}>Optical profile</Text>
          <View style={styles.presetRow}>
            <Pressable style={styles.preset} onPress={applyRedCyanPreset}>
              <Text style={styles.presetText}>Red/Cyan</Text>
            </Pressable>
            <Pressable
              style={styles.preset}
              onPress={() =>
                saveProfile({
                  ...activeProfile,
                  leftHue: 0,
                  rightHue: 120,
                  name: 'Red/Green',
                })
              }
            >
              <Text style={styles.presetText}>Red/Green</Text>
            </Pressable>
            <Pressable style={[styles.preset, styles.presetActive]}>
              <Text style={[styles.presetText, styles.presetTextActive]}>Custom</Text>
            </Pressable>
          </View>

          <View style={styles.eyeRow}>
            <View style={[styles.eyeCard, { borderColor: colors.secondary }]}>
              <Text style={[styles.eyeLabel, { color: colors.secondary }]}>Left Eye</Text>
              <Text style={styles.eyeMeta}>Hue {Math.round(activeProfile.leftHue)}°</Text>
              <Text style={styles.eyeMeta}>Light {Math.round(activeProfile.leftLightness)}%</Text>
            </View>
            <View style={[styles.eyeCard, { borderColor: colors.primary }]}>
              <Text style={[styles.eyeLabel, { color: colors.primary }]}>Right Eye</Text>
              <Text style={styles.eyeMeta}>Hue {Math.round(activeProfile.rightHue)}°</Text>
              <Text style={styles.eyeMeta}>Light {Math.round(activeProfile.rightLightness)}%</Text>
            </View>
          </View>

          <PrimaryButton label="Swap Eyes" icon="swap-horizontal" onPress={swapEyes} />

          <Text style={[styles.section, { marginTop: spacing.lg }]}>Left hue</Text>
          <HueStepper
            value={activeProfile.leftHue}
            onChange={(leftHue) => saveProfile({ ...activeProfile, leftHue })}
          />
          <Text style={styles.section}>Left lightness</Text>
          <LightStepper
            value={activeProfile.leftLightness}
            onChange={(leftLightness) => saveProfile({ ...activeProfile, leftLightness })}
          />
          <Text style={styles.section}>Right hue</Text>
          <HueStepper
            value={activeProfile.rightHue}
            onChange={(rightHue) => saveProfile({ ...activeProfile, rightHue })}
          />
          <Text style={styles.section}>Right lightness</Text>
          <LightStepper
            value={activeProfile.rightLightness}
            onChange={(rightLightness) => saveProfile({ ...activeProfile, rightLightness })}
          />

          <Text style={[styles.section, { marginTop: spacing.md }]}>Background</Text>
          <Segmented
            options={[
              { label: 'Black', value: 'black' },
              { label: 'Gray', value: 'gray' },
              { label: 'White', value: 'white' },
            ]}
            value={activeProfile.background}
            onChange={(background) =>
              saveProfile({
                ...activeProfile,
                background: background as 'black' | 'gray' | 'white',
              })
            }
          />

          <View style={[styles.preview, { backgroundColor: previewBg }]}>
            <DichopticText
              text="Fusion Preview AaBb"
              colors={activeProfile}
              background={activeProfile.background}
              enabled={prefs.lazyEyeEnabled}
              style={styles.previewText}
            />
          </View>
        </Card>

        <Card>
          <Text style={styles.section}>Dichoptic intensity</Text>
          <Subtitle>
            Dim the dominant eye or boost the amblyopic eye until symbols in both test boxes are
            equally vivid.
          </Subtitle>
          <IntensityRow
            label="Left eye (red lens)"
            value={intensity.left}
            accent={colors.secondary}
            onChange={(left) => setIntensity({ ...intensity, left })}
          />
          <IntensityRow
            label="Right eye (cyan lens)"
            value={intensity.right}
            accent={colors.primary}
            onChange={(right) => setIntensity({ ...intensity, right })}
          />
          <View style={styles.presetRow}>
            <Pressable
              style={styles.preset}
              onPress={() => setIntensity({ left: 75, right: 75 })}
            >
              <Text style={styles.presetText}>Equal 1:1</Text>
            </Pressable>
            <Pressable
              style={styles.preset}
              onPress={() =>
                setIntensity({
                  left: Math.min(100, intensity.left + 20),
                  right: intensity.right,
                })
              }
            >
              <Text style={styles.presetText}>Left +20%</Text>
            </Pressable>
            <Pressable
              style={styles.preset}
              onPress={() =>
                setIntensity({
                  left: intensity.left,
                  right: Math.min(100, intensity.right + 20),
                })
              }
            >
              <Text style={styles.presetText}>Right +20%</Text>
            </Pressable>
          </View>
        </Card>

        <Card>
          <Text style={styles.section}>Engine & feedback</Text>
          <Text style={[styles.section, { marginTop: spacing.md }]}>Drift speed</Text>
          <Segmented
            options={[
              { label: 'Easy', value: 'easy' },
              { label: 'Medium', value: 'medium' },
              { label: 'Fast', value: 'fast' },
            ]}
            value={prefs.driftSpeed}
            onChange={(driftSpeed) =>
              updatePrefs({ driftSpeed: driftSpeed as 'easy' | 'medium' | 'fast' })
            }
          />
          <ToggleRow
            label="Sound effects"
            description="Audio cues during play"
            value={prefs.soundEffects}
            onChange={(soundEffects) => updatePrefs({ soundEffects })}
          />
          <ToggleRow
            label="Haptic feedback"
            description="Tactile clicks on fusion events"
            value={prefs.hapticFeedback}
            onChange={(hapticFeedback) => updatePrefs({ hapticFeedback })}
          />
          <ToggleRow
            label="Auto-pause on eye strain"
            description="Reminders every ~20 minutes"
            value={prefs.autoPauseOnStrain}
            onChange={(autoPauseOnStrain) => updatePrefs({ autoPauseOnStrain })}
          />
        </Card>

        <Text style={styles.saved}>Settings saved automatically to local ocular profile.</Text>
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </Screen>
  );
}

function HueStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={styles.stepRow}>
      <Text style={styles.stepBtn} onPress={() => onChange((value + 350) % 360)}>
        −
      </Text>
      <Text style={styles.stepVal}>{Math.round(value)}°</Text>
      <Text style={styles.stepBtn} onPress={() => onChange((value + 10) % 360)}>
        +
      </Text>
    </View>
  );
}

function LightStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={styles.stepRow}>
      <Text
        style={styles.stepBtn}
        onPress={() => onChange(Math.max(8, value - 5))}
      >
        −
      </Text>
      <Text style={styles.stepVal}>{Math.round(value)}%</Text>
      <Text
        style={styles.stepBtn}
        onPress={() => onChange(Math.min(92, value + 5))}
      >
        +
      </Text>
    </View>
  );
}

function IntensityRow({
  label,
  value,
  accent,
  onChange,
}: {
  label: string;
  value: number;
  accent: string;
  onChange: (v: number) => void;
}) {
  return (
    <View style={{ marginTop: spacing.md }}>
      <View style={styles.intensityHead}>
        <Text style={styles.intensityLabel}>{label}</Text>
        <Text style={[styles.intensityVal, { color: accent }]}>{value}%</Text>
      </View>
      <View style={styles.stepRow}>
        <Text style={styles.stepBtn} onPress={() => onChange(Math.max(0, value - 5))}>
          −
        </Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${value}%`, backgroundColor: accent }]} />
        </View>
        <Text style={styles.stepBtn} onPress={() => onChange(Math.min(100, value + 5))}>
          +
        </Text>
      </View>
    </View>
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
    fontSize: 15,
    marginBottom: spacing.sm,
  },
  presetRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
    flexWrap: 'wrap',
  },
  preset: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  presetActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  presetText: {
    color: colors.onSurfaceVariant,
    fontWeight: '600',
    fontSize: 12,
  },
  presetTextActive: {
    color: colors.onPrimary,
  },
  eyeRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  eyeCard: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: radii.lg,
    padding: spacing.md,
    backgroundColor: colors.surfaceHigh,
    gap: 4,
  },
  eyeLabel: {
    fontWeight: '800',
  },
  eyeMeta: {
    color: colors.onSurfaceVariant,
    fontSize: 12,
  },
  preview: {
    marginTop: spacing.lg,
    borderRadius: radii.md,
    padding: spacing.lg,
    alignItems: 'center',
  },
  previewText: {
    fontSize: 22,
    fontWeight: '700',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    textAlign: 'center',
    textAlignVertical: 'center',
    backgroundColor: colors.surfaceHigh,
    color: colors.onSurface,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 34,
  },
  stepVal: {
    flex: 1,
    textAlign: 'center',
    color: colors.onSurface,
    fontWeight: '700',
  },
  intensityHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  intensityLabel: {
    color: colors.onSurface,
    fontWeight: '600',
  },
  intensityVal: {
    fontWeight: '800',
  },
  track: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceHighest,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
  saved: {
    color: colors.tertiary,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
});
