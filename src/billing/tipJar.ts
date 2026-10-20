import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { getString, setString } from '@/src/storage/mmkv';

/** Consumable Play / Store tip product IDs (create in Play Console). */
export const TIP_PRODUCT_IDS = ['tip_coffee', 'tip_boost', 'tip_champion'] as const;

export type TipProductId = (typeof TIP_PRODUCT_IDS)[number];

export const TIP_LABEL_KEYS: Record<TipProductId, string> = {
  tip_coffee: 'support.tipCoffee',
  tip_boost: 'support.tipBoost',
  tip_champion: 'support.tipChampion',
};

export const TIP_HINT_KEYS: Record<TipProductId, string> = {
  tip_coffee: 'support.tipCoffeeHint',
  tip_boost: 'support.tipBoostHint',
  tip_champion: 'support.tipChampionHint',
};

const HOME_SNOOZE_KEY = 'support.homeCardSnoozeUntil';
/** Soft-prompt snooze: 14 days after "Maybe later". */
const HOME_SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;

/** Billing needs a native build — not Expo Go or web. */
export function isTipJarAvailable(): boolean {
  if (Platform.OS === 'web') return false;
  if (
    Constants.appOwnership === 'expo' ||
    Constants.executionEnvironment === 'storeClient'
  ) {
    return false;
  }
  return true;
}

export function isHomeSupportCardVisible(): boolean {
  const raw = getString(HOME_SNOOZE_KEY);
  if (!raw) return true;
  const until = Number(raw);
  if (!Number.isFinite(until)) return true;
  return Date.now() >= until;
}

export function snoozeHomeSupportCard() {
  setString(HOME_SNOOZE_KEY, String(Date.now() + HOME_SNOOZE_MS));
}
