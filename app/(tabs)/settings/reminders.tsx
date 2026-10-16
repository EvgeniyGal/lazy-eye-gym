import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, HeaderBar, Screen, Segmented, Subtitle, Title, ToggleRow } from '@/src/components/ui';
import type { ReminderFrequency } from '@/src/anaglyph/types';
import { useT } from '@/src/i18n/I18nProvider';
import { syncReminders } from '@/src/notifications/reminders';
import { useAppStore } from '@/src/state/AppStore';
import { spacing } from '@/src/theme/tokens';

import { SettingsBack } from '@/src/components/settings/SettingsBack';
import { useSettingsStyles } from '@/src/components/settings/styles';

function formatClock(hour: number, minute: number) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

const FREQUENCY_NOTE_KEYS: Record<ReminderFrequency, string> = {
  daily: 'settings.freqDaily',
  weekdays: 'settings.freqWeekdays',
  every2days: 'settings.freqEvery2days',
  weekly: 'settings.freqWeekly',
};

export default function ReminderSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const styles = useSettingsStyles();
  const { prefs, updatePrefs } = useAppStore();
  const [reminderNote, setReminderNote] = useState<string | null>(null);

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

  return (
    <Screen>
      <View style={{ paddingTop: insets.top }}>
        <HeaderBar title={t('settings.reminders')} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SettingsBack />
        <Title>{t('settings.reminders')}</Title>
        <Subtitle>{t('settings.remindersHint')}</Subtitle>

        <Card>
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

        <Text style={styles.saved}>{t('settings.saved')}</Text>
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </Screen>
  );
}
