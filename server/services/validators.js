function sanitizeSlug(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeStatus(value) {
  const status = String(value || "").toLowerCase();
  if (["draft", "published", "archived"].includes(status)) return status;
  return "draft";
}

function toBoolean(value) {
  return value === true || value === "true" || value === "1" || value === "on" || value === 1;
}

function normalizePath(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^https?:\/\//i.test(text)) return "";
  if (!text.startsWith("/")) return "";
  if (text.startsWith("//")) return "";
  return text;
}

module.exports = {
  sanitizeSlug,
  normalizeStatus,
  toBoolean,
  normalizePath,
};
