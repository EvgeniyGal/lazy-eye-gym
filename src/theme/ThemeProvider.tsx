import { DarkTheme, ThemeProvider as NavThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, type ColorSchemeName } from 'react-native';

import type { AppColorSchemePreference } from '@/src/anaglyph/types';
import { useAppStore } from '@/src/state/AppStore';

import { darkColors, lightColors, type ThemeColors } from './tokens';

export type ResolvedScheme = 'light' | 'dark';

type ThemeContextValue = {
  preference: AppColorSchemePreference;
  scheme: ResolvedScheme;
  colors: ThemeColors;
  setColorScheme: (preference: AppColorSchemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const LightTheme = {
  ...DarkTheme,
  dark: false,
  colors: {
    ...DarkTheme.colors,
    primary: 'rgb(0, 122, 255)',
    background: 'rgb(242, 242, 242)',
    card: 'rgb(255, 255, 255)',
    text: 'rgb(28, 28, 30)',
    border: 'rgb(216, 216, 216)',
    notification: 'rgb(255, 59, 48)',
  },
};

function resolveScheme(
  preference: AppColorSchemePreference,
  system: ColorSchemeName,
): ResolvedScheme {
  if (preference === 'light' || preference === 'dark') return preference;
  return system === 'light' ? 'light' : 'dark';
}

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const { prefs, updatePrefs } = useAppStore();
  const preference = prefs.colorScheme ?? 'system';
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(
    () => Appearance.getColorScheme() ?? 'dark',
  );

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme ?? 'dark');
    });
    return () => sub.remove();
  }, []);

  const scheme = resolveScheme(preference, systemScheme);
  const colors = scheme === 'light' ? lightColors : darkColors;

  const setColorScheme = useCallback(
    (next: AppColorSchemePreference) => {
      updatePrefs({ colorScheme: next });
    },
    [updatePrefs],
  );

  const value = useMemo(
    () => ({ preference, scheme, colors, setColorScheme }),
    [preference, scheme, colors, setColorScheme],
  );

  const navTheme = useMemo(() => {
    const base = scheme === 'light' ? LightTheme : DarkTheme;
    return {
      ...base,
      dark: scheme === 'dark',
      colors: {
        ...base.colors,
        background: colors.background,
        card: colors.surface,
        primary: colors.primary,
        text: colors.onSurface,
        border: colors.outlineVariant,
      },
    };
  }, [scheme, colors]);

  return (
    <ThemeContext.Provider value={value}>
      <NavThemeProvider value={navTheme}>
        <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
        {children}
      </NavThemeProvider>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      preference: 'system' as AppColorSchemePreference,
      scheme: 'dark' as ResolvedScheme,
      colors: darkColors,
      setColorScheme: (_p: AppColorSchemePreference) => undefined,
    };
  }
  return ctx;
}

export function useColors(): ThemeColors {
  return useTheme().colors;
}
