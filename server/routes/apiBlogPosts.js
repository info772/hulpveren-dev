const express = require("express");
const crypto = require("crypto");
const { getBlogBySlugV2 } = require("../services/blogRepository");

module.exports = (db) => {
  const router = express.Router();

  router.get("/posts/:slug", (req, res, next) => {
    try {
      const slug = String(req.params.slug || "").trim();
      if (!slug) {
        res.status(400).json({ error: "invalid_slug" });
        return;
      }
      const blog = getBlogBySlugV2(db, slug, true);
      if (!blog) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      const contentHtml = blog.renderedHtml || blog.content || blog.legacyContent || "";
      const payload = {
        slug: blog.slug,
        title: blog.title,
        date: blog.publishedAt || blog.date || "",
        excerpt: blog.excerpt || "",
        hero: blog.heroImagePath || "",
        contentHtml,
      };
      const etag = crypto.createHash("sha1").update(JSON.stringify(payload)).digest("hex");
      if (req.headers["if-none-match"] === etag) {
        res.status(304).end();
        return;
      }
      res.set("ETag", etag);
      res.set("Cache-Control", "no-cache");
      res.json(payload);
    } catch (err) {
      next(err);
    }
  });

  return router;
};
