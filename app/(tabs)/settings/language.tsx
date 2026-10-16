import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, HeaderBar, Screen, Subtitle, Title } from '@/src/components/ui';
import type { AppLanguagePreference } from '@/src/anaglyph/types';
import { useT } from '@/src/i18n/I18nProvider';
import { LANGUAGE_PICKER_OPTIONS } from '@/src/i18n/locales';
import { syncReminders } from '@/src/notifications/reminders';
import { useAppStore } from '@/src/state/AppStore';
import { colors, spacing } from '@/src/theme/tokens';

import { SettingsBack } from './SettingsBack';
import { settingsStyles as styles } from './styles';

export default function LanguageSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { t, languagePreference } = useT();
  const { prefs, updatePrefs } = useAppStore();

  const changeLanguage = (language: AppLanguagePreference) => {
    updatePrefs({ language });
    void syncReminders({ ...prefs, language });
  };

  return (
    <Screen>
      <View style={{ paddingTop: insets.top }}>
        <HeaderBar title={t('settings.language')} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SettingsBack />
        <Title>{t('settings.language')}</Title>
        <Subtitle>{t('settings.languageHint')}</Subtitle>

        <Card>
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
