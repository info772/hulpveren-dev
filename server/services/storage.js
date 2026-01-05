const fs = require("fs");
const path = require("path");

const DEFAULT_STORAGE_ROOT =
  process.platform === "win32" ? path.join(__dirname, "..", "storage") : "/var/lib/lowland-api";
const DEFAULT_LOG_DIR =
  process.platform === "win32" ? path.join(__dirname, "..", "logs") : "/var/log/lowland-api";

const resolveEnvPath = (value, fallback) => {
  const raw = String(value || "").trim();
  const target = raw || fallback;
  return path.resolve(target);
};

const storageRoot = resolveEnvPath(process.env.STORAGE_ROOT, DEFAULT_STORAGE_ROOT);
const logsRoot = resolveEnvPath(process.env.LOG_DIR, DEFAULT_LOG_DIR);
const blogsRoot = path.join(storageRoot, "blogs");
const madRoot = path.join(storageRoot, "mad");
const madImportsRoot = path.join(madRoot, "imports");
const generatedRoot = path.join(storageRoot, "generated");

function ensureDir(dirPath, hint) {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
  } catch (err) {
    const message = `Failed to create ${hint} directory: ${dirPath}. Check permissions or set STORAGE_ROOT/LOG_DIR.`;
    const wrapped = new Error(message);
    wrapped.code = err.code;
    wrapped.cause = err;
    throw wrapped;
  }
}

function ensureStorage() {
  ensureDir(storageRoot, "storage root");
  ensureDir(logsRoot, "log");
  [blogsRoot, madRoot, madImportsRoot, generatedRoot].forEach((dirPath) => {
    ensureDir(dirPath, "storage");
  });
}

const storagePaths = {
  storageRoot,
  blogsRoot,
  madRoot,
  madImportsRoot,
  generatedRoot,
  logsRoot,
};

module.exports = {
  ensureStorage,
  storagePaths,
};
