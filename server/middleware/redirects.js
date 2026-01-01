const TtlCache = require("../cache/ttlCache");
const { listRedirects } = require("../services/redirectService");

const SKIP_PREFIXES = ["/admin", "/api", "/storage", "/deploy"];

function shouldSkip(pathname) {
  return SKIP_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function createRedirectMiddleware(db, options = {}) {
  const cache = new TtlCache({ defaultTtlMs: options.cacheTtlMs || 60 * 1000 });

  return (req, res, next) => {
    if (shouldSkip(req.path)) {
      next();
      return;
    }

    let redirects = cache.get("redirects");
    if (!redirects) {
      redirects = listRedirects(db, { enabledOnly: true });
      cache.set("redirects", redirects);
    }

    const hit = redirects.find((rule) => rule.fromPath === req.path);
    if (hit) {
      res.redirect(hit.code, hit.toPath);
      return;
    }

    next();
  };
}

module.exports = {
  createRedirectMiddleware,
};
