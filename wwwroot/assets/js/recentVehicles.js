(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.HVRecentVehicles = api;
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  const STORAGE_KEY = "hv_recent_vehicles";
  const MAX_ITEMS = 5;
  const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

  function now() {
    return Date.now();
  }

  function normalizePlate(value) {
    return String(value || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  }

  function yearFromValue(value) {
    const match = String(value || "").match(/\b(19\d{2}|20\d{2})\b/);
    if (!match) return null;
    const year = Number.parseInt(match[1], 10);
    return Number.isFinite(year) ? year : null;
  }

  function storageAvailable(storage) {
    return storage && typeof storage.getItem === "function" && typeof storage.setItem === "function";
  }

  function cleanRoute(route) {
    const raw = String(route || "").trim();
    if (!raw) return "";
    try {
      const url = new URL(raw, "https://www.hulpveren.shop");
      return url.pathname || "";
    } catch (err) {
      return raw.startsWith("/") ? raw.split("?")[0].split("#")[0] : "";
    }
  }

  function normalizeItem(item, timestamp) {
    if (!item || typeof item !== "object") return null;
    const route = cleanRoute(item.route);
    if (!route) return null;

    const plate = normalizePlate(item.plate);
    const make = String(item.make || "").trim();
    const model = String(item.model || "").trim();
    const year = yearFromValue(item.year);
    const updatedAt = Number.parseInt(item.updatedAt || timestamp || now(), 10);
    if (!make && !model && !plate) return null;
    if (!Number.isFinite(updatedAt)) return null;

    return { plate, make, model, year, route, updatedAt };
  }

  function itemKey(item) {
    if (item.plate) return "plate:" + item.plate;
    return ["route", item.route, item.make.toLowerCase(), item.model.toLowerCase(), item.year || ""].join(":");
  }

  function prune(items, timestamp) {
    const cutoff = (timestamp || now()) - MAX_AGE_MS;
    const byKey = new Map();

    (Array.isArray(items) ? items : []).forEach(function (raw) {
      const item = normalizeItem(raw, timestamp);
      if (!item || item.updatedAt < cutoff) return;
      const key = itemKey(item);
      const existing = byKey.get(key);
      if (!existing || item.updatedAt > existing.updatedAt) {
        byKey.set(key, item);
      }
    });

    return Array.from(byKey.values())
      .sort(function (a, b) { return b.updatedAt - a.updatedAt; })
      .slice(0, MAX_ITEMS);
  }

  function read(storage, timestamp) {
    if (!storageAvailable(storage)) return [];
    try {
      const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || "[]");
      return prune(parsed, timestamp);
    } catch (err) {
      return [];
    }
  }

  function write(storage, items, timestamp) {
    if (!storageAvailable(storage)) return [];
    const clean = prune(items, timestamp);
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(clean));
    } catch (err) {}
    return clean;
  }

  function add(storage, item, timestamp) {
    const updatedAt = timestamp || now();
    const normalized = normalizeItem(Object.assign({}, item, { updatedAt }), updatedAt);
    if (!normalized) return read(storage, updatedAt);
    return write(storage, [normalized].concat(read(storage, updatedAt)), updatedAt);
  }

  function clear(storage) {
    if (!storage || typeof storage.removeItem !== "function") return;
    try {
      storage.removeItem(STORAGE_KEY);
    } catch (err) {}
  }

  return {
    STORAGE_KEY,
    MAX_ITEMS,
    MAX_AGE_MS,
    add,
    clear,
    cleanRoute,
    normalizePlate,
    prune,
    read,
    write,
  };
});
