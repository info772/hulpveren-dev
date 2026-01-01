const express = require("express");
const TtlCache = require("../cache/ttlCache");
const { getMenu, getMenuParts, UpstreamError } = require("../services/proxyClient");

const router = express.Router();
const MENU_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MENUPARTS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const menuCache = new TtlCache({ defaultTtlMs: MENU_CACHE_TTL_MS });
const partsCache = new TtlCache({ defaultTtlMs: MENUPARTS_CACHE_TTL_MS });

router.get("/menu", async (req, res, next) => {
  const cached = menuCache.get("menu");
  if (cached) {
    res.json(cached);
    return;
  }

  try {
    const result = await getMenu();
    res.locals.upstreamMs = result.upstreamMs;
    const payload = {
      items: result.data?.MenuItems || [],
    };
    menuCache.set("menu", payload);
    res.json(payload);
  } catch (err) {
    res.locals.upstreamMs = err.upstreamMs || null;
    if (err instanceof UpstreamError || err.code?.startsWith("UPSTREAM")) {
      res.status(502).json({ error: "upstream_error" });
      return;
    }
    next(err);
  }
});

router.get("/menuparts/:rootId/:nodeId", async (req, res, next) => {
  const rootId = Number.parseInt(req.params.rootId, 10);
  const nodeId = Number.parseInt(req.params.nodeId, 10);
  if (!Number.isFinite(rootId) || !Number.isFinite(nodeId)) {
    res.status(400).json({ error: "invalid_menu_params" });
    return;
  }

  const cacheKey = `${rootId}:${nodeId}`;
  const cached = partsCache.get(cacheKey);
  if (cached) {
    res.json(cached);
    return;
  }

  try {
    const result = await getMenuParts(rootId, nodeId);
    res.locals.upstreamMs = result.upstreamMs;
    const payload = {
      rootId,
      nodeId,
      items: result.data?.MenuItems || [],
    };
    partsCache.set(cacheKey, payload);
    res.json(payload);
  } catch (err) {
    res.locals.upstreamMs = err.upstreamMs || null;
    if (err instanceof UpstreamError || err.code?.startsWith("UPSTREAM")) {
      res.status(502).json({ error: "upstream_error" });
      return;
    }
    next(err);
  }
});

module.exports = router;
