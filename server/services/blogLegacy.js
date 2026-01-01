const fs = require("fs");
const path = require("path");
const { parseLegacyBlocks, resolveImageSrc, stripTags, decodeHtml } = require("./blogBlocks");

const DEFAULT_BLOG_DIR = path.resolve(__dirname, "..", "..", "wwwroot", "blog");

const resolveBlogContentDir = () =>
  path.resolve(process.env.BLOG_CONTENT_DIR || DEFAULT_BLOG_DIR);

const getAttr = (tag, name) => {
  if (!tag) return "";
  const re = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const match = String(tag).match(re);
  return decodeHtml(match ? match[1] || match[2] || match[3] || "" : "");
};

const parseMetaTags = (html) => {
  const tags = [];
  const matches = String(html).match(/<meta\b[^>]*>/gi) || [];
  for (const tag of matches) {
    const name = getAttr(tag, "name").toLowerCase();
    const property = getAttr(tag, "property").toLowerCase();
    const content = getAttr(tag, "content");
    if (content) tags.push({ name, property, content });
  }
  return tags;
};

const getMetaContent = (metaTags, key) => {
  const needle = String(key).toLowerCase();
  const byName = metaTags.find((tag) => tag.name === needle);
  if (byName) return byName.content;
  const byProp = metaTags.find((tag) => tag.property === needle);
  return byProp ? byProp.content : "";
};

const parseDutchDate = (text) => {
  const months = {
    januari: "01",
    februari: "02",
    maart: "03",
    april: "04",
    mei: "05",
    juni: "06",
    juli: "07",
    augustus: "08",
    september: "09",
    oktober: "10",
    november: "11",
    december: "12",
  };
  const match = String(text)
    .toLowerCase()
    .match(/(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+(\d{4})/);
  if (!match) return "";
  const day = match[1].padStart(2, "0");
  const month = months[match[2]];
  const year = match[3];
  return `${year}-${month}-${day}`;
};

const extractDate = (html, metaTags, filePath) => {
  const timeMatch = String(html).match(/<time\b[^>]*datetime=["']([^"']+)["'][^>]*>/i);
  if (timeMatch && timeMatch[1]) {
    return timeMatch[1].trim().split("T")[0];
  }

  const jsonLdMatches =
    String(html).match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];
  for (const scriptTag of jsonLdMatches) {
    const inner = scriptTag.replace(/<script\b[^>]*>|<\/script>/gi, "");
    if (!inner) continue;
    try {
      const parsed = JSON.parse(inner);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (item && item.datePublished) {
          return String(item.datePublished).split("T")[0];
        }
      }
    } catch (err) {
      continue;
    }
  }

  const metaDate = getMetaContent(metaTags, "blog:date");
  if (metaDate) return metaDate.split("T")[0];

  const metaTextMatch = String(html).match(/class=["'][^"']*blog-meta[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i);
  if (metaTextMatch) {
    const metaText = stripTags(metaTextMatch[1]);
    const parsed = parseDutchDate(metaText);
    if (parsed) return parsed;
  }

  try {
    const stat = fs.statSync(filePath);
    return stat.mtime.toISOString().slice(0, 10);
  } catch (err) {
    return "";
  }
};

const extractFirstParagraph = (html) => {
  const pMatch = String(html).match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
  return stripTags(pMatch ? pMatch[1] : "");
};

const extractTitle = (html) => {
  const h1Match = String(html).match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  const h1 = stripTags(h1Match ? h1Match[1] : "");
  if (h1) return h1;
  const titleMatch = String(html).match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return stripTags(titleMatch ? titleMatch[1] : "");
};

const extractFirstImage = (html, slug) => {
  const imgMatch = String(html).match(/<img\b[^>]*>/i);
  if (!imgMatch) return { src: "", alt: "" };
  const tag = imgMatch[0];
  const src = resolveImageSrc(getAttr(tag, "src"), slug);
  const alt = getAttr(tag, "alt");
  return { src, alt };
};

const extractTags = (metaTags) => {
  const content = getMetaContent(metaTags, "blog:tags") || getMetaContent(metaTags, "keywords");
  if (!content) return [];
  return content
    .split(/[;,|]/)
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
};

const extractBodyHtml = (html) => {
  const articleMatch = String(html).match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch) return articleMatch[1];
  const mainMatch = String(html).match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) return mainMatch[1];
  const bodyMatch = String(html).match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  let body = bodyMatch ? bodyMatch[1] : String(html);
  body = body.replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, "");
  body = body.replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, "");
  return body;
};

const resolveSlugFromUrl = (url) => {
  if (!url) return "";
  const cleaned = String(url).split("?")[0].split("#")[0].replace(/\/+$/, "");
  const parts = cleaned.split("/").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "";
};

const resolveLegacyFile = (dir, slug) => {
  const candidates = [
    path.join(dir, slug, "index.html"),
    path.join(dir, slug, "index.md"),
    path.join(dir, `${slug}.html`),
    path.join(dir, `${slug}.md`),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      const format = candidate.toLowerCase().endsWith(".md") ? "markdown" : "html";
      return { path: candidate, format };
    }
  }
  return null;
};

const readFrontmatter = (markdown) => {
  const text = String(markdown || "");
  if (!text.startsWith("---")) return { body: text, meta: {} };
  const end = text.indexOf("\n---", 3);
  if (end === -1) return { body: text, meta: {} };
  const front = text.slice(3, end).trim();
  const body = text.slice(end + 4).trim();
  const meta = {};
  front.split(/\r?\n/).forEach((line) => {
    const idx = line.indexOf(":");
    if (idx === -1) return;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (!key) return;
    meta[key] = value;
  });
  return { body, meta };
};

const parseIndexItem = (item) => {
  const slug = item.slug || resolveSlugFromUrl(item.url || item.href || "");
  if (!slug) return null;
  return {
    slug,
    title: item.title || "",
    excerpt: item.description || item.excerpt || "",
    heroImagePath: item.image || item.img || item.cover || "",
    publishedAt: item.date || item.publishedAt || "",
    tags: Array.isArray(item.tags) ? item.tags : [],
  };
};

const listLegacyIndex = () => {
  const dir = resolveBlogContentDir();
  const indexPath = path.join(dir, "blog-index.json");
  const sourceType = fs.existsSync(indexPath) ? "json" : "fs";
  let items = [];

  if (sourceType === "json") {
    try {
      const raw = fs.readFileSync(indexPath, "utf8");
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed.items) ? parsed.items : [];
      items = list.map(parseIndexItem).filter(Boolean);
    } catch (err) {
      items = [];
    }
  } else if (fs.existsSync(dir)) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const slugs = new Set();
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const slug = entry.name;
        const file = resolveLegacyFile(dir, slug);
        if (file) slugs.add(slug);
        continue;
      }
      if (entry.isFile()) {
        if (entry.name === "blog-index.json") continue;
        if (entry.name.endsWith(".html") || entry.name.endsWith(".md")) {
          slugs.add(entry.name.replace(/\.(html|md)$/i, ""));
        }
      }
    }
    items = Array.from(slugs).map((slug) => ({ slug }));
  }

  const enriched = items.map((item) => {
    if (!item.slug) return null;
    if (item.title && item.excerpt && item.publishedAt && item.heroImagePath) return item;
    const legacy = loadLegacyPost(item.slug);
    if (!legacy) return item;
    return {
      ...item,
      title: item.title || legacy.title,
      excerpt: item.excerpt || legacy.excerpt,
      heroImagePath: item.heroImagePath || legacy.heroImagePath,
      publishedAt: item.publishedAt || legacy.publishedAt,
      updatedAt: legacy.updatedAt,
      tags: item.tags && item.tags.length ? item.tags : legacy.tags || [],
    };
  }).filter(Boolean);

  return { dir, sourceType, items: enriched };
};

const loadLegacyPost = (slug) => {
  const dir = resolveBlogContentDir();
  const file = resolveLegacyFile(dir, slug);
  if (!file) return null;
  const raw = fs.readFileSync(file.path, "utf8");
  const metaTags = file.format === "html" ? parseMetaTags(raw) : [];
  const frontmatter = file.format === "markdown" ? readFrontmatter(raw) : { body: raw, meta: {} };
  const htmlBody = file.format === "html" ? extractBodyHtml(raw) : "";
  const legacyContent = file.format === "html" ? htmlBody : frontmatter.body;
  const blocks = parseLegacyBlocks(legacyContent, file.format, slug);

  const title =
    frontmatter.meta.title ||
    (file.format === "html" ? extractTitle(htmlBody || raw) : "");
  const excerpt =
    frontmatter.meta.excerpt ||
    (file.format === "html" ? extractFirstParagraph(htmlBody) : "");
  const publishedAt =
    frontmatter.meta.date ||
    (file.format === "html" ? extractDate(raw, metaTags, file.path) : "");
  const updatedAt = (() => {
    try {
      return fs.statSync(file.path).mtime.toISOString();
    } catch (err) {
      return new Date().toISOString();
    }
  })();

  const tags = frontmatter.meta.tags
    ? String(frontmatter.meta.tags)
        .split(/[;,|]/)
        .map((tag) => tag.trim())
        .filter(Boolean)
    : file.format === "html"
      ? extractTags(metaTags)
      : [];

  const metaImage =
    frontmatter.meta.heroImage ||
    frontmatter.meta.image ||
    getMetaContent(metaTags, "og:image") ||
    getMetaContent(metaTags, "twitter:image");
  const { src: firstImage } = extractFirstImage(htmlBody || raw, slug);
  const heroImagePath = metaImage || firstImage || "";

  return {
    source: "legacy",
    slug,
    title: title || slug,
    excerpt,
    heroImagePath,
    publishedAt,
    updatedAt,
    isPublished: true,
    tags,
    legacyFormat: file.format,
    legacyContent,
    blocks,
  };
};

const getLegacyDebugInfo = () => {
  const info = listLegacyIndex();
  return {
    sourceType: info.sourceType,
    path: info.dir,
    count: info.items.length,
    slugs: info.items.map((item) => item.slug).slice(0, 5),
  };
};

module.exports = {
  resolveBlogContentDir,
  listLegacyIndex,
  loadLegacyPost,
  getLegacyDebugInfo,
};
