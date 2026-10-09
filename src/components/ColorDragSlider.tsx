import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { clampHue, hslToHex } from '@/src/anaglyph/color';
import { colors, radii, spacing } from '@/src/theme/tokens';

type Props = {
  label: string;
  value: number;
  min: number;
  max: number;
  /** Display suffix, e.g. ° or % */
  unit?: string;
  kind: 'hue' | 'lightness';
  onChange: (value: number) => void;
};

/** Degrees of hue visible across the scrubber width (small local gradient). */
const HUE_WINDOW = 48;

export function ColorDragSlider({
  label,
  value,
  min,
  max,
  unit = '',
  kind,
  onChange,
}: Props) {
  const [width, setWidth] = useState(0);
  const range = Math.max(1, max - min);
  const ratio = Math.min(1, Math.max(0, (value - min) / range));
  const dragStart = useRef(value);

  const lightnessColors = useMemo(() => ['#0a0a0a', '#808080', '#f5f5f5'] as const, []);

  const hueGradient = useMemo(() => {
    const steps = 7;
    const colorsOut: string[] = [];
    for (let i = 0; i < steps; i += 1) {
      const t = i / (steps - 1);
      const hue = clampHue(value - HUE_WINDOW / 2 + t * HUE_WINDOW);
      colorsOut.push(hslToHex(hue, 50));
    }
    return colorsOut as [string, string, ...string[]];
  }, [value]);

  const updateLightnessFromX = useCallback(
    (x: number) => {
      if (width <= 0) return;
      const t = Math.min(1, Math.max(0, x / width));
      onChange(Math.round(min + t * range));
    },
    [min, onChange, range, width],
  );

  const huePan = Gesture.Pan()
    .runOnJS(true)
    .onBegin(() => {
      dragStart.current = value;
    })
    .onChange((e) => {
      if (width <= 0) return;
      // Drag across the full width ≈ one HUE_WINDOW; repeatable for fine tuning
      const delta = (e.translationX / width) * HUE_WINDOW;
      onChange(clampHue(dragStart.current + delta));
    });

  const lightPan = Gesture.Pan()
    .runOnJS(true)
    .onBegin((e) => updateLightnessFromX(e.x))
    .onChange((e) => updateLightnessFromX(e.x));

  const lightTap = Gesture.Tap()
    .runOnJS(true)
    .onEnd((e) => updateLightnessFromX(e.x));

  const gesture =
    kind === 'hue' ? huePan : Gesture.Race(lightPan, lightTap);

  const light = Math.min(92, Math.max(8, value));
  const g = Math.round((light / 100) * 255);
  const centerColor = kind === 'hue' ? hslToHex(value, 50) : `rgb(${g},${g},${g})`;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>
          {Math.round(value)}
          {unit}
        </Text>
      </View>
      <GestureDetector gesture={gesture}>
        <View
          style={kind === 'hue' ? styles.trackHitHue : styles.trackHitLight}
          onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        >
          <LinearGradient
            colors={kind === 'hue' ? hueGradient : [...lightnessColors]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={kind === 'hue' ? styles.trackHue : styles.trackLight}
          />
          {kind === 'hue' ? (
            <>
              <View pointerEvents="none" style={styles.centerLine} />
              <View
                pointerEvents="none"
                style={[styles.centerSwatch, { backgroundColor: centerColor }]}
              />
            </>
          ) : (
            <View
              pointerEvents="none"
              style={[
                styles.thumbLight,
                {
                  left: Math.max(0, ratio * width - 7),
                  backgroundColor: centerColor,
                },
              ]}
            />
          )}
        </View>
      </GestureDetector>
      {kind === 'hue' ? (
        <Text style={styles.hint}>Drag left or right — colour shifts gradually</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    color: colors.onSurface,
    fontWeight: '600',
    fontSize: 14,
  },
  value: {
    color: colors.onSurfaceVariant,
    fontWeight: '700',
    fontSize: 13,
  },
  hint: {
    color: colors.onSurfaceVariant,
    fontSize: 11,
  },
  trackHitHue: {
    height: 44,
    justifyContent: 'center',
  },
  trackHitLight: {
    height: 22,
    justifyContent: 'center',
  },
  trackHue: {
    height: 36,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  trackLight: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  centerLine: {
    position: 'absolute',
    alignSelf: 'center',
    left: '50%',
    marginLeft: -1,
    width: 2,
    height: 44,
    backgroundColor: '#ffffff',
    opacity: 0.95,
  },
  centerSwatch: {
    position: 'absolute',
    alignSelf: 'center',
    left: '50%',
    marginLeft: -14,
    width: 28,
    height: 28,
    borderRadius: 4,
    top: 8,
  },
  thumbLight: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    top: 4,
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
});
