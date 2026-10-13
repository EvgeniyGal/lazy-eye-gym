import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { buildPalette } from '@/src/anaglyph/palette';
import {
  DEFAULT_COLORS,
  DEFAULT_INTENSITY,
  DEFAULT_PREFS,
  GAME_SETTINGS_KEY,
  INTENSITY_KEY,
  PREFS_KEY,
  type AppPrefs,
  type DichopticPalette,
  type GlassProfile,
  type IntensityBalance,
} from '@/src/anaglyph/types';
import type { GameId } from '@/src/games/catalog';
import { GAMES } from '@/src/games/catalog';
import {
  deleteProfile,
  listProfiles,
  setActiveProfileId,
  swapEyeColors,
  upsertProfile,
} from '@/src/storage/profiles';
import { flushStorage, getJSON, hydrateStorage, setJSON } from '@/src/storage/mmkv';

type GameSettingsMap = Record<string, Record<string, string | number | boolean>>;

type AppContextValue = {
  ready: boolean;
  profiles: GlassProfile[];
  activeProfile: GlassProfile;
  prefs: AppPrefs;
  intensity: IntensityBalance;
  palette: DichopticPalette;
  gameSettings: GameSettingsMap;
  updatePrefs: (patch: Partial<AppPrefs>) => void;
  setIntensity: (next: IntensityBalance) => void;
  selectProfile: (id: string) => void;
  saveProfile: (profile: GlassProfile) => void;
  removeProfile: (id: string) => void;
  swapEyes: () => void;
  getGameSettings: (gameId: GameId) => Record<string, string | number | boolean>;
  setGameSettings: (gameId: GameId, settings: Record<string, string | number | boolean>) => void;
  refresh: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

/** In-memory placeholder only — never persisted; used before hydrate finishes. */
const PLACEHOLDER_PROFILE: GlassProfile = {
  id: '__placeholder__',
  name: 'Default',
  isActive: true,
  ...DEFAULT_COLORS,
  background: 'black',
  createdAt: '',
  updatedAt: '',
};

function defaultGameSettings(): GameSettingsMap {
  return Object.fromEntries(GAMES.map((g) => [g.id, { ...g.defaultSettings }]));
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [profiles, setProfiles] = useState<GlassProfile[]>([]);
  const [prefs, setPrefs] = useState<AppPrefs>(DEFAULT_PREFS);
  const [intensity, setIntensityState] = useState<IntensityBalance>(DEFAULT_INTENSITY);
  const [gameSettings, setGameSettingsState] = useState<GameSettingsMap>(defaultGameSettings());

  const refresh = () => {
    setProfiles(listProfiles());
    setPrefs({ ...DEFAULT_PREFS, ...getJSON(PREFS_KEY, {}) });
    setIntensityState({ ...DEFAULT_INTENSITY, ...getJSON(INTENSITY_KEY, {}) });
    setGameSettingsState({ ...defaultGameSettings(), ...getJSON(GAME_SETTINGS_KEY, {}) });
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await hydrateStorage();
      if (cancelled) return;
      refresh();
      const loaded = { ...DEFAULT_PREFS, ...getJSON(PREFS_KEY, {}) };
      if (loaded.remindersEnabled) {
        void import('@/src/notifications/reminders').then(({ syncReminders }) =>
          syncReminders(loaded),
        );
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Flush pending AsyncStorage writes when the app backgrounds / closes
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        void flushStorage();
      }
    });
    return () => sub.remove();
  }, []);

  const activeProfile = useMemo(() => {
    return profiles.find((p) => p.isActive) ?? profiles[0] ?? PLACEHOLDER_PROFILE;
  }, [profiles]);

  const palette = useMemo(
    () => buildPalette(activeProfile, intensity, true),
    [activeProfile, intensity],
  );

  const value: AppContextValue = {
    ready,
    profiles,
    activeProfile,
    prefs,
    intensity,
    palette,
    gameSettings,
    refresh,
    updatePrefs: (patch) => {
      const next = { ...prefs, ...patch };
      setPrefs(next);
      setJSON(PREFS_KEY, next);
    },
    setIntensity: (next) => {
      setIntensityState(next);
      setJSON(INTENSITY_KEY, next);
    },
    selectProfile: (id) => {
      setProfiles(setActiveProfileId(id));
    },
    saveProfile: (profile) => {
      setProfiles(upsertProfile(profile));
      setActiveProfileId(profile.id);
      setProfiles(listProfiles());
    },
    removeProfile: (id) => {
      setProfiles(deleteProfile(id));
    },
    swapEyes: () => {
      const swapped = swapEyeColors(activeProfile);
      setProfiles(upsertProfile(swapped));
      setActiveProfileId(swapped.id);
      setProfiles(listProfiles());
    },
    getGameSettings: (gameId) => {
      const game = GAMES.find((g) => g.id === gameId);
      return { ...(game?.defaultSettings ?? {}), ...(gameSettings[gameId] ?? {}) };
    },
    setGameSettings: (gameId, settings) => {
      const next = { ...gameSettings, [gameId]: settings };
      setGameSettingsState(next);
      setJSON(GAME_SETTINGS_KEY, next);
    },
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppStore() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppStore must be used within AppProvider');
  return ctx;
}
