const express = require("express");
const router = express.Router();

const { requestText } = require("../services/proxyClient");

/**
 * Dev/debug passthrough for EasyCarParts proxyv7.
 * Example: /aldoc-proxy/PartServices/api/Menu/
 * Will call upstream:  <PROXYV7_BASE>/PartServices/api/Menu/
 */
router.get("/*", async (req, res) => {
  try {
    const upstreamPath = req.originalUrl.replace(/^\/aldoc-proxy/i, "");

    const { text, upstreamMs, status, contentType } = await requestText(
      upstreamPath,
      {
        allowNonOk: true,
        headers: {
          "user-agent": req.get("user-agent") || "Mozilla/5.0",
          accept: req.get("accept") || "*/*",
        },
      }
    );

    if (contentType) res.setHeader("content-type", contentType);
    res.setHeader("x-upstream-ms", String(upstreamMs || 0));
    res.status(status || 200).send(text);
  } catch (e) {
    res.status(502).json({
      error: "aldoc_proxy_failed",
      message: String(e?.message || e),
    });
  }
});

module.exports = router;
