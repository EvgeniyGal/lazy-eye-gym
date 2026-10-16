import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, HeaderBar, Screen, Subtitle, Title } from '@/src/components/ui';
import type { AppColorSchemePreference } from '@/src/anaglyph/types';
import { useT } from '@/src/i18n/I18nProvider';
import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing } from '@/src/theme/tokens';

import { SettingsBack } from './SettingsBack';
import { useSettingsStyles } from './styles';

const OPTIONS: { value: AppColorSchemePreference; labelKey: string }[] = [
  { value: 'system', labelKey: 'settings.appearanceSystem' },
  { value: 'light', labelKey: 'settings.appearanceLight' },
  { value: 'dark', labelKey: 'settings.appearanceDark' },
];

export default function AppearanceSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const { preference, setColorScheme, colors } = useTheme();
  const styles = useSettingsStyles();

  return (
    <Screen>
      <View style={{ paddingTop: insets.top }}>
        <HeaderBar title={t('settings.appearance')} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SettingsBack />
        <Title>{t('settings.appearance')}</Title>
        <Subtitle>{t('settings.appearanceHint')}</Subtitle>

        <Card>
          <View style={styles.langList}>
            {OPTIONS.map((opt) => {
              const active = preference === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setColorScheme(opt.value)}
                  style={[styles.langRow, active && styles.langRowActive]}
                >
                  <Text style={[styles.langText, active && styles.langTextActive]}>
                    {t(opt.labelKey)}
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
