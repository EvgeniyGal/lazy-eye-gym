import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, HeaderBar, Screen, Segmented, Subtitle, Title, ToggleRow } from '@/src/components/ui';
import { useT } from '@/src/i18n/I18nProvider';
import { useAppStore } from '@/src/state/AppStore';
import { spacing } from '@/src/theme/tokens';

import { SettingsBack } from './SettingsBack';
import { settingsStyles as styles } from './styles';

export default function EngineSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const { prefs, updatePrefs } = useAppStore();

  return (
    <Screen>
      <View style={{ paddingTop: insets.top }}>
        <HeaderBar title={t('settings.engine')} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SettingsBack />
        <Title>{t('settings.engine')}</Title>
        <Subtitle>{t('settings.engineHint')}</Subtitle>

        <Card>
          <Text style={styles.section}>{t('settings.driftSpeed')}</Text>
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

        <Text style={styles.saved}>{t('settings.saved')}</Text>
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </Screen>
  );
}
