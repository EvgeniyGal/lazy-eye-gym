import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, Text } from 'react-native';

import { useT } from '@/src/i18n/I18nProvider';
import { colors } from '@/src/theme/tokens';

import { settingsStyles as styles } from './styles';

export function SettingsBack() {
  const router = useRouter();
  const { t } = useT();
  return (
    <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button">
      <Ionicons name="chevron-back" size={18} color={colors.primary} />
      <Text style={styles.backText}>{t('settings.back')}</Text>
    </Pressable>
  );
}
