import Constants from 'expo-constants';
import { Platform } from 'react-native';

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
