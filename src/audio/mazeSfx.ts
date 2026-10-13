/**
 * Maze-specific aliases over the shared SFX pool.
 * Prefer `@/src/audio/sfx` for new games.
 */
import { acquireSfx, playSfx, releaseSfx, type SfxOptions } from './sfx';

export type MazeSfxName = 'chomp' | 'power' | 'ghost' | 'death' | 'fruit' | 'level';

export async function initMazeSfx() {
  await acquireSfx();
}

export function disposeMazeSfx() {
  releaseSfx();
}

export function playMazeSfx(name: MazeSfxName, opts: SfxOptions) {
  playSfx(name, opts);
}
