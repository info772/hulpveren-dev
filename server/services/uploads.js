const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { storagePaths } = require("./storage");
const { sanitizeSlug } = require("./validators");

const heroStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const slug = sanitizeSlug(req.body.slug || req.body.title || "draft");
    const target = path.join(storagePaths.blogsRoot, slug || "draft");
    fs.mkdirSync(target, { recursive: true });
    cb(null, target);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    cb(null, `hero${ext}`);
  },
});

const heroUpload = multer({
  storage: heroStorage,
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
    if (!allowed.includes(ext)) {
      cb(new Error("invalid_hero_file"));
      return;
    }
    cb(null, true);
  },
});

const madStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(storagePaths.madImportsRoot, { recursive: true });
    cb(null, storagePaths.madImportsRoot);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path
      .basename(file.originalname, ext)
      .replace(/[^a-z0-9-_]+/gi, "_")
      .slice(0, 60);
    cb(null, `${Date.now()}_${base}${ext}`);
  },
});

const madUpload = multer({
  storage: madStorage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== ".json" && ext !== ".zip") {
      cb(new Error("invalid_mad_file"));
      return;
    }
    cb(null, true);
  },
});

module.exports = {
  heroUpload,
  madUpload,
};
