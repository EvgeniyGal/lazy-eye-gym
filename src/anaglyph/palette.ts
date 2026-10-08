import {
  backgroundCss,
  eyeHex,
  neutralForeground,
  withOpacity,
  type EyeSide,
} from './color';
import type { DichopticPalette, GlassProfile, IntensityBalance } from './types';

export function buildPalette(
  profile: GlassProfile,
  intensity: IntensityBalance,
  lazyEyeEnabled: boolean,
): DichopticPalette {
  const left = eyeHex(profile, 'left');
  const right = eyeHex(profile, 'right');
  if (!lazyEyeEnabled) {
    return {
      left: '#dae2fd',
      right: '#dae2fd',
      leftAlpha: 1,
      rightAlpha: 1,
      background: backgroundCss(profile.background),
      neutral: neutralForeground(profile.background),
      enabled: false,
    };
  }
  return {
    left,
    right,
    leftAlpha: intensity.left / 100,
    rightAlpha: intensity.right / 100,
    background: backgroundCss(profile.background),
    neutral: neutralForeground(profile.background),
    enabled: true,
  };
}

export function colorForEye(palette: DichopticPalette, eye: EyeSide) {
  const base = eye === 'left' ? palette.left : palette.right;
  const alpha = eye === 'left' ? palette.leftAlpha : palette.rightAlpha;
  if (!palette.enabled) return palette.neutral;
  return withOpacity(base, alpha);
}

export function solidForEye(palette: DichopticPalette, eye: EyeSide) {
  if (!palette.enabled) return palette.neutral;
  return eye === 'left' ? palette.left : palette.right;
}
