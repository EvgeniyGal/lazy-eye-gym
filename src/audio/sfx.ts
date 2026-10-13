import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

/** Logical cue names used by games. */
export type SfxName =
  | 'chomp'
  | 'power'
  | 'ghost'
  | 'death'
  | 'fruit'
  | 'level'
  | 'hit'
  | 'score'
  | 'clear'
  | 'lock'
  | 'move';

type AssetKey = 'chomp' | 'power' | 'ghost' | 'death' | 'fruit' | 'level';

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
};

const chompAlt = require('../../assets/sfx/chomp2.wav');

/** Map game cues → wav assets. */
const RESOLVE: Record<SfxName, AssetKey> = {
  chomp: 'chomp',
  power: 'power',
  ghost: 'ghost',
  death: 'death',
  fruit: 'fruit',
  level: 'level',
  hit: 'ghost',
  score: 'fruit',
  clear: 'level',
  lock: 'chomp',
  move: 'chomp',
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
  if (name === 'death') {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } else if (name === 'power' || name === 'ghost' || name === 'level' || name === 'clear' || name === 'hit') {
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
