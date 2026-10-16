import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HeaderBar, Screen, Subtitle, Title } from '@/src/components/ui';
import { useT } from '@/src/i18n/I18nProvider';
import { colors, spacing } from '@/src/theme/tokens';

import { settingsStyles as styles } from './styles';

type SettingsRoute = 'optical' | 'intensity' | 'reminders' | 'engine' | 'language';

const MENU: {
  route: SettingsRoute;
  icon: keyof typeof Ionicons.glyphMap;
  titleKey: string;
  hintKey: string;
  color: string;
}[] = [
  {
    route: 'optical',
    icon: 'color-palette-outline',
    titleKey: 'settings.opticalProfile',
    hintKey: 'settings.opticalHint',
    color: colors.secondary,
  },
  {
    route: 'intensity',
    icon: 'contrast-outline',
    titleKey: 'settings.intensity',
    hintKey: 'settings.intensityHint',
    color: colors.primary,
  },
  {
    route: 'reminders',
    icon: 'notifications-outline',
    titleKey: 'settings.reminders',
    hintKey: 'settings.remindersHint',
    color: colors.tertiary,
  },
  {
    route: 'engine',
    icon: 'options-outline',
    titleKey: 'settings.engine',
    hintKey: 'settings.engineHint',
    color: colors.primary,
  },
  {
    route: 'language',
    icon: 'language-outline',
    titleKey: 'settings.language',
    hintKey: 'settings.languageHint',
    color: colors.secondary,
  },
];

export default function SettingsHubScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useT();

  return (
    <Screen>
      <View style={{ paddingTop: insets.top }}>
        <HeaderBar title={t('settings.header')} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Title>{t('settings.title')}</Title>
        <Subtitle>{t('settings.menuSubtitle')}</Subtitle>

        {MENU.map((item) => (
          <Pressable
            key={item.route}
            accessibilityRole="button"
            onPress={() => router.push(`/(tabs)/settings/${item.route}`)}
            style={styles.menuRow}
          >
            <View style={styles.menuIcon}>
              <Ionicons name={item.icon} size={22} color={item.color} />
            </View>
            <View style={styles.menuTextWrap}>
              <Text style={styles.menuTitle}>{t(item.titleKey)}</Text>
              <Text style={styles.menuSub} numberOfLines={2}>
                {t(item.hintKey)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceVariant} />
          </Pressable>
        ))}

        <Text style={styles.saved}>{t('settings.saved')}</Text>
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </Screen>
  );
}
