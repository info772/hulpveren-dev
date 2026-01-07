const fs = require("fs");
const path = require("path");

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "out",
  ".cache",
  "tools/data-quality/out",
]);

const DEFAULT_ROOTS = [
  "wwwroot/data",
  "wwwroot/assets/data",
  "wwwroot/assets/json",
  "data",
  "public/data",
  "assets/data",
  "assets/json",
  "public/json",
];

function shouldSkipDir(dir) {
  return IGNORED_DIRS.has(dir.replace(/\\/g, "/"));
}

function walk(dir, files) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    const rel = full.replace(/\\/g, "/");
    if (shouldSkipDir(rel)) continue;
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) {
      files.push(rel);
    }
  }
}

function guessType(file) {
  const lower = file.toLowerCase();
  if (lower.includes("set") || lower.includes("kit") || lower.includes("sku")) {
    return "setRecords";
  }
  return "pageRecords";
}

function discoverSources(repoRoot) {
  const sources = [];
  const roots = DEFAULT_ROOTS.map((p) => path.join(repoRoot, p));
  const seen = new Set();

  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const files = [];
    walk(root, files);
    files.forEach((f) => {
      if (seen.has(f)) return;
      seen.add(f);
      const p = String(f).toLowerCase();
      if (p.includes("/fitments/")) return;
      if (p.endsWith("build-info.json")) return;
      sources.push({
        path: f.replace(/\\/g, "/"),
        type: guessType(f),
      });
    });
  }

  // Fallback: broad scan for JSON under wwwroot if none found
  if (!sources.length && fs.existsSync(path.join(repoRoot, "wwwroot"))) {
    const files = [];
    walk(path.join(repoRoot, "wwwroot"), files);
    files.forEach((f) => {
      if (seen.has(f)) return;
      seen.add(f);
      sources.push({ path: f.replace(/\\/g, "/"), type: guessType(f) });
    });
  }

  return sources;
}

module.exports = { discoverSources };
