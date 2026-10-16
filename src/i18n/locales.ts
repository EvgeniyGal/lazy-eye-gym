import type { AppLanguagePreference } from '@/src/anaglyph/types';

export type AppLocale = 'en' | 'uk' | 'es' | 'de' | 'fr' | 'zh-CN';

export const APP_LOCALES: AppLocale[] = ['en', 'uk', 'es', 'de', 'fr', 'zh-CN'];

export const LANGUAGE_PICKER_OPTIONS: {
  value: AppLanguagePreference;
  label: string;
}[] = [
  { value: 'system', label: 'System default' },
  { value: 'en', label: 'English' },
  { value: 'uk', label: 'Українська' },
  { value: 'es', label: 'Español' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
  { value: 'zh-CN', label: '简体中文' },
];

type DeviceLocaleLike = {
  languageCode?: string | null;
  languageTag?: string | null;
  languageScriptCode?: string | null;
  regionCode?: string | null;
};

function mapDeviceLocale(locale: DeviceLocaleLike | undefined): AppLocale | null {
  if (!locale) return null;
  const tag = (locale.languageTag ?? '').toLowerCase();
  const code = (locale.languageCode ?? '').toLowerCase();
  const script = (locale.languageScriptCode ?? '').toLowerCase();
  const region = (locale.regionCode ?? '').toUpperCase();

  if (tag.startsWith('zh-hans') || tag === 'zh-cn' || tag.startsWith('zh-cn')) {
    return 'zh-CN';
  }
  if (code === 'zh') {
    if (script === 'hant') return null;
    if (script === 'hans' || region === 'CN' || region === 'SG' || !script) return 'zh-CN';
    return null;
  }

  if (code === 'en' || code === 'uk' || code === 'es' || code === 'de' || code === 'fr') {
    return code;
  }
  return null;
}

/** Resolve active app locale from prefs + device list. Unsupported → en. */
export function resolveAppLocale(
  preference: AppLanguagePreference | undefined,
  deviceLocales: DeviceLocaleLike[],
): AppLocale {
  if (preference && preference !== 'system') {
    return APP_LOCALES.includes(preference) ? preference : 'en';
  }
  for (const locale of deviceLocales) {
    const mapped = mapDeviceLocale(locale);
    if (mapped) return mapped;
  }
  return 'en';
}
