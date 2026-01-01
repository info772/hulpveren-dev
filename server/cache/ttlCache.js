class TtlCache {
  constructor(options = {}) {
    this.defaultTtlMs = options.defaultTtlMs || 0;
    this.store = new Map();
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key, value, ttlMs) {
    const ttl = typeof ttlMs === "number" ? ttlMs : this.defaultTtlMs;
    const expiresAt = ttl ? Date.now() + ttl : null;
    this.store.set(key, { value, expiresAt });
  }

  delete(key) {
    this.store.delete(key);
  }
}

module.exports = TtlCache;
