import { useEffect, useRef } from 'react';

import { useAppStore } from '@/src/state/AppStore';

import { acquireSfx, playSfx, releaseSfx, type SfxName } from './sfx';

/** Init shared SFX pool and play cues gated by game + global sound prefs. */
export function useGameAudio(settings: Record<string, string | number | boolean>) {
  const { prefs } = useAppStore();
  const soundOn = Boolean(settings.sound ?? true) && prefs.soundEffects;
  const soundRef = useRef(soundOn);
  const hapticRef = useRef(prefs.hapticFeedback);
  soundRef.current = soundOn;
  hapticRef.current = prefs.hapticFeedback;

  useEffect(() => {
    void acquireSfx();
    return () => releaseSfx();
  }, []);

  const sfx = (name: SfxName) =>
    playSfx(name, {
      soundEnabled: soundRef.current,
      hapticEnabled: hapticRef.current,
    });

  return { sfx, soundOn };
}
