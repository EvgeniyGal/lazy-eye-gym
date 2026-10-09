import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { buildPalette } from '@/src/anaglyph/palette';
import {
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
  getActiveProfile,
  listProfiles,
  setActiveProfileId,
  swapEyeColors,
  upsertProfile,
} from '@/src/storage/profiles';
import { getJSON, hydrateStorage, setJSON } from '@/src/storage/mmkv';

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
  applyRedCyanPreset: () => void;
  getGameSettings: (gameId: GameId) => Record<string, string | number | boolean>;
  setGameSettings: (gameId: GameId, settings: Record<string, string | number | boolean>) => void;
  refresh: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

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
    setPrefs(getJSON(PREFS_KEY, DEFAULT_PREFS));
    setIntensityState(getJSON(INTENSITY_KEY, DEFAULT_INTENSITY));
    setGameSettingsState({ ...defaultGameSettings(), ...getJSON(GAME_SETTINGS_KEY, {}) });
  };

  useEffect(() => {
    void (async () => {
      await hydrateStorage();
      refresh();
      setReady(true);
    })();
  }, []);

  const activeProfile = useMemo(() => {
    return profiles.find((p) => p.isActive) ?? profiles[0] ?? getActiveProfile();
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
    applyRedCyanPreset: () => {
      const next = {
        ...activeProfile,
        leftHue: 0,
        leftLightness: 50,
        rightHue: 180,
        rightLightness: 50,
        name: activeProfile.name || 'Red/Cyan',
      };
      setProfiles(upsertProfile(next));
      setActiveProfileId(next.id);
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
