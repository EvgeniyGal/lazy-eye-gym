import type { AnaglyphBackground, AnaglyphColors, EyeSide } from './color';

export type GlassProfile = AnaglyphColors & {
  id: string;
  name: string;
  isActive: boolean;
  background: AnaglyphBackground;
  createdAt: string;
  updatedAt: string;
};

export type IntensityBalance = {
  left: number;
  right: number;
};

export type ReminderFrequency = 'daily' | 'weekdays' | 'every2days' | 'weekly';

export type AppPrefs = {
  lazyEyeEnabled: boolean;
  soundEffects: boolean;
  hapticFeedback: boolean;
  autoPauseOnStrain: boolean;
  driftSpeed: 'easy' | 'medium' | 'fast';
  displayName: string;
  remindersEnabled: boolean;
  reminderHour: number;
  reminderMinute: number;
  reminderFrequency: ReminderFrequency;
};

export type DichopticPalette = {
  left: string;
  right: string;
  leftAlpha: number;
  rightAlpha: number;
  background: string;
  neutral: string;
  enabled: boolean;
};

export type EyeRoles<T extends string = string> = Record<T, EyeSide>;

export const DEFAULT_COLORS: AnaglyphColors = {
  leftHue: 0,
  leftLightness: 50,
  rightHue: 180,
  rightLightness: 50,
};

export const DEFAULT_INTENSITY: IntensityBalance = {
  left: 85,
  right: 60,
};

export const DEFAULT_PREFS: AppPrefs = {
  lazyEyeEnabled: true,
  soundEffects: true,
  hapticFeedback: true,
  autoPauseOnStrain: true,
  driftSpeed: 'medium',
  displayName: 'Vision Athlete',
  remindersEnabled: false,
  reminderHour: 18,
  reminderMinute: 0,
  reminderFrequency: 'daily',
};

export const ACTIVE_PROFILE_KEY = 'anaglyph.activeProfileId';
export const PROFILES_KEY = 'anaglyph.profiles';
export const PREFS_KEY = 'lazyeye.prefs';
export const INTENSITY_KEY = 'lazyeye.intensity';
export const GAME_SETTINGS_KEY = 'lazyeye.gameSettings';
