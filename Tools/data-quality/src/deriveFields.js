const fs = require("fs");
const path = require("path");
const madMap = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "schema", "mad-suffix-map.json"), "utf8")
);

function getMadSuffixDigit(setCode) {
  const m = String(setCode || "").match(/(\d)(?!.*\d)/);
  return m ? m[1] : null;
}

function mapFromMad(digit) {
  return madMap[digit] || null;
}

function deriveFromSuffix(setCode) {
  const code = String(setCode || "");
  if (!/^(hv|sd)-/i.test(code)) return null;
  const digit = getMadSuffixDigit(code);
  const info = mapFromMad(digit);
  if (!digit || !info) return null;
  const derived = { application: info.springApplication, digit };
  derived.includesFSD = /^sd-/i.test(code);
  derived.solutionLevel = derived.includesFSD ? "special_duty" : "standard";
  return derived;
}

function textSignals(record) {
  const texts = [];
  const seo = record.seo || {};
  ["title", "description", "summary"].forEach((k) => {
    if (seo && seo[k]) texts.push(String(seo[k]).toLowerCase());
  });
  if (record.description) texts.push(String(record.description).toLowerCase());
  const combined = texts.join(" ");
  const hasReplacement = /(vervang|replace|vervangen)/i.test(combined);
  const hasAssist = /(hulpveer|assist|ondersteun|bijplaats)/i.test(combined);
  return { hasReplacement, hasAssist };
}

function deriveSpringFromText(record) {
  const { hasReplacement, hasAssist } = textSignals(record);
  if (hasReplacement && !hasAssist) return "replacement";
  if (hasAssist && !hasReplacement) return "assist";
  return null;
}

function deriveAxleConfig(record) {
  const axles = record.axles || {};
  const front = axles.front && axles.front.active;
  const rear = axles.rear && axles.rear.active;
  if (front && rear) return "both";
  if (front) return "front";
  if (rear) return "rear";
  const sets = Array.isArray(record.sets) ? record.sets : [];
  const hasFront = sets.some((s) => s.axle === "front");
  const hasRear = sets.some((s) => s.axle === "rear");
  if (hasFront && hasRear) return "both";
  if (hasFront) return "front";
  if (hasRear) return "rear";
  return null;
}

function applyDerivations(loaded, findings) {
  const derivedOutputs = [];

  
  loaded.forEach((src) => {
    const type = src.type || (src.meta && src.meta.type);

    const hasKitsContainer = src.json && typeof src.json === "object" && Array.isArray(src.json.kits);

    // --- SET RECORDS: hv/ls/nr kits ---
    if (type === "setRecords" && hasKitsContainer) {
      const derivedKits = src.json.kits.map((rec, idx) => {
        const clone = JSON.parse(JSON.stringify(rec));
        clone.derived = clone.derived || {};

        const setCode = rec.setCode || rec.sku || "";
        const suf = deriveFromSuffix(setCode);

        if (suf && suf.application) {
          clone.derived.springApplication = suf.application;
          clone.derived.solutionLevel = suf.solutionLevel;
          if (suf.includesFSD) clone.derived.includesFSD = true;
          clone.derived.madSuffix = suf.digit;
        } else {
          const textSpring = deriveSpringFromText(rec);
          if (textSpring) clone.derived.springApplication = textSpring;
        }
        return clone;
      });

      const outObj = { ...src.json, kits: derivedKits };

      derivedOutputs.push({
        sourceFile: src.source || src.absPath || (src.meta && src.meta.path) || "",
        type,
        records: [outObj], // schrijf weer als object
      });
      return;
    }

    // --- DEFAULT: bestaande gedrag ---
    const records = Array.isArray(src.records)
      ? src.records
      : (Array.isArray(src.json)
          ? src.json
          : (src.json && Array.isArray(src.json.records)
              ? src.json.records
              : (src.json && typeof src.json === "object"
                  ? [src.json]
                  : [])));

    const derivedRecords = records.map((rec, idx) => {
      const clone = JSON.parse(JSON.stringify(rec));
      clone.derived = clone.derived || {};

      if (type === "setRecords") {
        const setCode = rec.setCode || rec.sku || "";
        const suf = deriveFromSuffix(setCode);
        if (suf && suf.application) {
          clone.derived.springApplication = suf.application;
          clone.derived.solutionLevel = suf.solutionLevel;
          if (suf.includesFSD) clone.derived.includesFSD = true;
          clone.derived.madSuffix = suf.digit;
        } else {
          const textSpring = deriveSpringFromText(rec);
          if (textSpring) clone.derived.springApplication = textSpring;
        }
      } else {
        const axDer = deriveAxleConfig(rec);
        if (axDer) clone.derived.axleConfig = axDer;

        if (rec.springApplication) clone.derived.springApplication = rec.springApplication;
        else {
          const textSpring = deriveSpringFromText(rec);
          if (textSpring) clone.derived.springApplication = textSpring;
        }
      }
      return clone;
    });

    derivedOutputs.push({
      sourceFile: src.source || src.absPath || (src.meta && src.meta.path) || "",
      type,
      records: derivedRecords,
    });
  });


  return derivedOutputs;
}

module.exports = { deriveFromSuffix, applyDerivations, deriveAxleConfig, deriveSpringFromText };
