import { StyleSheet } from 'react-native';

import { colors, radii, spacing } from '@/src/theme/tokens';

export const settingsStyles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  backText: {
    color: colors.primary,
    fontWeight: '600',
  },
  section: {
    color: colors.onSurface,
    fontWeight: '700',
    fontSize: 15,
    marginBottom: spacing.sm,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceHigh,
  },
  menuTextWrap: {
    flex: 1,
    gap: 4,
  },
  menuTitle: {
    color: colors.onSurface,
    fontWeight: '700',
    fontSize: 16,
  },
  menuSub: {
    color: colors.onSurfaceVariant,
    fontSize: 13,
    lineHeight: 18,
  },
  preview: {
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  intensityStage: {
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  circles: {
    flexDirection: 'row',
    gap: spacing.xxl,
    alignItems: 'center',
  },
  circleWrap: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  circle: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  circleLabel: {
    fontWeight: '700',
    fontSize: 13,
  },
  eyePanel: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  eyeTitle: {
    fontWeight: '800',
    fontSize: 16,
    marginBottom: spacing.md,
  },
  presetRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    flexWrap: 'wrap',
  },
  preset: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  presetText: {
    color: colors.onSurfaceVariant,
    fontWeight: '600',
    fontSize: 12,
  },
  timeRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  timeLabel: {
    color: colors.onSurfaceVariant,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  reminderNote: {
    color: colors.tertiary,
    fontSize: 12,
    marginTop: spacing.md,
    fontWeight: '600',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    textAlign: 'center',
    textAlignVertical: 'center',
    backgroundColor: colors.surfaceHigh,
    color: colors.onSurface,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 34,
  },
  stepVal: {
    flex: 1,
    textAlign: 'center',
    color: colors.onSurface,
    fontWeight: '700',
  },
  intensityHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  intensityLabel: {
    color: colors.onSurface,
    fontWeight: '600',
  },
  intensityVal: {
    fontWeight: '800',
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
  },
  langList: {
    gap: spacing.sm,
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  langRowActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceHighest,
  },
  langText: {
    color: colors.onSurfaceVariant,
    fontWeight: '600',
    fontSize: 14,
  },
  langTextActive: {
    color: colors.onSurface,
    fontWeight: '700',
  },
  saved: {
    color: colors.tertiary,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
});
