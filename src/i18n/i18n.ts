import { I18n } from 'i18n-js';

import type { AppLocale } from './locales';
import { de } from './translations/de';
import { en } from './translations/en';
import { es } from './translations/es';
import { fr } from './translations/fr';
import { uk } from './translations/uk';
import { zhCN } from './translations/zh-CN';

export const i18n = new I18n({
  en,
  uk,
  es,
  de,
  fr,
  'zh-CN': zhCN,
});

i18n.defaultLocale = 'en';
i18n.enableFallback = true;
i18n.locale = 'en';

export type TranslateOptions = Record<string, string | number>;

export function t(key: string, options?: TranslateOptions): string {
  return i18n.t(key, options);
}

export function setI18nLocale(locale: AppLocale) {
  i18n.locale = locale;
}
