/**
 * Simple in-process TTL cache.
 * Used to avoid re-fetching apps and schema_fields from sqlite-hub on every
 * inbound submission — those tables change rarely (only on dashboard edits).
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

/**
 * Get a value from the cache
 * @param key Cache key
 * @returns The cached value, or null if not found or expired
 */
export function cacheGet<T>(key: string): T | null {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

/**
 * Set a value in the cache
 * @param key Cache key
 * @param value The value to cache
 * @param ttlMs Time to live in milliseconds (default 60 seconds)
 */
export function cacheSet<T>(key: string, value: T, ttlMs: number = 60_000): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/**
 * Remove one entry from the cache
 */
export function cacheDel(key: string): void {
  store.delete(key);
}
