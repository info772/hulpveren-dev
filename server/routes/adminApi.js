const express = require("express");
const { requireAdmin } = require("../middleware/requireAdmin");
const { heroUpload, madUpload } = require("../services/uploads");
const { sanitizeSlug, normalizeStatus } = require("../services/validators");
const { createBlog, updateBlog, deleteBlog, buildBlogJson } = require("../services/blogService");
const { handleMadUpload, setCurrentImport, rebuildMadIndexFromCurrent } = require("../services/madService");
const { updateSettings } = require("../services/settingsService");
const { createRedirect, updateRedirect, deleteRedirect, writeRedirectsJson } = require("../services/redirectService");
const { renameGemonteerdImage } = require("../services/gemonteerdService");

function getHeroPath(file, slug) {
  if (!file) return "";
  const safeSlug = slug || "draft";
  return `/storage/blogs/${safeSlug}/${file.filename}`;
}

module.exports = (db, csrfProtection) => {
  const router = express.Router();

  router.use(requireAdmin);
  router.use(csrfProtection);

  router.post("/blogs", heroUpload.single("heroImage"), (req, res, next) => {
    try {
      const action = String(req.body.action || "").toLowerCase();
      const id = req.body.id ? Number.parseInt(req.body.id, 10) : null;
      const slug = sanitizeSlug(req.body.slug || req.body.title);
      const payload = {
        slug,
        title: req.body.title,
        excerpt: req.body.excerpt,
        content: req.body.content,
        category: req.body.category,
        author: req.body.author,
        date: req.body.date,
        readTime: req.body.readTime,
      };
      if (Object.prototype.hasOwnProperty.call(req.body, "status")) {
        payload.status = normalizeStatus(req.body.status);
      }

      if (req.file && slug) {
        payload.heroImagePath = getHeroPath(req.file, slug);
      }

      if (action === "delete" && id) {
        deleteBlog(db, id);
        res.json({ ok: true });
        return;
      }

      if (action === "update" && id) {
        const result = updateBlog(db, id, payload);
        if (result.errors) {
          res.status(400).json({ error: "validation_error", details: result.errors });
          return;
        }
        res.json({ ok: true, blog: result.blog });
        return;
      }

      const result = createBlog(db, payload);
      if (result.errors) {
        res.status(400).json({ error: "validation_error", details: result.errors });
        return;
      }
      res.json({ ok: true, blog: result.blog });
    } catch (err) {
      next(err);
    }
  });

  router.post("/mad/upload", madUpload.single("madFile"), (req, res, next) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "missing_file" });
        return;
      }
      const result = handleMadUpload(db, req.file.path, req.file.originalname);
      res.json({ ok: true, import: result });
    } catch (err) {
      next(err);
    }
  });

  router.post("/mad/current", (req, res, next) => {
    try {
      const id = Number.parseInt(req.body.id, 10);
      if (!Number.isFinite(id)) {
        res.status(400).json({ error: "invalid_id" });
        return;
      }
      const result = setCurrentImport(db, id);
      if (result.errors) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      res.json({ ok: true, import: result.import });
    } catch (err) {
      next(err);
    }
  });

  router.post("/settings", (req, res, next) => {
    try {
      const payload = req.body.settings || req.body;
      const settings = updateSettings(db, payload);
      res.json({ ok: true, settings });
    } catch (err) {
      next(err);
    }
  });

  router.post("/redirects", (req, res, next) => {
    try {
      const action = String(req.body.action || "").toLowerCase();
      const id = req.body.id ? Number.parseInt(req.body.id, 10) : null;
      if (action === "delete" && id) {
        deleteRedirect(db, id);
        res.json({ ok: true });
        return;
      }
      if (action === "update" && id) {
        const result = updateRedirect(db, id, req.body);
        if (result.errors) {
          res.status(400).json({ error: "validation_error", details: result.errors });
          return;
        }
        res.json({ ok: true, id });
        return;
      }
      const result = createRedirect(db, req.body);
      if (result.errors) {
        res.status(400).json({ error: "validation_error", details: result.errors });
        return;
      }
      res.json({ ok: true, id: result.id });
    } catch (err) {
      next(err);
    }
  });

  router.post("/gemonteerd/rename", (req, res, next) => {
    try {
      const from = req.body.from || req.body.oldName || "";
      const to = req.body.to || req.body.newName || "";
      if (!from || !to) {
        res.status(400).json({ error: "invalid_payload" });
        return;
      }
      const result = renameGemonteerdImage(from, to);
      res.json({ ok: true, renamed: { from: result.from, to: result.to }, items: result.items });
    } catch (err) {
      const code = err?.code || err?.message || "";
      if (["invalid_from", "invalid_to", "invalid_extension", "invalid_payload"].includes(code)) {
        res.status(400).json({ error: code });
        return;
      }
      if (code === "same_name") {
        res.status(409).json({ error: code });
        return;
      }
      if (code === "already_exists") {
        res.status(409).json({ error: code });
        return;
      }
      if (code === "not_found") {
        res.status(404).json({ error: code });
        return;
      }
      next(err);
    }
  });

  router.post("/rebuild", (req, res, next) => {
    try {
      const blogCount = buildBlogJson(db);
      const madCount = rebuildMadIndexFromCurrent();
      const redirectCount = writeRedirectsJson(db);
      res.json({ ok: true, blogCount, madCount, redirectCount });
    } catch (err) {
      next(err);
    }
  });

  router.use((err, req, res, next) => {
    if (err && err.message && err.message.startsWith("invalid_")) {
      res.status(400).json({ error: err.message });
      return;
    }
    if (err && err.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ error: "file_too_large" });
      return;
    }
    next(err);
  });

  return router;
};
