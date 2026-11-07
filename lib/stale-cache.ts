const CACHE_PREFIX = "cf-tracker:swr:v1:";

export type StaleCacheRecord<T> = {
  data: T;
  savedAt: number;
};

export function readStaleRecord<T>(key: string): StaleCacheRecord<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(CACHE_PREFIX + key);
    if (!value) return null;
    const record = JSON.parse(value) as Partial<StaleCacheRecord<T>>;
    if (!record || typeof record.savedAt !== "number" || !("data" in record)) return null;
    return record as StaleCacheRecord<T>;
  } catch {
    return null;
  }
}

export function readStaleCache<T>(key: string): T | null {
  return readStaleRecord<T>(key)?.data ?? null;
}

export function writeStaleCache<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ data, savedAt: Date.now() }));
  } catch {
    // Storage can be disabled or full; the live request still works.
  }
}

export function clearStaleCache(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CACHE_PREFIX + key);
  } catch {
    // Ignore storage failures.
  }
}
