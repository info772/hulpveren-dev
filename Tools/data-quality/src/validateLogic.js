const fs = require("fs");
const path = require("path");
const madMap = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "schema", "mad-suffix-map.json"), "utf8")
);

const ENUM_FIELDS = {
  axleConfig: "axleConfig",
  axle: "axle",
  solutionLevel: "solutionLevel",
  springApplication: "springApplication",
  vehicleType: "vehicleType",
};

function makeFinding(severity, code, message, ctx = {}) {
  return { severity, code, message, ...ctx };
}

function checkEnums(record, enums, ctx) {
  const findings = [];
  Object.keys(ENUM_FIELDS).forEach((field) => {
    const key = ENUM_FIELDS[field];
    const allowed = enums[key];
    if (!allowed || !allowed.length) return;
    const val = record[field];
    if (val && !allowed.includes(val)) {
      findings.push(
        makeFinding("ERROR", "L004_UNKNOWN_ENUM", `Unknown ${field}: ${val}`, ctx)
      );
    }
  });
  return findings;
}

function getMadSuffixDigit(code) {
  const m = String(code || "").match(/(\d)(?!.*\d)/);
  return m ? m[1] : null;
}

function suffixMapping(code) {
  const digit = getMadSuffixDigit(code);
  if (!digit) return null;
  return madMap[digit] || null;
}

function deriveFromSuffixLocal(code) {
  const info = suffixMapping(code);
  const digit = getMadSuffixDigit(code);
  if (!digit || !info) return null;
  const includesFSD = /^sd-/i.test(String(code || ""));
  const solutionLevel = includesFSD ? "special_duty" : "standard";
  return { application: info.springApplication, digit, includesFSD, solutionLevel };
}

function checkMadRulesForSet(set, ctx) {
  const findings = [];
  const code = String(set.setCode || set.sku || "");

  // Only enforce MAD suffix rules on "MAD-style" codes: HV-123456 or SD-123456
  // (legacy like HV-001667 / HV-042017 etc. should not fail)
  const isMadStyle = /^(hv|sd)-\d{6}$/i.test(code);
  if (!isMadStyle) return findings;

  const mapped = suffixMapping(code);
  if (!mapped) {
    findings.push(makeFinding("ERROR", "L100_MAD_SUFFIX_UNPARSEABLE", `Suffix not parseable for ${code}`, ctx));
    return findings;
  }

  if (set.springApplication && set.springApplication !== mapped.springApplication) {
    findings.push(makeFinding(
      "ERROR",
      "L101_MAD_SUFFIX_APPLICATION_CONTRADICTION",
      `springApplication=${set.springApplication} contradicts MAD suffix ${mapped.springApplication}`,
      ctx
    ));
  }

  if (/^sd-/i.test(code)) {
    if (set.includesFSD === false) {
      findings.push(makeFinding("ERROR", "L102_SD_INCLUDESFSD_CONTRADICTION", "SD set must include FSD", ctx));
    }
  }

  return findings;
}

function checkContentCopy(setOrPage, ctx) {
  const findings = [];
  const spring = setOrPage.springApplication;
  if (!spring) return findings;
  const textFields = [];
  const seo = setOrPage.seo || {};
  const description = setOrPage.description;
  ["title", "description", "summary", "body"].forEach((k) => {
    if (seo && seo[k]) textFields.push(String(seo[k]).toLowerCase());
  });
  if (description) textFields.push(String(description).toLowerCase());
  const combined = textFields.join(" ");
  if (!combined) return findings;
  if (spring === "replacement" && /(ondersteun|assist|bijplaats|hulpveer)/i.test(combined)) {
    findings.push(makeFinding("WARN", "L110_REPLACEMENT_COPY_SAYS_ASSIST", "Copy hints assist while springApplication=replacement", ctx));
  }
  if (spring === "assist" && /(vervang|replace|vervangen)/i.test(combined)) {
    findings.push(makeFinding("WARN", "L111_ASSIST_COPY_SAYS_REPLACEMENT", "Copy hints replacement while springApplication=assist", ctx));
  }
  return findings;
}

function checkSetRefs(page, enums, ctxBase) {
  const findings = [];
  const setRefs = Array.isArray(page.sets) ? page.sets : [];
  const seen = new Map();

  setRefs.forEach((ref, idx) => {
    const ctx = { ...ctxBase, path: `/sets/${idx}`, setCode: ref.setCode };
    if (!ref.setCode) {
      findings.push(makeFinding("ERROR", "L006_MISSING_SET_CODE", "Set reference missing setCode", ctx));
      return;
    }
    findings.push(...checkEnums(ref, enums, ctx));
    const key = ref.setCode;
    const prev = seen.get(key);
    if (prev) {
      const fields = ["axle", "solutionLevel", "springApplication", "includesFSD"];
      const conflict = fields.some((f) => prev[f] && ref[f] && prev[f] !== ref[f]);
      if (conflict) {
        findings.push(makeFinding("ERROR", "L005_DUPLICATE_SET_CONFLICT", `Conflicting data for setCode ${key}`, ctx));
      }
    } else {
      seen.set(key, ref);
    }
  });

  if (setRefs.length > 1) {
    const differentiators = setRefs.map((r) =>
      ["axle", "solutionLevel", "springApplication", "includesFSD", "useCase", "tags"]
        .map((k) => JSON.stringify(r[k] || ""))
        .join("|")
    );
    const unique = new Set(differentiators);
    if (unique.size === 1) {
      findings.push(
        makeFinding("WARN", "L003_MULTISET_NO_DIFFERENTIATORS", "Multiple sets but no differentiators (axle/useCase/tags).", ctxBase)
      );
    }
  }

  return findings;
}

function checkAxleConfig(page, ctxBase) {
  const findings = [];
  const setRefs = Array.isArray(page.sets) ? page.sets : [];
  const hasFrontSet = setRefs.some((s) => s.axle === "front");
  const hasRearSet = setRefs.some((s) => s.axle === "rear");
  const frontActive = page.axles && page.axles.front && page.axles.front.active;
  const rearActive = page.axles && page.axles.rear && page.axles.rear.active;

  if (page.axleConfig === "both") {
    if (!((frontActive || hasFrontSet) && (rearActive || hasRearSet))) {
      findings.push(makeFinding("ERROR", "L001_AXLECONFIG_BOTH_INCOMPLETE", "axleConfig=both but only one axle active/present", ctxBase));
    }
  }
  if (page.axleConfig === "front" && (rearActive || hasRearSet)) {
    findings.push(makeFinding("WARN", "L002_AXLECONFIG_MISMATCH", "axleConfig=front but rear data present", ctxBase));
  }
  if (page.axleConfig === "rear" && (frontActive || hasFrontSet)) {
    findings.push(makeFinding("WARN", "L002_AXLECONFIG_MISMATCH", "axleConfig=rear but front data present", ctxBase));
  }

  return findings;
}

function checkInternalLinks(page, ctxBase) {
  const findings = [];
  if (!page.internalLinks) return findings;
  const arr = Array.isArray(page.internalLinks) ? page.internalLinks : [page.internalLinks];
  arr.forEach((link, idx) => {
    if (typeof link !== "string" || !link.trim()) {
      findings.push(makeFinding("WARN", "L007_BROKEN_INTERNAL_LINKS", "Internal link is empty/non-string", { ...ctxBase, path: `/internalLinks/${idx}` }));
    }
  });
  return findings;
}

function validateLogic(loaded, enums, stats) {
  const findings = [];
  loaded.forEach((src) => {
    if ((src.type || src.meta?.type) === "setRecords") {
      const records = (src.json && Array.isArray(src.json.kits)) ? src.json.kits : (Array.isArray(src.json) ? src.json : []);
      records.forEach((rec, idx) => {
        const setCode = rec.setCode || rec.sku;
        const ctx = { sourceFile: src.absPath || src.source, recordId: setCode || `idx:${idx}`, setCode };      
        findings.push(...checkEnums(rec, enums, ctx));
        findings.push(...checkMadRulesForSet(rec, ctx));
        findings.push(...checkContentCopy(rec, ctx));
        const suffixInfo = deriveFromSuffixLocal(setCode);
        if (suffixInfo && suffixInfo.application) {
          stats.suffix.counts[suffixInfo.digit] = (stats.suffix.counts[suffixInfo.digit] || 0) + 1;
          stats.suffix.total++;
          if (/^sd-/i.test(setCode)) stats.suffix.sd++;
          if (/^hv-/i.test(setCode)) stats.suffix.hv++;
        }
      });
    } else {
      const records = Array.isArray(src.records)
      ? src.records
      : (src.json && Array.isArray(src.json.kits)
          ? src.json.kits
          : (Array.isArray(src.json)
              ? src.json
              : (src.json && Array.isArray(src.json.records)
                  ? src.json.records
                  : (src.json && typeof src.json === "object"
                      ? [src.json]
                      : []))));    

records.forEach((rec, idx) => {

        const ctx = { sourceFile: src.sourceFile, recordId: rec.id || rec.slug || `idx:${idx}` };
        findings.push(...checkEnums(rec, enums, ctx));
        findings.push(...checkSetRefs(rec, enums, ctx));
        findings.push(...checkAxleConfig(rec, ctx));
        findings.push(...checkInternalLinks(rec, ctx));
        findings.push(...checkContentCopy(rec, ctx));
      });
    }
  });
  return findings;
}

module.exports = { validateLogic, suffixMapping };

