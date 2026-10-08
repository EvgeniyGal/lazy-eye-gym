import * as Crypto from 'expo-crypto';

import { resolveActiveProfileId, withLocalActiveFlag } from '@/src/anaglyph/device-profile';
import {
  ACTIVE_PROFILE_KEY,
  DEFAULT_COLORS,
  PROFILES_KEY,
  type GlassProfile,
} from '@/src/anaglyph/types';
import { getJSON, getString, setJSON, setString } from './mmkv';

function nowIso() {
  return new Date().toISOString();
}

export function createDefaultProfile(): GlassProfile {
  const id = Crypto.randomUUID();
  const stamp = nowIso();
  return {
    id,
    name: 'Default',
    isActive: true,
    ...DEFAULT_COLORS,
    background: 'black',
    createdAt: stamp,
    updatedAt: stamp,
  };
}

export function listProfiles(): GlassProfile[] {
  const stored = getJSON<GlassProfile[]>(PROFILES_KEY, []);
  if (stored.length === 0) {
    const fresh = [createDefaultProfile()];
    setJSON(PROFILES_KEY, fresh);
    setString(ACTIVE_PROFILE_KEY, fresh[0]!.id);
    return fresh;
  }
  const preferred = getString(ACTIVE_PROFILE_KEY) ?? null;
  const activeId = resolveActiveProfileId(stored, preferred);
  return withLocalActiveFlag(stored, activeId);
}

export function getActiveProfile(): GlassProfile {
  const profiles = listProfiles();
  return profiles.find((p) => p.isActive) ?? profiles[0]!;
}

export function setActiveProfileId(id: string) {
  const profiles = listProfiles();
  if (!profiles.some((p) => p.id === id)) return listProfiles();
  setString(ACTIVE_PROFILE_KEY, id);
  const next = withLocalActiveFlag(profiles, id);
  setJSON(PROFILES_KEY, next);
  return next;
}

export function upsertProfile(input: Omit<GlassProfile, 'createdAt' | 'updatedAt' | 'isActive'> & {
  id?: string;
  isActive?: boolean;
}) {
  const profiles = listProfiles();
  const stamp = nowIso();
  if (input.id && profiles.some((p) => p.id === input.id)) {
    const next = profiles.map((p) =>
      p.id === input.id
        ? {
            ...p,
            ...input,
            id: p.id,
            updatedAt: stamp,
          }
        : p,
    );
    setJSON(PROFILES_KEY, next);
    return listProfiles();
  }

  const id = input.id ?? Crypto.randomUUID();
  const profile: GlassProfile = {
    id,
    name: input.name,
    leftHue: input.leftHue,
    leftLightness: input.leftLightness,
    rightHue: input.rightHue,
    rightLightness: input.rightLightness,
    background: input.background,
    isActive: profiles.length === 0,
    createdAt: stamp,
    updatedAt: stamp,
  };
  const next = [...profiles, profile];
  setJSON(PROFILES_KEY, next);
  if (next.length === 1) setString(ACTIVE_PROFILE_KEY, id);
  return listProfiles();
}

export function deleteProfile(id: string) {
  const profiles = listProfiles().filter((p) => p.id !== id);
  if (profiles.length === 0) {
    const fresh = [createDefaultProfile()];
    setJSON(PROFILES_KEY, fresh);
    setString(ACTIVE_PROFILE_KEY, fresh[0]!.id);
    return fresh;
  }
  setJSON(PROFILES_KEY, profiles);
  const preferred = getString(ACTIVE_PROFILE_KEY) ?? null;
  const activeId = resolveActiveProfileId(profiles, preferred === id ? null : preferred);
  if (activeId) setString(ACTIVE_PROFILE_KEY, activeId);
  return listProfiles();
}

export function swapEyeColors(profile: GlassProfile): GlassProfile {
  return {
    ...profile,
    leftHue: profile.rightHue,
    leftLightness: profile.rightLightness,
    rightHue: profile.leftHue,
    rightLightness: profile.leftLightness,
    updatedAt: nowIso(),
  };
}
