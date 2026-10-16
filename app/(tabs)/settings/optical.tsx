import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ColorDragSlider } from '@/src/components/ColorDragSlider';
import { Card, HeaderBar, PrimaryButton, Screen, Segmented, Subtitle, Title } from '@/src/components/ui';
import { backgroundCss, hslToHex } from '@/src/anaglyph/color';
import { useT } from '@/src/i18n/I18nProvider';
import { useAppStore } from '@/src/state/AppStore';
import { spacing } from '@/src/theme/tokens';

import { SettingsBack } from '@/src/components/settings/SettingsBack';
import { useSettingsStyles } from '@/src/components/settings/styles';

export default function OpticalSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const styles = useSettingsStyles();
  const { activeProfile, saveProfile, swapEyes } = useAppStore();

  const previewBg = backgroundCss(activeProfile.background);
  const previewOnLight = activeProfile.background === 'white';
  const previewLabel = previewOnLight ? '#111' : '#eee';
  const leftColor = hslToHex(activeProfile.leftHue, activeProfile.leftLightness);
  const rightColor = hslToHex(activeProfile.rightHue, activeProfile.rightLightness);

  return (
    <Screen>
      <View style={{ paddingTop: insets.top }}>
        <HeaderBar title={t('settings.opticalProfile')} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SettingsBack />
        <Title>{t('settings.opticalProfile')}</Title>
        <Subtitle>{t('settings.opticalHint')}</Subtitle>

        <Card>
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

        <Text style={styles.saved}>{t('settings.saved')}</Text>
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </Screen>
  );
}
