const crypto = require("crypto");
const { logRequest } = require("../services/logger");

function requestLogger() {
  return (req, res, next) => {
    const reqId =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    req.id = reqId;
    res.setHeader("X-Request-Id", reqId);
    const start = Date.now();

    res.on("finish", () => {
      const payload = {
        reqId,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        upstreamMs: res.locals.upstreamMs || null,
        plateMask: res.locals.plateMask || null,
        plateHash: res.locals.plateHash || null,
        durationMs: Date.now() - start,
      };
      console.log(JSON.stringify(payload));
      logRequest(payload);
    });

    next();
  };
}

module.exports = {
  requestLogger,
};
