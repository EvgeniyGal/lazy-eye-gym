import { Ionicons } from '@expo/vector-icons';
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
import type { AppLanguagePreference, ReminderFrequency } from '@/src/anaglyph/types';
import { useT } from '@/src/i18n/I18nProvider';
import { LANGUAGE_PICKER_OPTIONS } from '@/src/i18n/locales';
import { syncReminders } from '@/src/notifications/reminders';
import { useAppStore } from '@/src/state/AppStore';
import { colors, radii, spacing } from '@/src/theme/tokens';

function formatClock(hour: number, minute: number) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

const FREQUENCY_NOTE_KEYS: Record<ReminderFrequency, string> = {
  daily: 'settings.freqDaily',
  weekdays: 'settings.freqWeekdays',
  every2days: 'settings.freqEvery2days',
  weekly: 'settings.freqWeekly',
};

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { t, languagePreference } = useT();
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
        t('settings.reminderSet', {
          time: formatClock(next.reminderHour, next.reminderMinute),
          frequency: t(FREQUENCY_NOTE_KEYS[next.reminderFrequency]),
        }),
      );
    } else if (result.ok) {
      setReminderNote(t('settings.remindersOff'));
    } else {
      setReminderNote(result.message ?? t('settings.reminderFailed'));
    }
  };

  const changeLanguage = (language: AppLanguagePreference) => {
    updatePrefs({ language });
    void syncReminders({ ...prefs, language });
  };

  return (
    <Screen>
      <View style={{ paddingTop: insets.top }}>
        <HeaderBar title={t('settings.header')} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Title>{t('settings.title')}</Title>
        <Subtitle>{t('settings.subtitle')}</Subtitle>

        <Card>
          <Text style={styles.section}>{t('settings.opticalProfile')}</Text>
          <Subtitle style={{ marginBottom: spacing.md }}>{t('settings.opticalHint')}</Subtitle>

          <Text style={styles.section}>{t('settings.background')}</Text>
          <Segmented
            options={[
              { label: t('settings.black'), value: 'black' },
              { label: t('settings.gray'), value: 'gray' },
              { label: t('settings.white'), value: 'white' },
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
            <Text style={[styles.eyeTitle, { color: leftColor }]}>{t('common.leftEye')}</Text>
            <ColorDragSlider
              label={t('settings.hue')}
              kind="hue"
              value={activeProfile.leftHue}
              min={0}
              max={360}
              unit="°"
              onChange={(leftHue) => saveProfile({ ...activeProfile, leftHue })}
            />
            <ColorDragSlider
              label={t('settings.lightness')}
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
                <Text style={[styles.circleLabel, { color: previewLabel }]}>{t('common.left')}</Text>
              </View>
              <View style={styles.circleWrap}>
                <View style={[styles.circle, { backgroundColor: rightColor }]} />
                <Text style={[styles.circleLabel, { color: previewLabel }]}>{t('common.right')}</Text>
              </View>
            </View>
          </View>

          <View style={styles.eyePanel}>
            <Text style={[styles.eyeTitle, { color: rightColor }]}>{t('common.rightEye')}</Text>
            <ColorDragSlider
              label={t('settings.hue')}
              kind="hue"
              value={activeProfile.rightHue}
              min={0}
              max={360}
              unit="°"
              onChange={(rightHue) => saveProfile({ ...activeProfile, rightHue })}
            />
            <ColorDragSlider
              label={t('settings.lightness')}
              kind="lightness"
              value={activeProfile.rightLightness}
              min={8}
              max={92}
              unit="%"
              onChange={(rightLightness) => saveProfile({ ...activeProfile, rightLightness })}
            />
          </View>

          <PrimaryButton label={t('settings.swapEyes')} icon="swap-horizontal" onPress={swapEyes} />
        </Card>

        <Card>
          <Text style={styles.section}>{t('settings.intensity')}</Text>
          <Subtitle>{t('settings.intensityHint')}</Subtitle>
          <View style={[styles.intensityStage, { backgroundColor: previewBg }]}>
            <View style={styles.circles}>
              <View style={styles.circleWrap}>
                <View style={[styles.circle, { backgroundColor: leftIntensityColor }]} />
                <Text style={[styles.circleLabel, { color: previewLabel }]}>{t('common.left')}</Text>
              </View>
              <View style={styles.circleWrap}>
                <View style={[styles.circle, { backgroundColor: rightIntensityColor }]} />
                <Text style={[styles.circleLabel, { color: previewLabel }]}>{t('common.right')}</Text>
              </View>
            </View>
            <IntensityRow
              label={t('common.leftEye')}
              value={intensity.left}
              fill={leftIntensityColor}
              solid={leftColor}
              onLight={previewOnLight}
              trackBg={previewOnLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.18)'}
              onChange={(left) => setIntensity({ ...intensity, left })}
            />
            <IntensityRow
              label={t('common.rightEye')}
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
              <Text style={styles.presetText}>{t('settings.equalPreset')}</Text>
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
              <Text style={styles.presetText}>{t('settings.leftPlus20')}</Text>
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
              <Text style={styles.presetText}>{t('settings.rightPlus20')}</Text>
            </Pressable>
          </View>
        </Card>

        <Card>
          <Text style={styles.section}>{t('settings.reminders')}</Text>
          <Subtitle>{t('settings.remindersHint')}</Subtitle>
          <ToggleRow
            label={t('settings.enableReminders')}
            description={t('settings.enableRemindersDesc')}
            value={prefs.remindersEnabled}
            onChange={(remindersEnabled) => void applyReminderPatch({ remindersEnabled })}
          />
          <Text style={[styles.section, { marginTop: spacing.md }]}>{t('settings.time')}</Text>
          <View style={styles.timeRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.timeLabel}>{t('settings.hour')}</Text>
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
              <Text style={styles.timeLabel}>{t('settings.minute')}</Text>
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
          <Text style={styles.section}>{t('settings.frequency')}</Text>
          <Segmented
            options={[
              { label: t('settings.daily'), value: 'daily' },
              { label: t('settings.weekdays'), value: 'weekdays' },
              { label: t('settings.every2d'), value: 'every2days' },
              { label: t('settings.weekly'), value: 'weekly' },
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
          <Text style={styles.section}>{t('settings.engine')}</Text>
          <Text style={[styles.section, { marginTop: spacing.md }]}>{t('settings.driftSpeed')}</Text>
          <Segmented
            options={[
              { label: t('common.easy'), value: 'easy' },
              { label: t('common.medium'), value: 'medium' },
              { label: t('settings.fast'), value: 'fast' },
            ]}
            value={prefs.driftSpeed}
            onChange={(driftSpeed) =>
              updatePrefs({ driftSpeed: driftSpeed as 'easy' | 'medium' | 'fast' })
            }
          />
          <ToggleRow
            label={t('settings.soundEffects')}
            description={t('settings.soundEffectsDesc')}
            value={prefs.soundEffects}
            onChange={(soundEffects) => updatePrefs({ soundEffects })}
          />
          <ToggleRow
            label={t('settings.haptic')}
            description={t('settings.hapticDesc')}
            value={prefs.hapticFeedback}
            onChange={(hapticFeedback) => updatePrefs({ hapticFeedback })}
          />
          <ToggleRow
            label={t('settings.autoPause')}
            description={t('settings.autoPauseDesc')}
            value={prefs.autoPauseOnStrain}
            onChange={(autoPauseOnStrain) => updatePrefs({ autoPauseOnStrain })}
          />
        </Card>

        <Card>
          <Text style={styles.section}>{t('settings.language')}</Text>
          <Subtitle style={{ marginBottom: spacing.md }}>{t('settings.languageHint')}</Subtitle>
          <View style={styles.langList}>
            {LANGUAGE_PICKER_OPTIONS.map((opt) => {
              const active = languagePreference === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => changeLanguage(opt.value)}
                  style={[styles.langRow, active && styles.langRowActive]}
                >
                  <Text style={[styles.langText, active && styles.langTextActive]}>
                    {opt.value === 'system' ? t('common.systemDefault') : opt.label}
                  </Text>
                  {active ? (
                    <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </Card>

        <Text style={styles.saved}>{t('settings.saved')}</Text>
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
  langList: {
    gap: spacing.sm,
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  langRowActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceHighest,
  },
  langText: {
    color: colors.onSurfaceVariant,
    fontWeight: '600',
    fontSize: 14,
  },
  langTextActive: {
    color: colors.onSurface,
    fontWeight: '700',
  },
  saved: {
    color: colors.tertiary,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
});
