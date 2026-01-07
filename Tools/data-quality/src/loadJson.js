const fs = require("fs");
const path = require("path");

function resolvePath(repoRoot, p) {
  if (!p) return p;

  // Ensure p is string
  if (typeof p !== "string") {
    throw new TypeError(`resolvePath expected string path, got: ${Object.prototype.toString.call(p)}`);
  }

  // If already absolute, do NOT prefix repoRoot again
  if (path.isAbsolute(p)) return path.normalize(p);

  // Otherwise resolve relative to repo root
  return path.normalize(path.join(repoRoot, p));
}

function loadJsonFile(repoRoot, sourcePath) {
  const absPath = resolvePath(repoRoot, sourcePath);
  let raw = fs.readFileSync(absPath, "utf8");
  // strip UTF-8 BOM if present
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  return JSON.parse(raw);
}

function getSourcePath(item) {
  if (typeof item === "string") return item;
  if (!item || typeof item !== "object") return null;

  // Common keys we might have in discovery output
  return (
    item.source ||
    item.path ||
    item.file ||
    item.filePath ||
    item.absPath ||
    item.sourceFile ||
    null
  );
}

/**
 * Loads all JSON sources and returns:
 * - loaded: array of { source, absPath, json, meta? }
 * - findings: array of findings (LOAD_FAILED etc.)
 */
function loadAll(repoRoot, sources) {
  const loaded = [];
  const findings = [];

  for (const item of sources || []) {
    const sourcePath = getSourcePath(item);

    if (!sourcePath) {
      findings.push({
        severity: "ERROR",
        code: "LOAD_FAILED",
        message: `Invalid source entry (expected string or object with .source/.path/.file). Got: ${JSON.stringify(item).slice(0, 300)}`,
        sourceFile: "",
        recordId: null,
        setCode: null,
        path: ""
      });
      continue;
    }

    let absPath = "";
    try {
      absPath = resolvePath(repoRoot, sourcePath);
      const json = loadJsonFile(repoRoot, sourcePath);
      loaded.push({
        source: sourcePath,
        absPath,
        json,
        meta: typeof item === "object" ? item : null
      });
    } catch (e) {
      findings.push({
        severity: "ERROR",
        code: "LOAD_FAILED",
        message: e && e.message ? e.message : String(e),
        sourceFile: absPath || sourcePath,
        recordId: null,
        setCode: null,
        path: ""
      });
    }
  }

  return { loaded, findings };
}

module.exports = { loadAll, loadJsonFile, resolvePath };
