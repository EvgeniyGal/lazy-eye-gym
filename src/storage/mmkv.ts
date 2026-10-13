import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * AsyncStorage-backed key-value store (in-memory cache + durable writes).
 * Call hydrateStorage() once at startup before reading/writing app settings.
 */
const memory = new Map<string, string>();
let hydrated = false;
let hydratePromise: Promise<void> | null = null;
/** Serializes AsyncStorage mutations so a pre-hydrate seed cannot race past hydrate. */
let writeChain: Promise<void> = Promise.resolve();

export function isStorageHydrated() {
  return hydrated;
}

export async function hydrateStorage() {
  if (hydrated) return;
  if (hydratePromise) return hydratePromise;
  hydratePromise = (async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      if (keys.length) {
        const pairs = await AsyncStorage.multiGet(keys);
        for (const [key, value] of pairs) {
          if (value != null) memory.set(key, value);
        }
      }
    } finally {
      hydrated = true;
    }
  })();
  return hydratePromise;
}

function enqueueWrite(op: () => Promise<void>) {
  writeChain = writeChain.then(op).catch(() => {
    // Keep the chain alive after a failed write
  });
  return writeChain;
}

export function getString(key: string): string | undefined {
  return memory.get(key);
}

export function setString(key: string, value: string) {
  memory.set(key, value);
  // Only persist after hydrate so we never overwrite disk with empty-cache seeds
  if (!hydrated) return;
  void enqueueWrite(() => AsyncStorage.setItem(key, value));
}

export function deleteKey(key: string) {
  memory.delete(key);
  if (!hydrated) return;
  void enqueueWrite(() => AsyncStorage.removeItem(key));
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

/** Flush pending AsyncStorage writes (e.g. before backgrounding). */
export async function flushStorage() {
  await writeChain;
}
