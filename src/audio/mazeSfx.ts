import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

export type MazeSfxName = 'chomp' | 'power' | 'ghost' | 'death' | 'fruit' | 'level';

type SfxOptions = {
  soundEnabled: boolean;
  hapticEnabled?: boolean;
};

const sources: Record<MazeSfxName, number> = {
  chomp: require('../../assets/sfx/chomp.wav'),
  power: require('../../assets/sfx/power.wav'),
  ghost: require('../../assets/sfx/ghost.wav'),
  death: require('../../assets/sfx/death.wav'),
  fruit: require('../../assets/sfx/fruit.wav'),
  level: require('../../assets/sfx/level.wav'),
};

const chompAlt = require('../../assets/sfx/chomp2.wav');

let ready = false;
let players: Partial<Record<MazeSfxName, AudioPlayer>> = {};
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

export async function initMazeSfx() {
  if (ready) return;
  await ensureMode();
  try {
    (Object.keys(sources) as MazeSfxName[]).forEach((name) => {
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

export function disposeMazeSfx() {
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

export function playMazeSfx(name: MazeSfxName, opts: SfxOptions) {
  if (opts.hapticEnabled) {
    if (name === 'death') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else if (name === 'power' || name === 'ghost' || name === 'level') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      void Haptics.selectionAsync();
    }
  }

  if (!opts.soundEnabled || !ready) return;

  if (name === 'chomp') {
    chompFlip = !chompFlip;
    replay(chompFlip ? players.chomp : chompB);
    return;
  }
  replay(players[name]);
}
