import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { GameDefinition } from '@/src/games/catalog';
import { colors, spacing } from '@/src/theme/tokens';
import { Segmented, ToggleRow } from './ui';

export function GameSettingsForm({
  game,
  settings,
  onChange,
}: {
  game: GameDefinition;
  settings: Record<string, string | number | boolean>;
  onChange: (next: Record<string, string | number | boolean>) => void;
}) {
  return (
    <View style={styles.wrap}>
      {game.fields.map((field) => {
        const value = settings[field.key] ?? game.defaultSettings[field.key];
        if (field.type === 'segment' || field.type === 'eye') {
          return (
            <View key={field.key} style={styles.field}>
              <Text style={styles.label}>{field.label}</Text>
              <Segmented
                options={field.options.map((o) => ({ label: o.label, value: String(o.value) }))}
                value={String(value)}
                onChange={(v) => onChange({ ...settings, [field.key]: v })}
              />
            </View>
          );
        }
        if (field.type === 'toggle') {
          return (
            <ToggleRow
              key={field.key}
              label={field.label}
              value={Boolean(value)}
              onChange={(v) => onChange({ ...settings, [field.key]: v })}
            />
          );
        }
        const num = Number(value);
        return (
          <View key={field.key} style={styles.field}>
            <View style={styles.sliderHeader}>
              <Text style={styles.label}>{field.label}</Text>
              <Text style={styles.value}>{Number.isInteger(field.step) ? num : num.toFixed(1)}</Text>
            </View>
            <View style={styles.stepRow}>
              <Text
                style={styles.stepBtn}
                onPress={() =>
                  onChange({
                    ...settings,
                    [field.key]: Math.max(field.min, Number((num - field.step).toFixed(2))),
                  })
                }
              >
                −
              </Text>
              <View style={styles.track}>
                <View
                  style={[
                    styles.fill,
                    {
                      width: `${((num - field.min) / (field.max - field.min)) * 100}%`,
                    },
                  ]}
                />
              </View>
              <Text
                style={styles.stepBtn}
                onPress={() =>
                  onChange({
                    ...settings,
                    [field.key]: Math.min(field.max, Number((num + field.step).toFixed(2))),
                  })
                }
              >
                +
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.lg,
  },
  field: {
    gap: spacing.sm,
  },
  label: {
    color: colors.onSurface,
    fontWeight: '600',
    fontSize: 14,
  },
  value: {
    color: colors.primary,
    fontWeight: '700',
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    textAlign: 'center',
    textAlignVertical: 'center',
    overflow: 'hidden',
    backgroundColor: colors.surfaceHigh,
    color: colors.onSurface,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 34,
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
    backgroundColor: colors.primary,
  },
});
