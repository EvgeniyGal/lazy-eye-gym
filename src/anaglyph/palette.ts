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
  _lazyEyeEnabled = true,
): DichopticPalette {
  const left = eyeHex(profile, 'left');
  const right = eyeHex(profile, 'right');
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
  return withOpacity(base, alpha);
}

export function solidForEye(palette: DichopticPalette, eye: EyeSide) {
  return eye === 'left' ? palette.left : palette.right;
}
