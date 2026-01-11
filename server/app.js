const express = require("express");
const path = require("path");
const crypto = require("crypto");
const session = require("express-session");
const csrf = require("csurf");

const { requestLogger } = require("./middleware/requestLogger");
const { rateLimit } = require("./middleware/rateLimit");
const { createRedirectMiddleware } = require("./middleware/redirects");
const { requireAdmin } = require("./middleware/requireAdmin");
const { initDb } = require("./services/db");
const { ensureStorage, storagePaths } = require("./services/storage");
const { logError } = require("./services/logger");
const { buildBlogJson } = require("./services/blogService");
const { rebuildMadIndexFromCurrent } = require("./services/madService");
const { writeRedirectsJson } = require("./services/redirectService");
const { getLegacyDebugInfo } = require("./services/blogRepository");
const { getBuildInfo } = require("./services/version");
const {
  ADMIN_ASSET_PREFIX,
  getGemonteerdDir,
  listGemonteerdFileNames,
  readManifestPayload,
} = require("./services/gemonteerdService");

const plateRoutes = require("./routes/plate");
const menuRoutes = require("./routes/menu");
const apiBlogsRoutes = require("./routes/apiBlogs");
const apiBlogPostsRoutes = require("./routes/apiBlogPosts");
const apiAdminBlogsRoutes = require("./routes/apiAdminBlogs");
const apiSettingsRoutes = require("./routes/apiSettings");
const apiMadRoutes = require("./routes/apiMad");
const apiRedirectsRoutes = require("./routes/apiRedirects");
const apiGemonteerdRoutes = require("./routes/apiGemonteerd");
const rdwRoutes = require("./routes/rdw");
const apiRdwRoutes = require("./routes/apiRdw");
const adminRoutes = require("./routes/admin");
const adminApiRoutes = require("./routes/adminApi");
const deployRoutes = require("./routes/deploy");

function createApp() {
  ensureStorage();
  const db = initDb();
  const startedAt = new Date().toISOString();
  const buildInfo = getBuildInfo();
  try {
    buildBlogJson(db);
    rebuildMadIndexFromCurrent();
    writeRedirectsJson(db);
    const legacyInfo = getLegacyDebugInfo();
    console.log(
      `[blogs] BLOG_CONTENT_DIR=${legacyInfo.path} source=${legacyInfo.sourceType} count=${legacyInfo.count} sample=${legacyInfo.slugs.slice(0, 3).join(", ")}`
    );
  } catch (err) {
    logError(err, { context: "startup_build" });
  }

  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", true);
  app.set("views", path.join(__dirname, "views"));
  app.set("view engine", "ejs");

  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));
  app.use(requestLogger());

  app.use("/storage", express.static(storagePaths.storageRoot));
  app.use("/admin/assets", express.static(path.join(__dirname, "public")));

  app.use(
    session({
      name: "hv_admin",
      secret: process.env.SESSION_SECRET || "dev-secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      },
    })
  );

  app.get(`${ADMIN_ASSET_PREFIX}/manifest.json`, requireAdmin, (req, res, next) => {
    try {
      const payload = readManifestPayload() || listGemonteerdFileNames();
      const body = JSON.stringify(payload);
      const etag = crypto.createHash("sha1").update(body).digest("hex");
      if (req.headers["if-none-match"] === etag) {
        res.status(304).end();
        return;
      }
      res.set("ETag", etag);
      res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.set("Pragma", "no-cache");
      res.set("Expires", "0");
      res.type("json").send(body);
    } catch (err) {
      next(err);
    }
  });

  app.use(
    ADMIN_ASSET_PREFIX,
    requireAdmin,
    express.static(getGemonteerdDir(), { etag: true, maxAge: 0 })
  );

  const csrfProtection = csrf();
  app.use(createRedirectMiddleware(db));
  app.use("/deploy", deployRoutes(csrfProtection));

  app.use("/api/plate", rateLimit({ windowMs: 60 * 1000, max: 30 }));
  app.use("/api/plate", plateRoutes);
  app.use("/api/rdw", apiRdwRoutes);
  app.use("/api/rdw", rateLimit({ windowMs: 60 * 1000, max: 30 }));
  app.use("/api/rdw", rdwRoutes);
  app.get("/api/health", (req, res) => {
    res.json({
      ok: true,
      version: buildInfo.version,
      versionSource: buildInfo.source,
      startedAt,
      env: process.env.NODE_ENV || "development",
    });
  });
  app.use("/api", menuRoutes);
  app.use("/api/blogs", apiBlogsRoutes(db));
  app.use("/api/blog", apiBlogPostsRoutes(db));
  app.use("/api/admin/blogs", apiAdminBlogsRoutes(db));
  app.use("/api/settings", apiSettingsRoutes(db));
  app.use("/api/mad", apiMadRoutes(db));
  app.use("/api/redirects", apiRedirectsRoutes(db));
  app.use("/api/gemonteerd", apiGemonteerdRoutes());

  app.use("/admin/api", adminApiRoutes(db, csrfProtection));
  app.use("/admin", adminRoutes(db, csrfProtection));

  app.use("/api", (req, res) => {
    res.status(404).json({ error: "not_found" });
  });

  app.use((req, res) => {
    res.status(404).send("Not found");
  });

  app.use((err, req, res, next) => {
    if (err && err.code === "EBADCSRFTOKEN") {
      if (req.originalUrl.startsWith("/admin/api")) {
        res.status(403).json({ error: "invalid_csrf" });
        return;
      }
      res.status(403).send("Invalid CSRF token.");
      return;
    }

    logError(err, { path: req.originalUrl, method: req.method });
    const wantsJson = req.originalUrl.startsWith("/api") || req.originalUrl.startsWith("/admin/api");
    if (wantsJson) {
      res.status(err.status || 500).json({ error: "server_error" });
      return;
    }
    res.status(err.status || 500).send("Server error.");
  });

  return app;
}

module.exports = {
  createApp,
};
