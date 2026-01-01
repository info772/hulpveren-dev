const express = require("express");
const { requireAdminKey } = require("../middleware/requireAdminKey");
const {
  listAdminBlogsV2,
  getBlogBySlugV2,
  saveBlogV2,
  getLegacyDebugInfo,
} = require("../services/blogRepository");
const { renderBlocksToHtml, normalizeBlocks } = require("../services/blogBlocks");

module.exports = (db) => {
  const router = express.Router();

  router.use(requireAdminKey);

  router.get("/debug", (req, res) => {
    res.json(getLegacyDebugInfo());
  });

  router.get("/", (req, res) => {
    const items = listAdminBlogsV2(db, {
      status: req.query.status,
      search: req.query.q || req.query.search,
    });
    res.json({ items, total: items.length });
  });

  router.get("/:slug", (req, res) => {
    const blog = getBlogBySlugV2(db, req.params.slug, false);
    if (!blog) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({
      item: {
        ...blog,
        renderedHtml: blog.renderedHtml || renderBlocksToHtml(blog.blocks || [], blog.slug),
      },
    });
  });

  router.post("/", (req, res) => {
    const payload = req.body?.item || req.body || {};
    const result = saveBlogV2(db, payload.slug || payload.title, payload);
    if (result.errors) {
      res.status(400).json({ error: "validation_error", details: result.errors });
      return;
    }
    res.json({ ok: true, item: result.blog });
  });

  router.put("/:slug", (req, res) => {
    const payload = req.body?.item || req.body || {};
    const result = saveBlogV2(db, req.params.slug, payload);
    if (result.errors) {
      res.status(400).json({ error: "validation_error", details: result.errors });
      return;
    }
    res.json({ ok: true, item: result.blog });
  });

  router.post("/:slug/render", (req, res) => {
    const payload = req.body?.item || req.body || {};
    let blocksInput = payload.blocks || [];
    if (typeof blocksInput === "string") {
      try {
        blocksInput = JSON.parse(blocksInput);
      } catch {
        blocksInput = [];
      }
    }
    const normalized = normalizeBlocks(blocksInput);
    if (normalized.errors.length) {
      res.status(400).json({ error: "validation_error", details: normalized.errors });
      return;
    }
    const html = renderBlocksToHtml(normalized.blocks, req.params.slug);
    res.json({ renderedHtml: html });
  });

  return router;
};
