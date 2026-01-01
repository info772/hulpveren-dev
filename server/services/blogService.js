const fs = require("fs");
const path = require("path");
const { storagePaths } = require("./storage");
const { writeJsonAtomic } = require("./fileUtils");
const { sanitizeSlug, normalizeStatus } = require("./validators");

const PUBLISHED_FIELDS = ["title", "slug", "excerpt", "content", "date"];

function validatePayload(payload, requirePublish) {
  const errors = [];
  if (!payload.title) errors.push("title_required");
  if (!payload.slug) errors.push("slug_required");
  if (requirePublish) {
    for (const key of PUBLISHED_FIELDS) {
      if (!payload[key]) errors.push(`${key}_required`);
    }
  }
  return errors;
}

function listBlogs(db, options = {}) {
  const clauses = [];
  const params = {};
  if (options.status) {
    clauses.push("status = @status");
    params.status = options.status;
  }
  if (options.search) {
    clauses.push("(title LIKE @q OR slug LIKE @q)");
    params.q = `%${options.search}%`;
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return db
    .prepare(
      `SELECT id, slug, title, excerpt, category, author, date, readTime, status, heroImagePath, updatedAt, createdAt
       FROM blogs ${where} ORDER BY date DESC, updatedAt DESC`
    )
    .all(params);
}

function listPublishedBlogs(db, includeContent = false) {
  const columns = includeContent
    ? "id, slug, title, excerpt, content, category, author, date, readTime, status, heroImagePath, updatedAt, createdAt"
    : "id, slug, title, excerpt, category, author, date, readTime, status, heroImagePath, updatedAt, createdAt";
  return db.prepare(`SELECT ${columns} FROM blogs WHERE status = 'published' ORDER BY date DESC, updatedAt DESC`).all();
}

function getBlogById(db, id) {
  return db
    .prepare(
      `SELECT id, slug, title, excerpt, content, category, author, date, readTime, status, heroImagePath, blocksJson,
        renderedHtml, updatedAt, createdAt
       FROM blogs WHERE id = ?`
    )
    .get(id);
}

function getBlogBySlug(db, slug, publishedOnly = false) {
  const cleaned = sanitizeSlug(slug);
  const sql = publishedOnly
    ? `SELECT id, slug, title, excerpt, content, category, author, date, readTime, status, heroImagePath, blocksJson,
       renderedHtml, updatedAt, createdAt
       FROM blogs WHERE slug = ? AND status = 'published'`
    : `SELECT id, slug, title, excerpt, content, category, author, date, readTime, status, heroImagePath, blocksJson,
       renderedHtml, updatedAt, createdAt
       FROM blogs WHERE slug = ?`;
  return db.prepare(sql).get(cleaned);
}

function createBlog(db, payload) {
  const now = new Date().toISOString();
  const slug = sanitizeSlug(payload.slug || payload.title);
  const status = normalizeStatus(payload.status);
  const blog = {
    slug,
    title: payload.title?.trim() || "",
    excerpt: payload.excerpt?.trim() || "",
    content: payload.content || "",
    category: payload.category?.trim() || "",
    author: payload.author?.trim() || "",
    date: payload.date?.trim() || "",
    readTime: payload.readTime?.trim() || "",
    status,
    heroImagePath: payload.heroImagePath || "",
    updatedAt: now,
    createdAt: now,
  };

  const errors = validatePayload(blog, status === "published");
  if (slug) {
    const existing = db.prepare("SELECT id FROM blogs WHERE slug = ?").get(slug);
    if (existing) errors.push("slug_taken");
  }

  if (errors.length) {
    return { errors };
  }

  const result = db
    .prepare(
      `INSERT INTO blogs (slug, title, excerpt, content, category, author, date, readTime, status, heroImagePath, updatedAt, createdAt)
       VALUES (@slug, @title, @excerpt, @content, @category, @author, @date, @readTime, @status, @heroImagePath, @updatedAt, @createdAt)`
    )
    .run(blog);
  return { blog: { ...blog, id: result.lastInsertRowid } };
}

function updateBlog(db, id, payload) {
  const existing = getBlogById(db, id);
  if (!existing) {
    return { errors: ["not_found"] };
  }

  const slug = sanitizeSlug(payload.slug || existing.slug || payload.title);
  const status = normalizeStatus(payload.status || existing.status);
  const updated = {
    slug,
    title: (payload.title ?? existing.title || "").trim(),
    excerpt: (payload.excerpt ?? existing.excerpt || "").trim(),
    content: payload.content ?? existing.content || "",
    category: (payload.category ?? existing.category || "").trim(),
    author: (payload.author ?? existing.author || "").trim(),
    date: (payload.date ?? existing.date || "").trim(),
    readTime: (payload.readTime ?? existing.readTime || "").trim(),
    status,
    heroImagePath: payload.heroImagePath || existing.heroImagePath || "",
    updatedAt: new Date().toISOString(),
  };

  const errors = validatePayload(updated, status === "published");
  if (slug) {
    const taken = db.prepare("SELECT id FROM blogs WHERE slug = ?").get(slug);
    if (taken && taken.id !== existing.id) errors.push("slug_taken");
  }

  if (errors.length) {
    return { errors };
  }

  db.prepare(
    `UPDATE blogs SET slug = @slug, title = @title, excerpt = @excerpt, content = @content, category = @category,
      author = @author, date = @date, readTime = @readTime, status = @status, heroImagePath = @heroImagePath,
      updatedAt = @updatedAt WHERE id = @id`
  ).run({ ...updated, id });

  if (existing.slug && existing.slug !== slug) {
    moveBlogFolder(existing.slug, slug);
  }

  return { blog: { ...existing, ...updated, id } };
}

function deleteBlog(db, id) {
  const existing = getBlogById(db, id);
  if (!existing) return false;
  db.prepare("DELETE FROM blogs WHERE id = ?").run(id);
  return true;
}

function moveBlogFolder(oldSlug, newSlug) {
  if (!oldSlug || !newSlug || oldSlug === newSlug) return;
  const fromDir = path.join(storagePaths.blogsRoot, oldSlug);
  const toDir = path.join(storagePaths.blogsRoot, newSlug);
  if (!fs.existsSync(fromDir) || fs.existsSync(toDir)) return;
  fs.renameSync(fromDir, toDir);
}

function buildBlogJson(db) {
  const rows = listPublishedBlogs(db, true);
  const items = rows.map((row) => ({
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    category: row.category,
    author: row.author,
    date: row.date,
    readTime: row.readTime,
    heroImage: row.heroImagePath,
    updatedAt: row.updatedAt,
  }));

  const indexPayload = { items };
  writeJsonAtomic(path.join(storagePaths.generatedRoot, "blog-index.json"), indexPayload);

  for (const row of rows) {
    const payload = {
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt,
      content: row.content,
      category: row.category,
      author: row.author,
      date: row.date,
      readTime: row.readTime,
      heroImage: row.heroImagePath,
      updatedAt: row.updatedAt,
    };
    writeJsonAtomic(path.join(storagePaths.generatedRoot, `blog-${row.slug}.json`), payload);
  }

  return items.length;
}

module.exports = {
  listBlogs,
  listPublishedBlogs,
  getBlogById,
  getBlogBySlug,
  createBlog,
  updateBlog,
  deleteBlog,
  buildBlogJson,
};
