// /assets/js/apiClient.js
(() => {
  "use strict";

  const DEFAULT_TIMEOUT_MS = 8000;

  const safeJson = async (res) => {
    const text = await res.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return { raw: text };
    }
  };

  const fetchJson = async (url, options = {}) => {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: options.method || "GET",
        headers: options.headers || {},
        signal: controller.signal,
        cache: "no-store",
      });
      if (!res.ok) {
        const body = await safeJson(res);
        const err = new Error(`Request failed: ${res.status}`);
        err.status = res.status;
        err.body = body;
        throw err;
      }
      return await safeJson(res);
    } finally {
      clearTimeout(id);
    }
  };

  const readCache = (key) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  const writeCache = (key, payload) => {
    try {
      localStorage.setItem(key, JSON.stringify(payload));
    } catch {
      return;
    }
  };

  const cachedFetchJson = async (url, options = {}) => {
    const cacheKey = options.cacheKey;
    const ttlMs = options.ttlMs || 0;
    const cached = cacheKey ? readCache(cacheKey) : null;
    const headers = { ...(options.headers || {}) };
    if (cached && cached.etag) headers["If-None-Match"] = cached.etag;

    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: "GET",
        headers,
        cache: "no-store",
        signal: controller.signal,
      });
      if (res.status === 304 && cached) {
        return cached.value;
      }
      if (!res.ok) {
        const body = await safeJson(res);
        const err = new Error(`Request failed: ${res.status}`);
        err.status = res.status;
        err.body = body;
        if (cached && ttlMs && Date.now() - cached.storedAt < ttlMs) {
          return cached.value;
        }
        throw err;
      }
      const data = await safeJson(res);
      const etag = res.headers.get("ETag");
      if (cacheKey) {
        writeCache(cacheKey, { value: data, etag, storedAt: Date.now() });
      }
      return data;
    } finally {
      clearTimeout(id);
    }
  };

  const getSettings = () => cachedFetchJson("/api/settings", { cacheKey: "hv.settings.api" });

  const getBlogs = ({ page = 1, pageSize = 12, q = "", tag = "" } = {}) => {
    const params = new URLSearchParams();
    if (page) params.set("page", String(page));
    if (pageSize) params.set("pageSize", String(pageSize));
    if (q) params.set("q", q);
    if (tag) params.set("tag", tag);
    const key = `hv.blogs.${page}.${pageSize}.${q}.${tag}`;
    return cachedFetchJson(`/api/blogs?${params.toString()}`, {
      cacheKey: key,
      ttlMs: 5 * 60 * 1000,
    });
  };

  const getBlogBySlug = (slug) => {
    if (!slug) return Promise.reject(new Error("missing_slug"));
    const key = `hv.blog.${slug}`;
    return cachedFetchJson(`/api/blogs/${encodeURIComponent(slug)}`, {
      cacheKey: key,
      ttlMs: 30 * 60 * 1000,
    });
  };

  window.HVApiClient = {
    fetchJson,
    getSettings,
    getBlogs,
    getBlogBySlug,
  };
})();
