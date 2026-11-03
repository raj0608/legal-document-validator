// Remembers lookup answers for a while, so the same filing checked twice does not use the database's limit twice.
// In memory only, and made inside createApp, so each test gets a fresh one.
export function createLookupCache({ ttlMs = 60 * 60 * 1000, now = Date.now } = {}) {
  const seen = new Map();
  return {
    get(key) {
      const hit = seen.get(key);
      if (!hit) return undefined;
      if (hit.until < now()) { seen.delete(key); return undefined; }
      return hit.value;
    },
    set(key, value) { seen.set(key, { value, until: now() + ttlMs }); }
  };
}
