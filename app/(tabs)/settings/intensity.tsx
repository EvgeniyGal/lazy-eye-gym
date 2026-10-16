import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, HeaderBar, Screen, Subtitle, Title } from '@/src/components/ui';
import { backgroundCss, hslToHex } from '@/src/anaglyph/color';
import { colorForEye } from '@/src/anaglyph/palette';
import { useT } from '@/src/i18n/I18nProvider';
import { useAppStore } from '@/src/state/AppStore';
import { spacing } from '@/src/theme/tokens';

import { SettingsBack } from './SettingsBack';
import { useSettingsStyles } from './styles';

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
  const styles = useSettingsStyles();
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

export default function IntensitySettingsScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const styles = useSettingsStyles();
  const { activeProfile, intensity, setIntensity, palette } = useAppStore();

  const previewBg = backgroundCss(activeProfile.background);
  const previewOnLight = activeProfile.background === 'white';
  const previewLabel = previewOnLight ? '#111' : '#eee';
  const leftColor = hslToHex(activeProfile.leftHue, activeProfile.leftLightness);
  const rightColor = hslToHex(activeProfile.rightHue, activeProfile.rightLightness);
  const leftIntensityColor = colorForEye(palette, 'left');
  const rightIntensityColor = colorForEye(palette, 'right');

  return (
    <Screen>
      <View style={{ paddingTop: insets.top }}>
        <HeaderBar title={t('settings.intensity')} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SettingsBack />
        <Title>{t('settings.intensity')}</Title>
        <Subtitle>{t('settings.intensityHint')}</Subtitle>

        <Card>
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
            <Pressable style={styles.preset} onPress={() => setIntensity({ left: 75, right: 75 })}>
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

        <Text style={styles.saved}>{t('settings.saved')}</Text>
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </Screen>
  );
}
