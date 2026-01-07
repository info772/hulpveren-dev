const fs = require("fs");
const path = require("path");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeFileSafe(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content);
}

function writeJson(filePath, data) {
  writeFileSafe(filePath, JSON.stringify(data, null, 2));
}

function writeDerived(repoRoot, derivedOutputs) {
  const outRoot = path.join(repoRoot, "tools/data-quality/out/derived");
  ensureDir(outRoot);
  derivedOutputs.forEach((src) => {
    let rel = src.sourceFile || src.source || src.path;
    if (rel && path.isAbsolute(rel)) {
    rel = path.relative(repoRoot, rel);
}

    if (!rel) return;
    const dest = path.join(outRoot, rel);
    ensureDir(path.dirname(dest));
    const records = src.records || src.derivedRecords || src.recordsOut || [];
    writeJson(dest, records.length === 1 ? records[0] : records);
  });
}

function writeReports(repoRoot, findings, mdReport, sources) {
  const outDir = path.join(repoRoot, "tools/data-quality/out");
  ensureDir(outDir);
  writeJson(path.join(outDir, "lint-report.json"), { findings, sources });
  writeFileSafe(path.join(outDir, "lint-report.md"), mdReport);
}

module.exports = { writeDerived, writeReports };
