#!/usr/bin/env node
const path = require("path");
const pageSchema = require("../schema/page-record.schema.json");
const setSchema  = require("../schema/set-record.schema.json");
const enums = require("../schema/enums.json");

const schemas = { page: pageSchema, set: setSchema };

const { discoverSources } = require("./discoverSources");
const { loadAll } = require("./loadJson");
const { validateSchema } = require("./validateSchema");
const { validateLogic } = require("./validateLogic");
const { applyDerivations, deriveFromSuffix } = require("./deriveFields");
const { renderReportMd } = require("./renderReportMd");
const { writeDerived, writeReports } = require("./writeOutputs");
const fs = require("fs");

const repoRoot = path.resolve(__dirname, "..", "..", "..");

function runLint({ derived = false, fix = false } = {}) {
  const sources = discoverSources(repoRoot);
  const { loaded, findings: loadFindings } = loadAll(repoRoot, sources);
  const validators = {
    schema: validateSchema,
    logic: validateLogic
  };
  
  const schemaFindings = validateSchema(loaded, schemas);

  const suffixStats = { suffix: { total: 0, hv: 0, sd: 0, counts: { "0":0, "1":0, "3":0, "5":0, "8":0 } } };
  const logicFindings = validateLogic(loaded, enums, suffixStats);

  const findings = [...loadFindings, ...schemaFindings, ...logicFindings];

  let derivedOutputs = [];
  if (derived) {
    derivedOutputs = applyDerivations(loaded, findings);
  }

  const md = renderReportMd({ findings, sources, suffixStats });
  writeReports(repoRoot, findings, md, sources);
  writeDerived(repoRoot, derivedOutputs || []);

  if (fix) {
    writeFixSuggestions(repoRoot, loaded);
  }

  const hasError = findings.some((f) => f.severity === "ERROR");
  if (hasError) {
    process.exitCode = 2;
  }
}

function writeFixSuggestions(root, loaded) {
  const out = [];
  loaded.forEach((src) => {
    if (src.type !== "setRecords") return;
    const edits = [];
    src.records.forEach((rec, idx) => {
      const basePtr = Array.isArray(src.records) ? `/records/${idx}` : "";
      const code = rec.setCode || "";
      if (!/^(hv|sd)-/i.test(code)) return;
      const suffix = deriveFromSuffix(code);
      if (/^sd-/i.test(code) && rec.includesFSD === undefined) {
        edits.push({ jsonPointer: `${basePtr}/includesFSD`, old: null, new: true });
      }
      if (/^sd-/i.test(code) && rec.solutionLevel === undefined) {
        edits.push({ jsonPointer: `${basePtr}/solutionLevel`, old: null, new: "special_duty" });
      }
      if (suffix && suffix.application && rec.springApplication === undefined) {
        edits.push({ jsonPointer: `${basePtr}/springApplication`, old: null, new: suffix.application });
      }
    });
    if (edits.length) {
      out.push({ file: src.sourceFile, edits });
    }
  });
  const dest = path.join(root, "tools/data-quality/out/fixes.json");
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, JSON.stringify(out, null, 2));
}

function main() {
  const cmd = process.argv[2] || "lint";
  if (cmd === "lint") {
    runLint({ derived: false });
  } else if (cmd === "derive") {
    runLint({ derived: true });
  } else if (cmd === "all") {
    runLint({ derived: true });
  } else if (cmd === "fix") {
    runLint({ derived: false, fix: true });
  } else if (cmd === "smoke") {
    require("./smokeSeo");
  } else {
    console.error(`Unknown command: ${cmd}`);
    process.exitCode = 1;
  }
}

main();
