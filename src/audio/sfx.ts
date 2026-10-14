import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

/** Logical cue names used by games (maze + per-game tailored). */
export type SfxName =
  // Maze
  | 'chomp'
  | 'power'
  | 'ghost'
  | 'death'
  | 'fruit'
  | 'level'
  // Legacy aliases (still resolve)
  | 'hit'
  | 'score'
  | 'clear'
  | 'lock'
  | 'move'
  // Pong
  | 'pong_paddle'
  | 'pong_wall'
  | 'pong_score'
  | 'pong_miss'
  | 'pong_win'
  | 'pong_orb'
  // Breaker
  | 'brk_hit'
  | 'brk_break'
  | 'brk_power'
  | 'brk_life'
  | 'brk_stage'
  // Snake
  | 'snk_eat'
  | 'snk_bonus'
  | 'snk_die'
  // Tetris
  | 'tet_rotate'
  | 'tet_lock'
  | 'tet_clear'
  | 'tet_tetris'
  | 'tet_over'
  // 2048
  | 't48_move'
  | 't48_merge'
  | 't48_over'
  // Invaders
  | 'inv_shoot'
  | 'inv_hit'
  | 'inv_die'
  | 'inv_wave'
  | 'inv_bomb'
  // Asteroids
  | 'ast_thrust'
  | 'ast_shoot'
  | 'ast_bang'
  | 'ast_split'
  | 'ast_die';

type AssetKey =
  | 'chomp'
  | 'power'
  | 'ghost'
  | 'death'
  | 'fruit'
  | 'level'
  | 'pong_paddle'
  | 'pong_wall'
  | 'pong_score'
  | 'pong_miss'
  | 'pong_win'
  | 'pong_orb'
  | 'brk_hit'
  | 'brk_break'
  | 'brk_power'
  | 'brk_life'
  | 'brk_stage'
  | 'snk_eat'
  | 'snk_bonus'
  | 'snk_die'
  | 'tet_rotate'
  | 'tet_lock'
  | 'tet_clear'
  | 'tet_tetris'
  | 'tet_over'
  | 't48_move'
  | 't48_merge'
  | 't48_over'
  | 'inv_shoot'
  | 'inv_hit'
  | 'inv_die'
  | 'inv_wave'
  | 'inv_bomb'
  | 'ast_thrust'
  | 'ast_shoot'
  | 'ast_bang'
  | 'ast_split'
  | 'ast_die';

export type SfxOptions = {
  soundEnabled: boolean;
  hapticEnabled?: boolean;
};

const sources: Record<AssetKey, number> = {
  chomp: require('../../assets/sfx/chomp.wav'),
  power: require('../../assets/sfx/power.wav'),
  ghost: require('../../assets/sfx/ghost.wav'),
  death: require('../../assets/sfx/death.wav'),
  fruit: require('../../assets/sfx/fruit.wav'),
  level: require('../../assets/sfx/level.wav'),
  pong_paddle: require('../../assets/sfx/pong_paddle.wav'),
  pong_wall: require('../../assets/sfx/pong_wall.wav'),
  pong_score: require('../../assets/sfx/pong_score.wav'),
  pong_miss: require('../../assets/sfx/pong_miss.wav'),
  pong_win: require('../../assets/sfx/pong_win.wav'),
  pong_orb: require('../../assets/sfx/pong_orb.wav'),
  brk_hit: require('../../assets/sfx/brk_hit.wav'),
  brk_break: require('../../assets/sfx/brk_break.wav'),
  brk_power: require('../../assets/sfx/brk_power.wav'),
  brk_life: require('../../assets/sfx/brk_life.wav'),
  brk_stage: require('../../assets/sfx/brk_stage.wav'),
  snk_eat: require('../../assets/sfx/snk_eat.wav'),
  snk_bonus: require('../../assets/sfx/snk_bonus.wav'),
  snk_die: require('../../assets/sfx/snk_die.wav'),
  tet_rotate: require('../../assets/sfx/tet_rotate.wav'),
  tet_lock: require('../../assets/sfx/tet_lock.wav'),
  tet_clear: require('../../assets/sfx/tet_clear.wav'),
  tet_tetris: require('../../assets/sfx/tet_tetris.wav'),
  tet_over: require('../../assets/sfx/tet_over.wav'),
  t48_move: require('../../assets/sfx/t48_move.wav'),
  t48_merge: require('../../assets/sfx/t48_merge.wav'),
  t48_over: require('../../assets/sfx/t48_over.wav'),
  inv_shoot: require('../../assets/sfx/inv_shoot.wav'),
  inv_hit: require('../../assets/sfx/inv_hit.wav'),
  inv_die: require('../../assets/sfx/inv_die.wav'),
  inv_wave: require('../../assets/sfx/inv_wave.wav'),
  inv_bomb: require('../../assets/sfx/inv_bomb.wav'),
  ast_thrust: require('../../assets/sfx/ast_thrust.wav'),
  ast_shoot: require('../../assets/sfx/ast_shoot.wav'),
  ast_bang: require('../../assets/sfx/ast_bang.wav'),
  ast_split: require('../../assets/sfx/ast_split.wav'),
  ast_die: require('../../assets/sfx/ast_die.wav'),
};

const chompAlt = require('../../assets/sfx/chomp2.wav');

const RESOLVE: Record<SfxName, AssetKey> = {
  chomp: 'chomp',
  power: 'power',
  ghost: 'ghost',
  death: 'death',
  fruit: 'fruit',
  level: 'level',
  hit: 'brk_hit',
  score: 'pong_score',
  clear: 'tet_clear',
  lock: 'tet_lock',
  move: 't48_move',
  pong_paddle: 'pong_paddle',
  pong_wall: 'pong_wall',
  pong_score: 'pong_score',
  pong_miss: 'pong_miss',
  pong_win: 'pong_win',
  pong_orb: 'pong_orb',
  brk_hit: 'brk_hit',
  brk_break: 'brk_break',
  brk_power: 'brk_power',
  brk_life: 'brk_life',
  brk_stage: 'brk_stage',
  snk_eat: 'snk_eat',
  snk_bonus: 'snk_bonus',
  snk_die: 'snk_die',
  tet_rotate: 'tet_rotate',
  tet_lock: 'tet_lock',
  tet_clear: 'tet_clear',
  tet_tetris: 'tet_tetris',
  tet_over: 'tet_over',
  t48_move: 't48_move',
  t48_merge: 't48_merge',
  t48_over: 't48_over',
  inv_shoot: 'inv_shoot',
  inv_hit: 'inv_hit',
  inv_die: 'inv_die',
  inv_wave: 'inv_wave',
  inv_bomb: 'inv_bomb',
  ast_thrust: 'ast_thrust',
  ast_shoot: 'ast_shoot',
  ast_bang: 'ast_bang',
  ast_split: 'ast_split',
  ast_die: 'ast_die',
};

let ready = false;
let users = 0;
let players: Partial<Record<AssetKey, AudioPlayer>> = {};
let chompB: AudioPlayer | null = null;
let chompFlip = false;
let modeConfigured = false;

async function ensureMode() {
  if (modeConfigured) return;
  modeConfigured = true;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
      shouldPlayInBackground: false,
    });
  } catch {
    // Expo Go / web may ignore mode
  }
}

async function initPool() {
  if (ready) return;
  await ensureMode();
  try {
    (Object.keys(sources) as AssetKey[]).forEach((name) => {
      players[name] = createAudioPlayer(sources[name], { keepAudioSessionActive: true });
      players[name]!.volume = 0.85;
    });
    chompB = createAudioPlayer(chompAlt, { keepAudioSessionActive: true });
    chompB.volume = 0.85;
    ready = true;
  } catch {
    ready = false;
  }
}

function disposePool() {
  Object.values(players).forEach((p) => {
    try {
      p?.remove();
    } catch {
      /* ignore */
    }
  });
  try {
    chompB?.remove();
  } catch {
    /* ignore */
  }
  players = {};
  chompB = null;
  ready = false;
}

export async function acquireSfx() {
  users += 1;
  await initPool();
}

export function releaseSfx() {
  users = Math.max(0, users - 1);
  if (users === 0) disposePool();
}

function replay(player: AudioPlayer | undefined | null) {
  if (!player) return;
  try {
    void player.seekTo(0).then(() => {
      player.play();
    });
  } catch {
    /* ignore */
  }
}

function hapticFor(name: SfxName) {
  if (
    name === 'death' ||
    name === 'pong_miss' ||
    name === 'brk_life' ||
    name === 'snk_die' ||
    name === 'tet_over' ||
    name === 't48_over'
  ) {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } else if (
    name === 'power' ||
    name === 'ghost' ||
    name === 'level' ||
    name === 'clear' ||
    name === 'hit' ||
    name === 'pong_paddle' ||
    name === 'brk_break' ||
    name === 'brk_stage' ||
    name === 'tet_tetris' ||
    name === 'pong_win' ||
    name === 't48_merge'
  ) {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } else {
    void Haptics.selectionAsync();
  }
}

export function playSfx(name: SfxName, opts: SfxOptions) {
  if (opts.hapticEnabled) hapticFor(name);
  if (!opts.soundEnabled || !ready) return;

  const asset = RESOLVE[name];
  if (asset === 'chomp') {
    chompFlip = !chompFlip;
    replay(chompFlip ? players.chomp : chompB);
    return;
  }
  replay(players[asset]);
}
