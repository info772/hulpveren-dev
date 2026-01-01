const express = require("express");
const { execFile } = require("child_process");
const { logError } = require("../services/logger");

const DEFAULT_SCRIPT_PATH = "/usr/local/bin/deploy-dev.sh";
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_ALLOWED_IPS = ["127.0.0.1", "::1"];

function normalizeIp(ip) {
  if (!ip) return "";
  return ip.startsWith("::ffff:") ? ip.slice(7) : ip;
}

function getAllowedIps() {
  const raw = process.env.DEPLOY_ALLOWED_IPS;
  if (!raw) {
    return DEFAULT_ALLOWED_IPS;
  }
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map(normalizeIp);
}

function isAllowedIp(req) {
  const clientIp = normalizeIp(req.ip);
  const allowed = getAllowedIps();
  return allowed.includes(clientIp);
}

function requireAdminApi(req, res, next) {
  if (req.session?.adminUser) {
    next();
    return;
  }
  res.status(401).json({ error: "unauthorized" });
}

function createDeployRouter(csrfProtection) {
  const router = express.Router();

  router.post("/", requireAdminApi, csrfProtection, (req, res) => {
    if (!isAllowedIp(req)) {
      res.status(403).json({ error: "forbidden" });
      return;
    }

    const scriptPath = process.env.DEPLOY_SCRIPT || DEFAULT_SCRIPT_PATH;
    const timeoutMs = Number.parseInt(process.env.DEPLOY_TIMEOUT_MS || String(DEFAULT_TIMEOUT_MS), 10);

    execFile("sudo", ["-n", scriptPath], { timeout: timeoutMs, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        logError(error, {
          context: "deploy",
          ip: req.ip,
          stdout: (stdout || "").trim(),
          stderr: (stderr || "").trim(),
        });
        res.status(500).type("text/plain").send((stderr || "").trim() || "deploy_failed");
        return;
      }
      res.type("text/plain").send((stdout || "").trim() || "Deploy completed.");
    });
  });

  return router;
}

module.exports = createDeployRouter;
