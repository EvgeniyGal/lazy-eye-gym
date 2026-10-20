import type { SfxName } from '@/src/audio/sfx';

import type { PowerOrbKind } from './powerOrbs';

/** Soft chirp when any power drop appears. */
export const POWER_SPAWN_SFX: SfxName = 'pwr_spawn';

const KIND_SFX: Record<PowerOrbKind, SfxName> = {
  swap: 'pwr_swap',
  shield: 'pwr_shield',
  slow: 'pwr_slow',
  grow: 'pwr_grow',
  wide: 'pwr_grow',
  shrink: 'pwr_shrink',
  turbo: 'pwr_speed',
  boost: 'pwr_speed',
  overdrive: 'pwr_speed',
  reverse: 'pwr_reverse',
  multi: 'pwr_multi',
  spray: 'pwr_multi',
  laser: 'pwr_laser',
  rocket: 'pwr_rocket',
  bomb: 'pwr_bomb',
  nova: 'pwr_bomb',
  repulsor: 'pwr_repulsor',
};

export function sfxForPowerKind(kind: PowerOrbKind): SfxName {
  return KIND_SFX[kind];
}
