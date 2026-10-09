import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ColorDragSlider } from '@/src/components/ColorDragSlider';
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
import { backgroundCss, hslToHex } from '@/src/anaglyph/color';
import { colorForEye } from '@/src/anaglyph/palette';
import type { ReminderFrequency } from '@/src/anaglyph/types';
import { syncReminders } from '@/src/notifications/reminders';
import { useAppStore } from '@/src/state/AppStore';
import { colors, radii, spacing } from '@/src/theme/tokens';

function formatClock(hour: number, minute: number) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const {
    prefs,
    updatePrefs,
    activeProfile,
    intensity,
    setIntensity,
    saveProfile,
    swapEyes,
    palette,
  } = useAppStore();
  const [reminderNote, setReminderNote] = useState<string | null>(null);

  const previewBg = backgroundCss(activeProfile.background);
  const previewOnLight = activeProfile.background === 'white';
  const previewLabel = previewOnLight ? '#111' : '#eee';
  const leftColor = hslToHex(activeProfile.leftHue, activeProfile.leftLightness);
  const rightColor = hslToHex(activeProfile.rightHue, activeProfile.rightLightness);
  const leftIntensityColor = colorForEye(palette, 'left');
  const rightIntensityColor = colorForEye(palette, 'right');

  const applyReminderPatch = async (patch: Partial<typeof prefs>) => {
    const next = { ...prefs, ...patch };
    updatePrefs(patch);
    const result = await syncReminders(next);
    if (result.ok && next.remindersEnabled) {
      setReminderNote(
        `Reminder set for ${formatClock(next.reminderHour, next.reminderMinute)} (${next.reminderFrequency}).`,
      );
    } else if (result.ok) {
      setReminderNote('Reminders turned off.');
    } else {
      setReminderNote(result.message ?? 'Could not schedule reminder.');
    }
  };

  return (
    <Screen>
      <View style={{ paddingTop: insets.top }}>
        <HeaderBar title="Settings" />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Title>Settings</Title>
        <Subtitle>
          Configure glasses colours, dichoptic intensity, and local play reminders.
        </Subtitle>

        <Card>
          <Text style={styles.section}>Optical profile</Text>
          <Subtitle style={{ marginBottom: spacing.md }}>
            Set left and right lens colours to match your anaglyph glasses. Drag the bars to adjust.
          </Subtitle>

          <Text style={styles.section}>Background</Text>
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

          <View style={styles.eyePanel}>
            <Text style={[styles.eyeTitle, { color: leftColor }]}>Left eye</Text>
            <ColorDragSlider
              label="Hue"
              kind="hue"
              value={activeProfile.leftHue}
              min={0}
              max={360}
              unit="°"
              onChange={(leftHue) => saveProfile({ ...activeProfile, leftHue })}
            />
            <ColorDragSlider
              label="Lightness"
              kind="lightness"
              value={activeProfile.leftLightness}
              min={8}
              max={92}
              unit="%"
              onChange={(leftLightness) => saveProfile({ ...activeProfile, leftLightness })}
            />
          </View>

          <View style={[styles.preview, { backgroundColor: previewBg }]}>
            <View style={styles.circles}>
              <View style={styles.circleWrap}>
                <View style={[styles.circle, { backgroundColor: leftColor }]} />
                <Text style={[styles.circleLabel, { color: previewLabel }]}>Left</Text>
              </View>
              <View style={styles.circleWrap}>
                <View style={[styles.circle, { backgroundColor: rightColor }]} />
                <Text style={[styles.circleLabel, { color: previewLabel }]}>Right</Text>
              </View>
            </View>
          </View>

          <View style={styles.eyePanel}>
            <Text style={[styles.eyeTitle, { color: rightColor }]}>Right eye</Text>
            <ColorDragSlider
              label="Hue"
              kind="hue"
              value={activeProfile.rightHue}
              min={0}
              max={360}
              unit="°"
              onChange={(rightHue) => saveProfile({ ...activeProfile, rightHue })}
            />
            <ColorDragSlider
              label="Lightness"
              kind="lightness"
              value={activeProfile.rightLightness}
              min={8}
              max={92}
              unit="%"
              onChange={(rightLightness) => saveProfile({ ...activeProfile, rightLightness })}
            />
          </View>

          <PrimaryButton label="Swap Eyes" icon="swap-horizontal" onPress={swapEyes} />
        </Card>

        <Card>
          <Text style={styles.section}>Dichoptic intensity</Text>
          <Subtitle>
            Dim the dominant eye or boost the amblyopic eye until both colours feel equally vivid.
            Preview uses your optical background so glasses filtering matches play.
          </Subtitle>
          <View style={[styles.intensityStage, { backgroundColor: previewBg }]}>
            <View style={styles.circles}>
              <View style={styles.circleWrap}>
                <View style={[styles.circle, { backgroundColor: leftIntensityColor }]} />
                <Text style={[styles.circleLabel, { color: previewLabel }]}>Left</Text>
              </View>
              <View style={styles.circleWrap}>
                <View style={[styles.circle, { backgroundColor: rightIntensityColor }]} />
                <Text style={[styles.circleLabel, { color: previewLabel }]}>Right</Text>
              </View>
            </View>
            <IntensityRow
              label="Left eye"
              value={intensity.left}
              fill={leftIntensityColor}
              solid={leftColor}
              onLight={previewOnLight}
              trackBg={previewOnLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.18)'}
              onChange={(left) => setIntensity({ ...intensity, left })}
            />
            <IntensityRow
              label="Right eye"
              value={intensity.right}
              fill={rightIntensityColor}
              solid={rightColor}
              onLight={previewOnLight}
              trackBg={previewOnLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.18)'}
              onChange={(right) => setIntensity({ ...intensity, right })}
            />
          </View>
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
          <Text style={styles.section}>Reminders</Text>
          <Subtitle>
            Local notifications only — choose how often and when you want a gentle nudge to play.
          </Subtitle>
          <ToggleRow
            label="Enable reminders"
            description="Schedule on this device"
            value={prefs.remindersEnabled}
            onChange={(remindersEnabled) => void applyReminderPatch({ remindersEnabled })}
          />
          <Text style={[styles.section, { marginTop: spacing.md }]}>Time</Text>
          <View style={styles.timeRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.timeLabel}>Hour</Text>
              <View style={styles.stepRow}>
                <Text
                  style={styles.stepBtn}
                  onPress={() =>
                    void applyReminderPatch({
                      reminderHour: (prefs.reminderHour + 23) % 24,
                    })
                  }
                >
                  −
                </Text>
                <Text style={styles.stepVal}>{String(prefs.reminderHour).padStart(2, '0')}</Text>
                <Text
                  style={styles.stepBtn}
                  onPress={() =>
                    void applyReminderPatch({
                      reminderHour: (prefs.reminderHour + 1) % 24,
                    })
                  }
                >
                  +
                </Text>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.timeLabel}>Minute</Text>
              <View style={styles.stepRow}>
                <Text
                  style={styles.stepBtn}
                  onPress={() =>
                    void applyReminderPatch({
                      reminderMinute: (prefs.reminderMinute + 45) % 60,
                    })
                  }
                >
                  −
                </Text>
                <Text style={styles.stepVal}>{String(prefs.reminderMinute).padStart(2, '0')}</Text>
                <Text
                  style={styles.stepBtn}
                  onPress={() =>
                    void applyReminderPatch({
                      reminderMinute: (prefs.reminderMinute + 15) % 60,
                    })
                  }
                >
                  +
                </Text>
              </View>
            </View>
          </View>
          <Text style={styles.section}>Frequency</Text>
          <Segmented
            options={[
              { label: 'Daily', value: 'daily' },
              { label: 'Weekdays', value: 'weekdays' },
              { label: 'Every 2d', value: 'every2days' },
              { label: 'Weekly', value: 'weekly' },
            ]}
            value={prefs.reminderFrequency}
            onChange={(reminderFrequency) =>
              void applyReminderPatch({
                reminderFrequency: reminderFrequency as ReminderFrequency,
              })
            }
          />
          {reminderNote ? <Text style={styles.reminderNote}>{reminderNote}</Text> : null}
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
            description="Nudge to rest about every 20 minutes in-game"
            value={prefs.autoPauseOnStrain}
            onChange={(autoPauseOnStrain) => updatePrefs({ autoPauseOnStrain })}
          />
        </Card>

        <Text style={styles.saved}>Settings saved automatically on this device.</Text>
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </Screen>
  );
}

function IntensityRow({
  label,
  value,
  fill,
  solid,
  onLight,
  trackBg,
  onChange,
}: {
  label: string;
  value: number;
  fill: string;
  solid: string;
  onLight: boolean;
  trackBg: string;
  onChange: (v: number) => void;
}) {
  const chrome = onLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.12)';
  const chromeText = onLight ? '#111' : '#f5f5f5';
  return (
    <View style={{ marginTop: spacing.md, alignSelf: 'stretch' }}>
      <View style={styles.intensityHead}>
        <Text style={[styles.intensityLabel, { color: chromeText }]}>{label}</Text>
        <Text style={[styles.intensityVal, { color: solid }]}>{value}%</Text>
      </View>
      <View style={[styles.stepRow, { marginBottom: 0 }]}>
        <Text
          style={[styles.stepBtn, { backgroundColor: chrome, color: chromeText }]}
          onPress={() => onChange(Math.max(0, value - 5))}
        >
          −
        </Text>
        <View style={[styles.track, { backgroundColor: trackBg }]}>
          <View style={[styles.fill, { width: `${value}%`, backgroundColor: fill }]} />
        </View>
        <Text
          style={[styles.stepBtn, { backgroundColor: chrome, color: chromeText }]}
          onPress={() => onChange(Math.min(100, value + 5))}
        >
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
  preview: {
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  intensityStage: {
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  circles: {
    flexDirection: 'row',
    gap: spacing.xxl,
    alignItems: 'center',
  },
  circleWrap: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  circle: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  circleLabel: {
    fontWeight: '700',
    fontSize: 13,
  },
  eyePanel: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  eyeTitle: {
    fontWeight: '800',
    fontSize: 16,
    marginBottom: spacing.md,
  },
  presetRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
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
  presetText: {
    color: colors.onSurfaceVariant,
    fontWeight: '600',
    fontSize: 12,
  },
  timeRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  timeLabel: {
    color: colors.onSurfaceVariant,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  reminderNote: {
    color: colors.tertiary,
    fontSize: 12,
    marginTop: spacing.md,
    fontWeight: '600',
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
