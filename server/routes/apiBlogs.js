const express = require("express");
const crypto = require("crypto");
const { listPublishedBlogsV2, getBlogBySlugV2 } = require("../services/blogRepository");

module.exports = (db) => {
  const router = express.Router();

  router.get("/", (req, res, next) => {
    try {
      const page = Math.max(1, Number.parseInt(req.query.page || "1", 10));
      const pageSize = Math.min(
        50,
        Math.max(1, Number.parseInt(req.query.pageSize || "12", 10))
      );
      const q = String(req.query.q || "").trim().toLowerCase();
      const tag = String(req.query.tag || "").trim().toLowerCase();

      let rows = listPublishedBlogsV2(db);
      if (q) {
        rows = rows.filter((row) => {
          const hay = `${row.title || ""} ${row.excerpt || ""} ${row.category || ""} ${Array.isArray(row.tags) ? row.tags.join(" ") : ""}`
            .toLowerCase()
            .trim();
          return hay.includes(q);
        });
      }
      if (tag) {
        rows = rows.filter((row) => {
          const category = String(row.category || "").toLowerCase();
          if (category.includes(tag)) return true;
          if (Array.isArray(row.tags)) {
            return row.tags.some((t) => String(t || "").toLowerCase().includes(tag));
          }
          return false;
        });
      }
      const total = rows.length;
      const start = (page - 1) * pageSize;
      const pageRows = rows.slice(start, start + pageSize);
      const items = pageRows.map((row) => ({
        slug: row.slug,
        title: row.title,
        excerpt: row.excerpt,
        category: row.category,
        tags: row.tags || [],
        author: row.author,
        date: row.publishedAt || row.date,
        readTime: row.readTime,
        heroImage: row.heroImagePath,
        updatedAt: row.updatedAt,
      }));
      const payload = { items, total };
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

  router.get("/:slug", (req, res, next) => {
    try {
      const blog = getBlogBySlugV2(db, req.params.slug, true);
      if (!blog) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      const renderedHtml = blog.renderedHtml || blog.content || blog.legacyContent || "";
      const item = {
        slug: blog.slug,
        title: blog.title,
        excerpt: blog.excerpt,
        content: renderedHtml,
        renderedHtml,
        blocks: blog.blocks || [],
        category: blog.category,
        author: blog.author,
        date: blog.publishedAt || blog.date,
        readTime: blog.readTime,
        heroImage: blog.heroImagePath,
        updatedAt: blog.updatedAt,
      };
      const payload = { item };
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
