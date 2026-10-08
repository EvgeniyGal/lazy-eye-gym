import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * AsyncStorage-backed key-value store used as the local settings layer
 * (plan: MMKV-equivalent device-local persistence for Expo Go compatibility).
 */
const memory = new Map<string, string>();
let hydrated = false;
let hydratePromise: Promise<void> | null = null;

export async function hydrateStorage() {
  if (hydrated) return;
  if (hydratePromise) return hydratePromise;
  hydratePromise = (async () => {
    const keys = await AsyncStorage.getAllKeys();
    if (keys.length) {
      const pairs = await AsyncStorage.multiGet(keys);
      for (const [key, value] of pairs) {
        if (value != null) memory.set(key, value);
      }
    }
    hydrated = true;
  })();
  return hydratePromise;
}

export function getString(key: string): string | undefined {
  return memory.get(key);
}

export function setString(key: string, value: string) {
  memory.set(key, value);
  void AsyncStorage.setItem(key, value);
}

export function deleteKey(key: string) {
  memory.delete(key);
  void AsyncStorage.removeItem(key);
}

export function getJSON<T>(key: string, fallback: T): T {
  const raw = getString(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function setJSON(key: string, value: unknown) {
  setString(key, JSON.stringify(value));
}
