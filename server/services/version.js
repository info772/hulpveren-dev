const fs = require("fs");
const path = require("path");

const resolveGitSha = () => {
  const headPath = path.join(__dirname, "..", "..", ".git", "HEAD");
  if (!fs.existsSync(headPath)) return "";
  const head = fs.readFileSync(headPath, "utf8").trim();
  if (!head) return "";
  if (!head.startsWith("ref:")) return head;
  const ref = head.replace(/^ref:\s*/, "").trim();
  if (!ref) return "";
  const refPath = path.join(__dirname, "..", "..", ".git", ref);
  if (fs.existsSync(refPath)) {
    return fs.readFileSync(refPath, "utf8").trim();
  }
  return "";
};

const getBuildInfo = () => {
  const envVersion =
    process.env.BUILD_ID ||
    process.env.GIT_SHA ||
    process.env.COMMIT_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    "";
  if (envVersion) {
    return { version: envVersion, source: "env" };
  }
  const gitSha = resolveGitSha();
  if (gitSha) {
    return { version: gitSha, source: "git" };
  }
  return { version: "unknown", source: "unknown" };
};

module.exports = {
  getBuildInfo,
};
