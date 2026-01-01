const fs = require("fs");
const path = require("path");
const { storagePaths } = require("./storage");

const appLogPath = path.join(storagePaths.logsRoot, "app.log");
const errorLogPath = path.join(storagePaths.logsRoot, "errors.log");

function appendLine(filePath, payload) {
  const line = JSON.stringify({ ...payload, timestamp: new Date().toISOString() });
  fs.appendFile(filePath, `${line}\n`, () => {});
}

function logRequest(payload) {
  appendLine(appLogPath, payload);
}

function logError(error, context = {}) {
  const payload = {
    message: error?.message || "unknown_error",
    stack: error?.stack || null,
    ...context,
  };
  console.error(payload);
  appendLine(appLogPath, payload);
  appendLine(errorLogPath, payload);
}

module.exports = {
  logRequest,
  logError,
};
