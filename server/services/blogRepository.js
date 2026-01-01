const { sanitizeSlug } = require("./validators");
const { listPublishedBlogs, listBlogs, getBlogBySlug } = require("./blogService");
const { listLegacyIndex, loadLegacyPost, getLegacyDebugInfo } = require("./blogLegacy");
const { normalizeBlocks, parseLegacyBlocks, renderBlocksToHtml, stripTags } = require("./blogBlocks");

const safeParseJson = (value) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const detectLegacyFormat = (content) => {
  if (!content) return "plain";
  return /<[^>]+>/.test(content) ? "html" : "markdown";
};

const deriveExcerpt = (html) => {
  const text = stripTags(html);
  if (!text) return "";
  if (text.length <= 180) return text;
  return `${text.slice(0, 177).trim()}...`;
};

const getFirstImageFromBlocks = (blocks) => {
  if (!Array.isArray(blocks)) return "";
  const img = blocks.find((block) => block && block.type === "image" && block.src);
  return img ? img.src : "";
};

const normalizeDbBlog = (row) => {
  const blocks = safeParseJson(row.blocksJson || row.blocks_json) || null;
  const renderedHtml = row.renderedHtml || row.rendered_html || "";
  return {
    id: row.id,
    slug: row.slug,
    title: row.title || "",
    excerpt: row.excerpt || "",
    heroImagePath: row.heroImagePath || "",
    category: row.category || "",
    author: row.author || "",
    readTime: row.readTime || "",
    publishedAt: row.date || "",
    updatedAt: row.updatedAt || row.createdAt || "",
    isPublished: row.status === "published",
    blocks,
    legacyContent: row.content || "",
    renderedHtml,
    source: "db",
  };
};

const withDerivedContent = (blog) => {
  const next = { ...blog };
  if (next.legacyContent && !next.legacyFormat) {
    next.legacyFormat = detectLegacyFormat(next.legacyContent);
  }
  if (!next.blocks || !Array.isArray(next.blocks) || next.blocks.length === 0) {
    if (next.legacyContent) {
      next.blocks = parseLegacyBlocks(next.legacyContent, next.legacyFormat, next.slug);
    }
  }
  if (!next.renderedHtml && next.blocks && next.blocks.length) {
    next.renderedHtml = renderBlocksToHtml(next.blocks, next.slug);
  }
  if (!next.excerpt && next.renderedHtml) {
    next.excerpt = deriveExcerpt(next.renderedHtml);
  }
  if (!next.heroImagePath && next.blocks) {
    next.heroImagePath = getFirstImageFromBlocks(next.blocks);
  }
  return next;
};

const mergeLegacyWithDb = (dbRows, legacyItems) => {
  const items = [];
  const seen = new Set();
  for (const row of dbRows) {
    const blog = withDerivedContent(normalizeDbBlog(row));
    seen.add(blog.slug);
    items.push(blog);
  }

  for (const legacy of legacyItems) {
    if (!legacy.slug || seen.has(legacy.slug)) continue;
    items.push({
      source: "legacy",
      slug: legacy.slug,
      title: legacy.title || legacy.slug,
      excerpt: legacy.excerpt || "",
      heroImagePath: legacy.heroImagePath || "",
      publishedAt: legacy.publishedAt || "",
      updatedAt: legacy.updatedAt || legacy.publishedAt || "",
      isPublished: true,
      tags: legacy.tags || [],
    });
  }

  items.sort((a, b) => {
    const da = new Date(a.publishedAt || 0).getTime() || 0;
    const db = new Date(b.publishedAt || 0).getTime() || 0;
    return db - da;
  });
  return items;
};

const listPublishedBlogsV2 = (db) => {
  const dbRows = listPublishedBlogs(db);
  const legacyIndex = listLegacyIndex();
  return mergeLegacyWithDb(dbRows, legacyIndex.items);
};

const listAdminBlogsV2 = (db, options = {}) => {
  const dbRows = listBlogs(db, options);
  const legacyIndex = listLegacyIndex();
  return mergeLegacyWithDb(dbRows, legacyIndex.items);
};

const getBlogBySlugV2 = (db, slug, publishedOnly) => {
  const cleaned = sanitizeSlug(slug);
  if (!cleaned) return null;
  const dbBlog = getBlogBySlug(db, cleaned, Boolean(publishedOnly));
  if (dbBlog) {
    return withDerivedContent(normalizeDbBlog(dbBlog));
  }
  const legacy = loadLegacyPost(cleaned);
  if (!legacy) return null;
  return withDerivedContent(legacy);
};

const saveBlogV2 = (db, inputSlug, payload = {}) => {
  const slug = sanitizeSlug(inputSlug || payload.slug || payload.title);
  if (!slug) {
    return { errors: ["slug_required"] };
  }

  const now = new Date().toISOString();
  const isPublished =
    payload.isPublished !== undefined ? Boolean(payload.isPublished) : payload.status === "published";
  const status = isPublished ? "published" : "draft";

  let blocksInput = payload.blocks || payload.blockItems || [];
  if (typeof blocksInput === "string") {
    blocksInput = safeParseJson(blocksInput) || [];
  }
  const normalized = normalizeBlocks(blocksInput);
  if (normalized.errors.length) {
    return { errors: normalized.errors };
  }

  let blocks = normalized.blocks;
  const legacyContent = payload.legacyContent || payload.content || "";
  const legacyFormat = payload.legacyFormat || payload.contentFormat || detectLegacyFormat(legacyContent);
  if (!blocks.length && legacyContent) {
    blocks = parseLegacyBlocks(legacyContent, legacyFormat, slug);
  }

  const renderedHtml = renderBlocksToHtml(blocks, slug);
  const excerpt = payload.excerpt || deriveExcerpt(renderedHtml);
  const heroImagePath = payload.heroImagePath || payload.heroImage || getFirstImageFromBlocks(blocks) || "";

  const data = {
    slug,
    title: payload.title || slug,
    excerpt,
    content: legacyContent || renderedHtml,
    category: payload.category || "",
    author: payload.author || "",
    date: payload.publishedAt || payload.date || now.slice(0, 10),
    readTime: payload.readTime || "",
    status,
    heroImagePath,
    blocksJson: JSON.stringify(blocks || []),
    renderedHtml,
    updatedAt: now,
    createdAt: now,
  };

  const existing = db.prepare("SELECT id, createdAt FROM blogs WHERE slug = ?").get(slug);
  if (existing) {
    db.prepare(
      `UPDATE blogs SET title = @title, excerpt = @excerpt, content = @content, category = @category,
       author = @author, date = @date, readTime = @readTime, status = @status, heroImagePath = @heroImagePath,
       blocksJson = @blocksJson, renderedHtml = @renderedHtml, updatedAt = @updatedAt WHERE slug = @slug`
    ).run({ ...data, createdAt: existing.createdAt });
    const updated = db.prepare("SELECT * FROM blogs WHERE slug = ?").get(slug);
    return { blog: withDerivedContent(normalizeDbBlog(updated)) };
  }

  db.prepare(
    `INSERT INTO blogs (slug, title, excerpt, content, category, author, date, readTime, status, heroImagePath,
      blocksJson, renderedHtml, updatedAt, createdAt)
     VALUES (@slug, @title, @excerpt, @content, @category, @author, @date, @readTime, @status, @heroImagePath,
      @blocksJson, @renderedHtml, @updatedAt, @createdAt)`
  ).run(data);

  const created = db.prepare("SELECT * FROM blogs WHERE slug = ?").get(slug);
  return { blog: withDerivedContent(normalizeDbBlog(created)) };
};

module.exports = {
  listPublishedBlogsV2,
  listAdminBlogsV2,
  getBlogBySlugV2,
  saveBlogV2,
  getLegacyDebugInfo,
};
