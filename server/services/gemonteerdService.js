const fs = require("fs");
const path = require("path");
const { writeJsonAtomic } = require("./fileUtils");

const DEFAULT_GEMONTEERD_DIR = "/var/www/dev.hulpveren.shop/public/assets/img/Gemonteerd";
const FALLBACK_GEMONTEERD_DIR = path.resolve(__dirname, "..", "..", "wwwroot", "assets", "img", "Gemonteerd");
const ADMIN_ASSET_PREFIX = "/admin-assets/gemonteerd";
const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const FILE_NAME_PATTERN = /^[a-zA-Z0-9 _+.-]+$/;

const resolveGemonteerdDir = () => {
  const envDir = String(process.env.GEMONTEERD_DIR || "").trim();
  if (envDir) return envDir;
  if (fs.existsSync(DEFAULT_GEMONTEERD_DIR)) return DEFAULT_GEMONTEERD_DIR;
  return FALLBACK_GEMONTEERD_DIR;
};

const getGemonteerdDir = () => resolveGemonteerdDir();

const getManifestPath = () => path.join(getGemonteerdDir(), "manifest.json");

const normalizeName = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (!FILE_NAME_PATTERN.test(trimmed)) return "";
  if (trimmed.includes("..")) return "";
  if (trimmed.includes("/") || trimmed.includes("\\") || trimmed.includes("\0")) return "";
  const base = path.basename(trimmed);
  if (!base || base === "." || base === "..") return "";
  if (base !== trimmed) return "";
  return base;
};

const withExtension = (name, fallbackExt) => {
  if (path.extname(name)) return name;
  return fallbackExt ? `${name}${fallbackExt}` : name;
};

const isAllowedExtension = (name) => ALLOWED_EXTENSIONS.has(path.extname(name).toLowerCase());

const isAllowedFileName = (name) => {
  const cleaned = normalizeName(name);
  if (!cleaned) return false;
  return isAllowedExtension(cleaned);
};

const listGemonteerdFileNames = () => {
  const dir = getGemonteerdDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => isAllowedFileName(name))
    .sort((a, b) => a.localeCompare(b, "nl", { sensitivity: "base" }));
};

const toAssetUrl = (name) => `${ADMIN_ASSET_PREFIX}/${encodeURIComponent(name)}`;

const listGemonteerdImages = () =>
  listGemonteerdFileNames().map((name) => ({
    name,
    url: toAssetUrl(name),
  }));

const readManifestPayload = () => {
  const manifestPath = getManifestPath();
  if (!fs.existsSync(manifestPath)) return null;
  try {
    const raw = fs.readFileSync(manifestPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((name) => isAllowedFileName(name));
  } catch (err) {
    return null;
  }
};

const writeGemonteerdManifest = (names) => {
  const payload = Array.isArray(names) ? names.filter((name) => isAllowedFileName(name)) : listGemonteerdFileNames();
  writeJsonAtomic(getManifestPath(), payload);
  return payload;
};

const updateManifestForRename = (fromName, toName) => {
  const manifest = readManifestPayload();
  const baseList = Array.isArray(manifest) ? manifest : listGemonteerdFileNames();
  const next = [];
  const seen = new Set();
  let replaced = false;

  baseList.forEach((name) => {
    let nextName = name;
    if (nextName === fromName) {
      nextName = toName;
      replaced = true;
    }
    if (!isAllowedFileName(nextName)) return;
    if (seen.has(nextName)) return;
    seen.add(nextName);
    next.push(nextName);
  });

  if (!replaced && isAllowedFileName(toName) && !seen.has(toName)) {
    next.push(toName);
  }

  writeJsonAtomic(getManifestPath(), next);
  return next;
};

const buildError = (code) => {
  const err = new Error(code);
  err.code = code;
  return err;
};

const renameGemonteerdImage = (fromRaw, toRaw) => {
  const dir = getGemonteerdDir();
  if (!fs.existsSync(dir)) {
    throw buildError("not_found");
  }

  const fromName = normalizeName(fromRaw);
  if (!fromName) throw buildError("invalid_from");
  if (!isAllowedExtension(fromName)) throw buildError("invalid_extension");

  const toBase = normalizeName(toRaw);
  if (!toBase) throw buildError("invalid_to");

  const fromExt = path.extname(fromName);
  const toName = withExtension(toBase, fromExt);
  if (!normalizeName(toName)) throw buildError("invalid_to");
  if (!isAllowedExtension(toName)) throw buildError("invalid_extension");

  if (fromName.toLowerCase() === toName.toLowerCase()) {
    throw buildError("same_name");
  }

  const fromPath = path.join(dir, fromName);
  if (!fs.existsSync(fromPath)) throw buildError("not_found");

  const toPath = path.join(dir, toName);
  if (fs.existsSync(toPath)) throw buildError("already_exists");

  fs.renameSync(fromPath, toPath);
  const names = updateManifestForRename(fromName, toName);

  return {
    from: fromName,
    to: toName,
    items: names.map((name) => ({ name, url: toAssetUrl(name) })),
  };
};

module.exports = {
  ADMIN_ASSET_PREFIX,
  getGemonteerdDir,
  getManifestPath,
  listGemonteerdFileNames,
  listGemonteerdImages,
  readManifestPayload,
  renameGemonteerdImage,
  writeGemonteerdManifest,
};
