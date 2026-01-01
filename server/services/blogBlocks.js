const path = require("path");

const BLOCK_TYPES = new Set(["h1", "h2", "text", "image"]);

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

const escapeHtml = (input) =>
  String(input ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);

const stripTags = (html) =>
  decodeHtml(
    String(html || "")
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );

const sanitizeHtml = (html) =>
  String(html || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, "")
    .replace(/\son\w+=(".*?"|'.*?'|[^\s>]+)/gi, "");

const getAttr = (tag, name) => {
  if (!tag) return "";
  const re = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const match = String(tag).match(re);
  return decodeHtml(match ? match[1] || match[2] || match[3] || "" : "");
};

const sanitizeUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^javascript:/i.test(raw)) return "";
  return raw;
};

const resolveImageSrc = (src, slug) => {
  if (!src) return "";
  const trimmed = String(src).trim();
  if (/^(https?:)?\/\//i.test(trimmed) || trimmed.startsWith("/")) return trimmed;
  const cleaned = trimmed.replace(/^[.][\\/]/, "");
  return path.posix.join("/blog", slug || "", cleaned.replace(/\\/g, "/"));
};

const normalizeBlocks = (input) => {
  if (!Array.isArray(input)) {
    return { errors: ["blocks_invalid"], blocks: [] };
  }

  const errors = [];
  const blocks = input
    .map((block, index) => {
      if (!block || typeof block !== "object") {
        errors.push(`block_${index}_invalid`);
        return null;
      }

      const type = String(block.type || "").toLowerCase();
      if (!BLOCK_TYPES.has(type)) {
        errors.push(`block_${index}_type_invalid`);
        return null;
      }

      if (type === "h1" || type === "h2") {
        const text = String(block.text || "").trim();
        if (!text) {
          errors.push(`block_${index}_text_required`);
          return null;
        }
        return { type, text };
      }

      if (type === "text") {
        const text = String(block.text || "").trim();
        if (!text) {
          errors.push(`block_${index}_text_required`);
          return null;
        }
        const format = String(block.format || "").toLowerCase();
        return {
          type,
          text,
          format: format === "markdown" ? "markdown" : format === "html" ? "html" : "plain",
        };
      }

      if (type === "image") {
        const src = String(block.src || "").trim();
        if (!src) {
          errors.push(`block_${index}_src_required`);
          return null;
        }
        return {
          type,
          src,
          alt: String(block.alt || "").trim(),
          caption: String(block.caption || "").trim(),
          credit: String(block.credit || "").trim(),
          license: String(block.license || "").trim(),
        };
      }

      return null;
    })
    .filter(Boolean);

  return { errors, blocks };
};

const parseHtmlBlocks = (html, slug) => {
  if (!html) return [];
  const cleaned = sanitizeHtml(html);
  const blocks = [];
  const re =
    /<figure\b[^>]*>[\s\S]*?<\/figure>|<h1\b[^>]*>[\s\S]*?<\/h1>|<h2\b[^>]*>[\s\S]*?<\/h2>|<h3\b[^>]*>[\s\S]*?<\/h3>|<p\b[^>]*>[\s\S]*?<\/p>|<ul\b[^>]*>[\s\S]*?<\/ul>|<ol\b[^>]*>[\s\S]*?<\/ol>|<blockquote\b[^>]*>[\s\S]*?<\/blockquote>|<img\b[^>]*>/gi;
  let match;
  while ((match = re.exec(cleaned))) {
    const chunk = match[0];
    if (!chunk) continue;

    if (/^<figure/i.test(chunk)) {
      const imgTag = chunk.match(/<img\b[^>]*>/i);
      const src = resolveImageSrc(getAttr(imgTag, "src"), slug);
      if (!src) continue;
      const alt = getAttr(imgTag, "alt");
      const captionMatch = chunk.match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i);
      const caption = stripTags(captionMatch ? captionMatch[1] : "");
      blocks.push({ type: "image", src, alt, caption });
      continue;
    }

    if (/^<img/i.test(chunk)) {
      const src = resolveImageSrc(getAttr(chunk, "src"), slug);
      if (!src) continue;
      const alt = getAttr(chunk, "alt");
      blocks.push({ type: "image", src, alt, caption: "" });
      continue;
    }

    if (/^<h1/i.test(chunk)) {
      const text = stripTags(chunk);
      if (text) blocks.push({ type: "h1", text });
      continue;
    }

    if (/^<h2/i.test(chunk) || /^<h3/i.test(chunk)) {
      const text = stripTags(chunk);
      if (text) blocks.push({ type: "h2", text });
      continue;
    }

    if (/^<p/i.test(chunk) || /^<ul/i.test(chunk) || /^<ol/i.test(chunk) || /^<blockquote/i.test(chunk)) {
      const text = chunk.trim();
      if (text) blocks.push({ type: "text", text, format: "html" });
      continue;
    }
  }

  if (!blocks.length) {
    blocks.push({ type: "text", text: cleaned.trim(), format: "html" });
  }

  return blocks;
};

const parseMarkdownBlocks = (markdown) => {
  if (!markdown) return [];
  const blocks = [];
  const lines = String(markdown).split(/\r?\n/);
  let buffer = [];

  const flush = () => {
    const text = buffer.join("\n").trim();
    if (text) blocks.push({ type: "text", text, format: "markdown" });
    buffer = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flush();
      continue;
    }
    if (trimmed.startsWith("# ")) {
      flush();
      blocks.push({ type: "h1", text: trimmed.replace(/^#\s+/, "") });
      continue;
    }
    if (trimmed.startsWith("## ")) {
      flush();
      blocks.push({ type: "h2", text: trimmed.replace(/^##\s+/, "") });
      continue;
    }
    const imgMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
    if (imgMatch) {
      flush();
      blocks.push({ type: "image", src: imgMatch[2], alt: imgMatch[1] || "" });
      continue;
    }
    buffer.push(line);
  }

  flush();

  if (!blocks.length) {
    blocks.push({ type: "text", text: String(markdown).trim(), format: "markdown" });
  }

  return blocks;
};

const parseLegacyBlocks = (content, format, slug) => {
  if (!content) return [];
  const type = String(format || "").toLowerCase();
  if (type === "markdown" || type === "md") {
    return parseMarkdownBlocks(content);
  }
  return parseHtmlBlocks(content, slug);
};

const renderMarkdownInline = (text) => {
  let html = escapeHtml(text);
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) => {
    const safe = sanitizeUrl(url);
    if (!safe) return label;
    return `<a href="${escapeHtml(safe)}" rel="noopener noreferrer">${label}</a>`;
  });
  html = html.replace(/\n/g, "<br>");
  return html;
};

const renderMarkdown = (markdown) => {
  const parts = String(markdown || "")
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.map((part) => `<p>${renderMarkdownInline(part)}</p>`).join("");
};

const renderBlocksToHtml = (blocks, slug) => {
  if (!Array.isArray(blocks)) return "";
  return blocks
    .map((block) => {
      if (!block || typeof block !== "object") return "";
      const type = String(block.type || "").toLowerCase();
      if (type === "h1") {
        return `<h1>${escapeHtml(block.text || "")}</h1>`;
      }
      if (type === "h2") {
        return `<h2>${escapeHtml(block.text || "")}</h2>`;
      }
      if (type === "text") {
        const format = String(block.format || "").toLowerCase();
        if (format === "markdown") {
          return renderMarkdown(block.text || "");
        }
        if (format === "html") {
          const cleaned = sanitizeHtml(block.text || "");
          if (cleaned.trim().startsWith("<")) return cleaned;
          return `<p>${escapeHtml(cleaned)}</p>`;
        }
        return `<p>${escapeHtml(block.text || "")}</p>`;
      }
      if (type === "image") {
        const src = resolveImageSrc(block.src || "", slug);
        if (!src) return "";
        const alt = escapeHtml(block.alt || "");
        const caption = block.caption ? `<figcaption>${escapeHtml(block.caption)}</figcaption>` : "";
        return `<figure><img src="${escapeHtml(src)}" alt="${alt}" loading="lazy" decoding="async" />${caption}</figure>`;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
};

module.exports = {
  BLOCK_TYPES,
  decodeHtml,
  escapeHtml,
  stripTags,
  sanitizeHtml,
  resolveImageSrc,
  normalizeBlocks,
  parseLegacyBlocks,
  renderBlocksToHtml,
};
