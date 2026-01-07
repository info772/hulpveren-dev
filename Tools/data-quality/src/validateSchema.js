const Ajv = require("ajv");

function getRecordsFromSource(src) {
  if (!src) return null;

  if (Array.isArray(src.records)) return src.records;

  const j = src.json;
  if (Array.isArray(j)) return j;
  if (j && Array.isArray(j.records)) return j.records;

  if (j && typeof j === "object") return [j];

  return null;
}

function buildAjv() {
  return new Ajv({ allErrors: true, allowUnionTypes: true, strict: false });
}

function pickSchemaForRecord(rec) {
  if (rec && typeof rec === "object" && typeof rec.setCode === "string") return "set";
  return "page";
}

function validateSchema(loadedSources, schemas) {
  const findings = [];
  const ajv = buildAjv();

  if (!schemas || typeof schemas.page !== "object" || typeof schemas.set !== "object") {
    throw new Error(
      "Invalid schemas passed to validateSchema: " +
      JSON.stringify({
        hasSchemas: !!schemas,
        pageType: typeof schemas?.page,
        setType: typeof schemas?.set
      })
    );
  }

  const validatePage = ajv.compile(schemas.page);
  const validateSet = ajv.compile(schemas.set);

  (loadedSources || []).forEach((src) => {
      const file = (src.absPath || src.source || "").toLowerCase();
      if (file.includes("/fitments/") || file.endsWith("/build-info.json") || file.endsWith("build-info.json")) {
        return;
      }
  
    const records = getRecordsFromSource(src);

    if (!records) {
      findings.push({
        severity: "WARN",
        code: "UNSUPPORTED_SOURCE_SHAPE",
        message:
          "Could not extract records array from source (expected records/json/json.records). Skipped schema validation for this file.",
        sourceFile: src.absPath || src.source || "",
        recordId: null,
        setCode: null,
        path: ""
      });
      return;
    }

    records.forEach((rec, idx) => {
      const kind = pickSchemaForRecord(rec);
      const ok = kind === "set" ? validateSet(rec) : validatePage(rec);

      if (!ok) {
        const errs = (kind === "set" ? validateSet.errors : validatePage.errors) || [];
        findings.push({
          severity: "ERROR",
          code: "SCHEMA_INVALID",
          message: `${kind}-record schema failed at index ${idx}: ${errs
            .map((e) => `${e.instancePath || "/"} ${e.message}`)
            .join("; ")}`.slice(0, 2000),
          sourceFile: src.absPath || src.source || "",
          recordId: (rec && (rec.id || rec.slug)) ? (rec.id || rec.slug) : `idx:${idx}`,
          setCode: rec && rec.setCode ? rec.setCode : null,
          path: errs[0]?.instancePath || ""
        });
      }
    });
  });

  return findings;
}

module.exports = { validateSchema };
