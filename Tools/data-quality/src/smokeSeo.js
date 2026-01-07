#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function getDerived(kit) {
  const madMap = { 0: "assist", 1: "full_replacement", 3: "assist", 5: "assist", 8: "replacement" };
  if (kit.derived) return kit.derived;
  const sku = String(kit.sku || "");
  const m = sku.match(/(\d)(?!.*\d)/);
  const digit = m ? m[1] : "";
  const springApplication = madMap[digit] || "assist";
  const includesFSD = /^sd-/i.test(sku);
  return {
    springApplication,
    includesFSD,
    solutionLevel: includesFSD ? "special_duty" : "standard",
    madSuffix: digit,
  };
}

function introFor(app) {
  return app === "replacement" || app === "full_replacement"
    ? "vervangingsveren vervangen de originele"
    : "hulpveren ondersteunen de bestaande";
}

function run() {
  const repoRoot = path.resolve(__dirname, "..", "..", "..", "wwwroot", "data");
  const hv = loadJson(path.join(repoRoot, "hv-kits.json"));
  const kits = hv.kits || [];
  const sampleSkus = ["HV-133375", "HV-138158", kits.find((k) => /^SD-/i.test(k.sku))?.sku].filter(Boolean);

  let failed = false;
  sampleSkus.forEach((sku) => {
    const kit = kits.find((k) => String(k.sku).toLowerCase() === String(sku).toLowerCase());
    if (!kit) {
      console.error("Missing kit", sku);
      failed = true;
      return;
    }
    const d = getDerived(kit);
    const intro = introFor(d.springApplication);
    if (d.springApplication === "replacement" && /hulpveer/i.test(intro)) {
      console.error("Contradiction: replacement intro mentions hulpveer", sku);
      failed = true;
    }
    if (d.springApplication === "assist" && /vervang/i.test(intro)) {
      console.error("Contradiction: assist intro mentions vervang", sku);
      failed = true;
    }
    if (String(sku).toUpperCase().startsWith("SD-") && d.solutionLevel !== "special_duty") {
      console.error("SD kit missing special_duty", sku);
      failed = true;
    }
    console.log(`${sku}: spring=${d.springApplication}, SD=${d.solutionLevel}, FSD=${d.includesFSD}`);
  });

  if (failed) {
    process.exitCode = 1;
  }
}

run();
