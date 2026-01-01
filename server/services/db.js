const path = require("path");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const { ensureDefaultSettings } = require("./settingsService");

const dbPath = path.join(__dirname, "..", "db.sqlite");

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS blogs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      excerpt TEXT,
      content TEXT,
      category TEXT,
      author TEXT,
      date TEXT,
      readTime TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      heroImagePath TEXT,
      updatedAt TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS mad_imports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      storedPath TEXT NOT NULL,
      recordCount INTEGER NOT NULL,
      createdAt TEXT NOT NULL,
      isCurrent INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS redirects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fromPath TEXT NOT NULL,
      toPath TEXT NOT NULL,
      code INTEGER NOT NULL DEFAULT 301,
      enabled INTEGER NOT NULL DEFAULT 1,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL
    );
  `);

  const userColumns = db.prepare("PRAGMA table_info(users)").all();
  const hasCreatedAt = userColumns.some((col) => col.name === "createdAt");
  if (!hasCreatedAt) {
    db.exec("ALTER TABLE users ADD COLUMN createdAt TEXT");
  }

  const blogColumns = db.prepare("PRAGMA table_info(blogs)").all();
  const hasBlocksJson = blogColumns.some((col) => col.name === "blocksJson");
  if (!hasBlocksJson) {
    db.exec("ALTER TABLE blogs ADD COLUMN blocksJson TEXT");
  }
  const hasRenderedHtml = blogColumns.some((col) => col.name === "renderedHtml");
  if (!hasRenderedHtml) {
    db.exec("ALTER TABLE blogs ADD COLUMN renderedHtml TEXT");
  }
}

function seedAdminUser(db) {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) {
    console.warn("ADMIN_USERNAME/ADMIN_PASSWORD not set; admin login disabled.");
    return;
  }

  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (existing) {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, existing.id);
    return;
  }

  const hash = bcrypt.hashSync(password, 10);
  db.prepare("INSERT INTO users (username, password_hash, createdAt) VALUES (?, ?, ?)").run(
    username,
    hash,
    new Date().toISOString()
  );
}

function initDb() {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  migrate(db);
  seedAdminUser(db);
  ensureDefaultSettings(db);
  return db;
}

module.exports = {
  initDb,
};
