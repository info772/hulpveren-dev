function rateLimit(options = {}) {
  const windowMs = options.windowMs || 60 * 1000;
  const max = options.max || 30;
  const hits = new Map();

  return (req, res, next) => {
    const ip = req.ip || req.connection?.remoteAddress || "unknown";
    const now = Date.now();
    const entry = hits.get(ip);

    if (!entry || entry.resetAt <= now) {
      hits.set(ip, { count: 1, resetAt: now + windowMs });
    } else {
      entry.count += 1;
    }

    const current = hits.get(ip);
    const remaining = Math.max(0, max - current.count);
    res.setHeader("X-RateLimit-Limit", max);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", Math.ceil(current.resetAt / 1000));

    if (current.count > max) {
      res.status(429).json({ error: "rate_limited" });
      return;
    }

    next();
  };
}

module.exports = {
  rateLimit,
};
