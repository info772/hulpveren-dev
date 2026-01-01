const fs = require("fs");
const path = require("path");

const blogRoot = path.resolve(__dirname, "..", "..", "blog");
const outputPath = path.join(blogRoot, "blog-index.json");

const decodeHtml = (input) => {
  if (!input) return "";
  return String(input)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
};

const stripTags = (html) => {
  if (!html) return "";
  return decodeHtml(
    String(html)
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
};

const getAttr = (tag, name) => {
  if (!tag) return "";
  const re = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const match = String(tag).match(re);
  return decodeHtml(match ? (match[1] || match[2] || match[3] || "") : "");
};

const getBodyContent = (html) => {
  const bodyMatch = String(html).match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  let body = bodyMatch ? bodyMatch[1] : String(html);
  const headerIndex = body.search(/<\/header>/i);
  if (headerIndex !== -1) {
    body = body.slice(headerIndex + 9);
  }
  const footerIndex = body.search(/<footer\b/i);
  if (footerIndex !== -1) {
    body = body.slice(0, footerIndex);
  }
  return body;
};

const extractFirstTagInner = (html, tagName) => {
  const re = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = String(html).match(re);
  return match ? match[1] : "";
};

const parseMetaTags = (html) => {
  const tags = [];
  const matches = String(html).match(/<meta\b[^>]*>/gi) || [];
  for (const tag of matches) {
    const name = getAttr(tag, "name");
    const property = getAttr(tag, "property");
    const content = getAttr(tag, "content");
    if (content) {
      tags.push({ name: name.toLowerCase(), property: property.toLowerCase(), content });
    }
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
    const inner = extractFirstTagInner(scriptTag, "script");
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
    const iso = stat.mtime.toISOString().slice(0, 10);
    return iso;
  } catch (err) {
    return "";
  }
};

const resolveImageSrc = (src, slug) => {
  if (!src) return "";
  if (/^(https?:)?\/\//i.test(src) || src.startsWith("/")) return src;
  const cleaned = src.replace(/^[.][\\/]/, "");
  return path.posix.join("/blog", slug, cleaned.replace(/\\/g, "/"));
};

const extractFirstImage = (html, slug) => {
  const imgMatch = String(html).match(/<img\b[^>]*>/i);
  if (!imgMatch) return { src: "", alt: "" };
  const tag = imgMatch[0];
  const src = resolveImageSrc(getAttr(tag, "src"), slug);
  const alt = getAttr(tag, "alt");
  return { src, alt };
};

const extractFirstParagraph = (html) => {
  const pMatch = String(html).match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
  return stripTags(pMatch ? pMatch[1] : "");
};

const extractTitle = (html) => {
  const h1 = stripTags(extractFirstTagInner(html, "h1"));
  if (h1) return h1;
  const title = stripTags(extractFirstTagInner(html, "title"));
  return title;
};

const extractTags = (metaTags) => {
  const content = getMetaContent(metaTags, "blog:tags") || getMetaContent(metaTags, "keywords");
  if (!content) return [];
  return content
    .split(/[;,|]/)
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
};

const buildItem = (slug) => {
  const pagePath = path.join(blogRoot, slug, "index.html");
  if (!fs.existsSync(pagePath)) return null;
  const html = fs.readFileSync(pagePath, "utf8");
  const metaTags = parseMetaTags(html);
  const bodyContent = getBodyContent(html);
  const title = extractTitle(bodyContent || html);
  const description = extractFirstParagraph(bodyContent) || getMetaContent(metaTags, "description");
  const { src: image, alt: imageAlt } = extractFirstImage(bodyContent, slug);
  const date = extractDate(html, metaTags, pagePath);
  const tags = extractTags(metaTags);

  return {
    title: title || slug,
    description,
    date,
    url: `/blog/${slug}/`,
    image,
    imageAlt: imageAlt || title || "Blog afbeelding",
    tags,
  };
};

const slugs = fs
  .readdirSync(blogRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((name) => !name.startsWith("."));

const items = slugs
  .map(buildItem)
  .filter(Boolean)
  .sort((a, b) => {
    const da = new Date(a.date || 0).getTime();
    const db = new Date(b.date || 0).getTime();
    return (db || 0) - (da || 0);
  });

fs.writeFileSync(outputPath, JSON.stringify({ items }, null, 2) + "\n", "utf8");
console.log(`Blog index bijgewerkt (${items.length} items).`);
