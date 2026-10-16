import { getLocales } from 'expo-localization';
import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';

import type { AppLanguagePreference } from '@/src/anaglyph/types';
import { useAppStore } from '@/src/state/AppStore';

import { i18n, setI18nLocale, t as translate, type TranslateOptions } from './i18n';
import { resolveAppLocale, type AppLocale } from './locales';

type I18nContextValue = {
  locale: AppLocale;
  languagePreference: AppLanguagePreference;
  t: (key: string, options?: TranslateOptions) => string;
  setLanguage: (language: AppLanguagePreference) => void;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const { prefs, updatePrefs } = useAppStore();
  const preference = prefs.language ?? 'system';

  const locale = useMemo(
    () => resolveAppLocale(preference, getLocales()),
    [preference],
  );

  useEffect(() => {
    setI18nLocale(locale);
  }, [locale]);

  // Sync immediately so first paint after preference change is correct.
  if (i18n.locale !== locale) {
    setI18nLocale(locale);
  }

  const t = useCallback(
    (key: string, options?: TranslateOptions) => {
      void locale;
      return translate(key, options);
    },
    [locale],
  );

  const setLanguage = useCallback(
    (language: AppLanguagePreference) => {
      updatePrefs({ language });
    },
    [updatePrefs],
  );

  const value = useMemo(
    () => ({
      locale,
      languagePreference: preference,
      t,
      setLanguage,
    }),
    [locale, preference, setLanguage, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Fallback for early/unwrapped calls (e.g. modules reading i18n.t directly)
    return {
      locale: (i18n.locale as AppLocale) || 'en',
      languagePreference: 'system' as AppLanguagePreference,
      t: translate,
      setLanguage: (_language: AppLanguagePreference) => undefined,
    };
  }
  return ctx;
}
