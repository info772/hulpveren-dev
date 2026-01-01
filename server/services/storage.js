const fs = require("fs");
const path = require("path");

const storageRoot = path.join(__dirname, "..", "storage");
const blogsRoot = path.join(storageRoot, "blogs");
const madRoot = path.join(storageRoot, "mad");
const madImportsRoot = path.join(madRoot, "imports");
const generatedRoot = path.join(storageRoot, "generated");
const logsRoot = path.join(__dirname, "..", "logs");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function ensureStorage() {
  [storageRoot, blogsRoot, madRoot, madImportsRoot, generatedRoot, logsRoot].forEach(ensureDir);
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
