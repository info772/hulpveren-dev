const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const { storagePaths } = require("./storage");
const { writeJsonAtomic } = require("./fileUtils");

const REQUIRED_KEYS = ["sku", "fitment"];

function extractRecords(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.items)) return parsed.items;
  if (parsed && Array.isArray(parsed.records)) return parsed.records;
  return null;
}

function parseMadFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  let jsonText = "";
  if (ext === ".zip") {
    const zip = new AdmZip(filePath);
    const entry = zip
      .getEntries()
      .find((item) => !item.isDirectory && item.entryName.toLowerCase().endsWith(".json"));
    if (!entry) {
      throw new Error("no_json_in_zip");
    }
    jsonText = entry.getData().toString("utf8");
  } else {
    jsonText = fs.readFileSync(filePath, "utf8");
  }

  const parsed = JSON.parse(jsonText);
  const records = extractRecords(parsed);
  if (!records) {
    throw new Error("invalid_mad_format");
  }
  return records;
}

function validateRecords(records) {
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error("empty_mad_dataset");
  }
  for (let i = 0; i < records.length; i += 1) {
    const record = records[i];
    for (const key of REQUIRED_KEYS) {
      if (record?.[key] === undefined || record?.[key] === null || record?.[key] === "") {
        throw new Error(`missing_${key}`);
      }
    }
    if (!record?.title && !record?.description) {
      throw new Error("missing_title");
    }
  }
}

function buildMadIndex(records) {
  const facets = {
    axle: {},
    type: {},
    fitment: {},
  };
  const items = records.map((record) => {
    const item = {
      sku: String(record.sku || ""),
      title: String(record.title || record.description || ""),
      axle: String(record.axle || ""),
      type: String(record.type || ""),
      fitment: String(record.fitment || ""),
    };
    if (item.axle) facets.axle[item.axle] = (facets.axle[item.axle] || 0) + 1;
    if (item.type) facets.type[item.type] = (facets.type[item.type] || 0) + 1;
    if (item.fitment) facets.fitment[item.fitment] = (facets.fitment[item.fitment] || 0) + 1;
    return item;
  });

  return {
    recordCount: items.length,
    items,
    facets,
  };
}

function writeCurrent(records) {
  writeJsonAtomic(path.join(storagePaths.madRoot, "current.json"), { items: records });
}

function writeMadIndex(indexPayload) {
  writeJsonAtomic(path.join(storagePaths.generatedRoot, "mad-index.json"), indexPayload);
}

function rebuildMadIndexFromCurrent() {
  const currentPath = path.join(storagePaths.madRoot, "current.json");
  if (!fs.existsSync(currentPath)) return 0;
  const payload = JSON.parse(fs.readFileSync(currentPath, "utf8"));
  const records = extractRecords(payload) || payload.items || [];
  if (!Array.isArray(records) || records.length === 0) return 0;
  const indexPayload = buildMadIndex(records);
  writeMadIndex(indexPayload);
  return indexPayload.recordCount;
}

function registerImport(db, info) {
  db.prepare("UPDATE mad_imports SET isCurrent = 0").run();
  const result = db
    .prepare(
      `INSERT INTO mad_imports (filename, storedPath, recordCount, createdAt, isCurrent)
       VALUES (@filename, @storedPath, @recordCount, @createdAt, 1)`
    )
    .run(info);
  return result.lastInsertRowid;
}

function handleMadUpload(db, filePath, originalName) {
  const records = parseMadFile(filePath);
  validateRecords(records);
  const indexPayload = buildMadIndex(records);
  writeCurrent(records);
  writeMadIndex(indexPayload);
  const createdAt = new Date().toISOString();
  const id = registerImport(db, {
    filename: originalName,
    storedPath: filePath,
    recordCount: indexPayload.recordCount,
    createdAt,
  });
  return { id, recordCount: indexPayload.recordCount, createdAt };
}

function listImports(db) {
  return db
    .prepare(
      `SELECT id, filename, storedPath, recordCount, createdAt, isCurrent
       FROM mad_imports ORDER BY createdAt DESC`
    )
    .all();
}

function setCurrentImport(db, id) {
  const row = db
    .prepare(
      `SELECT id, filename, storedPath, recordCount, createdAt, isCurrent
       FROM mad_imports WHERE id = ?`
    )
    .get(id);
  if (!row) {
    return { errors: ["not_found"] };
  }

  const records = parseMadFile(row.storedPath);
  validateRecords(records);
  const indexPayload = buildMadIndex(records);
  writeCurrent(records);
  writeMadIndex(indexPayload);
  db.prepare("UPDATE mad_imports SET isCurrent = 0").run();
  db.prepare("UPDATE mad_imports SET isCurrent = 1 WHERE id = ?").run(id);
  return { import: row, recordCount: indexPayload.recordCount };
}

module.exports = {
  handleMadUpload,
  listImports,
  setCurrentImport,
  parseMadFile,
  buildMadIndex,
  writeMadIndex,
  rebuildMadIndexFromCurrent,
};
