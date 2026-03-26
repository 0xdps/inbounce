/**
 * Simple in-process TTL cache.
 * Used to avoid re-fetching apps and schema_fields from sqlite-hub on every
 * inbound submission — those tables change rarely (only on dashboard edits).
 */

const store = new Map();

/**
 * @param {string} key
 * @returns {any|null}  null = miss or expired
 */
export function cacheGet(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

/**
 * @param {string} key
 * @param {any}    value
 * @param {number} ttlMs  default 60 seconds
 */
export function cacheSet(key, value, ttlMs = 60_000) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/** Remove one entry (call after schema/app is mutated). */
export function cacheDel(key) {
  store.delete(key);
}
