const path = require("path");
const { storagePaths } = require("./storage");
const { normalizePath, toBoolean } = require("./validators");
const { writeJsonAtomic } = require("./fileUtils");

function listRedirects(db, options = {}) {
  const sql = options.enabledOnly
    ? "SELECT id, fromPath, toPath, code, enabled, updatedAt FROM redirects WHERE enabled = 1 ORDER BY id DESC"
    : "SELECT id, fromPath, toPath, code, enabled, updatedAt FROM redirects ORDER BY id DESC";
  return db.prepare(sql).all();
}

function createRedirect(db, payload) {
  const fromPath = normalizePath(payload.fromPath);
  const toPath = normalizePath(payload.toPath);
  const code = Number.parseInt(payload.code || "301", 10);
  const enabled = toBoolean(payload.enabled) ? 1 : 0;
  if (!fromPath || !toPath) {
    return { errors: ["invalid_paths"] };
  }
  const updatedAt = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO redirects (fromPath, toPath, code, enabled, updatedAt)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(fromPath, toPath, Number.isFinite(code) ? code : 301, enabled, updatedAt);
  return { id: result.lastInsertRowid };
}

function updateRedirect(db, id, payload) {
  const existing = db.prepare("SELECT id FROM redirects WHERE id = ?").get(id);
  if (!existing) return { errors: ["not_found"] };
  const fromPath = normalizePath(payload.fromPath);
  const toPath = normalizePath(payload.toPath);
  const code = Number.parseInt(payload.code || "301", 10);
  const enabled = toBoolean(payload.enabled) ? 1 : 0;
  if (!fromPath || !toPath) {
    return { errors: ["invalid_paths"] };
  }
  const updatedAt = new Date().toISOString();
  db.prepare(
    `UPDATE redirects SET fromPath = ?, toPath = ?, code = ?, enabled = ?, updatedAt = ? WHERE id = ?`
  ).run(fromPath, toPath, Number.isFinite(code) ? code : 301, enabled, updatedAt, id);
  return { id };
}

function deleteRedirect(db, id) {
  db.prepare("DELETE FROM redirects WHERE id = ?").run(id);
}

function writeRedirectsJson(db) {
  const redirects = listRedirects(db, { enabledOnly: true });
  writeJsonAtomic(path.join(storagePaths.generatedRoot, "redirects.json"), { items: redirects });
  return redirects.length;
}

module.exports = {
  listRedirects,
  createRedirect,
  updateRedirect,
  deleteRedirect,
  writeRedirectsJson,
};
