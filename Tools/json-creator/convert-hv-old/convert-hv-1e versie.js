import fs from "fs";
import path from "path";
import xlsx from "xlsx";

const INPUT = path.resolve("input", "MAD.xlsx");
const OUTPUT = path.resolve("output", "kits-hv.json");

// Config (kan je later naar config.json trekken)
const MINUTE_RATE = 1.25;
const VAT_RATE = 0.21;
const FAMILY_CODE = "HV";
const FAMILY_LABEL = "Hulpveren";
const DEFAULT_POSITION = "rear"; // HV is vrijwel altijd achter

function fmtMonthYear(v) {
  if (v === null || v === undefined || v === "") return "";
  if (v instanceof Date && !isNaN(v)) {
    const mm = String(v.getMonth() + 1).padStart(2, "0");
    const yyyy = v.getFullYear();
    return `${mm}-${yyyy}`;
  }
  const s = String(v).trim();
  // Als het al "MM-YYYY" is, laten we 'm met rust
  if (/^\d{2}-\d{4}$/.test(s)) return s;
  return s; // fallback
}

function normalizeMake(make) {
  if (!make) return "";
  return String(make).trim().toUpperCase().replace(/\s+/g, "-");
}

function splitEngines(engineRaw) {
  if (!engineRaw) return null;
  const s = String(engineRaw).trim();
  if (!s || /^all$/i.test(s) || /^alle$/i.test(s)) return null;

  const parts = s.split(/[,/;]| and | en /i).map(p => p.trim()).filter(Boolean);

  const mapping = [
    { key: /petrol|benzine|gasoline/i, val: "Benzine" },
    { key: /diesel/i, val: "Diesel" },
    { key: /hybrid|plug-?in/i, val: "Hybrid" },
    { key: /lpg/i, val: "LPG" },
    { key: /electric|ev/i, val: "Electric" }
  ];

  const out = [];
  for (const p of parts) {
    let val = null;
    for (const m of mapping) {
      if (m.key.test(p)) { val = m.val; break; }
    }
    if (!val) val = p;
    if (!out.includes(val)) out.push(val);
  }
  return out.length ? out : null;
}

function platformCodes(typeRaw) {
  if (!typeRaw) return [];
  const s = String(typeRaw).trim();
  if (!s || /^all$/i.test(s)) return [];
  return s.split(/[,\s/]+/).map(x => x.trim()).filter(Boolean);
}

function inferPosition(remarks = "") {
  const r = String(remarks).toLowerCase();
  if (r.includes("front") || r.includes("voor")) return "front";
  if (r.includes("rear") || r.includes("achter")) return "rear";
  return DEFAULT_POSITION;
}

// 1) lees excel
const wb = xlsx.readFile(INPUT, { cellDates: true });
const sheetName = wb.SheetNames[0];
const sheet = wb.Sheets[sheetName];

// raw:false geeft vaak mooiere strings
const rows = xlsx.utils.sheet_to_json(sheet, { defval: "", raw: false });

// 2) filter HV
const hvRows = rows.filter(r =>
  String(r["Kind of kit"] || "").toLowerCase().includes("auxiliary coil spring")
);

// 3) group by Kit number
const bySku = new Map();
for (const r of hvRows) {
  const sku = String(r["Kit number"]).trim();
  if (!sku) continue;
  if (!bySku.has(sku)) bySku.set(sku, []);
  bySku.get(sku).push(r);
}

// 4) build kits array
const kits = [];
for (const [sku, grp] of bySku.entries()) {
  const r0 = grp[0];

  const parts = Number(r0["Sales price"] || 0);
  const timeMin = Number(r0["Time"] || 0);
  const labor = Math.round(timeMin * MINUTE_RATE * 100) / 100;
  const totalInc = Math.round((parts + labor) * (1 + VAT_RATE));

  const enginesAllowed = splitEngines(r0["Engine"]);
  const approval = String(r0["Approval"] || "").trim();
  const eanRaw = r0["EAN code"];
  const ean = eanRaw ? String(eanRaw).replace(/\.0$/, "") : undefined;

  const fitments = grp.map(r => {
    const enginesRow = splitEngines(r["Engine"]);
    return {
      make: normalizeMake(r["Make"]),
      model: String(r["Model"] || "").trim(),
      platform_codes: platformCodes(r["Type"]),
      remark: String(r["Remarks"] || "").trim(),
      year_from: fmtMonthYear(r["Year start"]),
      year_to: fmtMonthYear(r["Year end"]),
      notes: enginesRow ? ("Engine: " + enginesRow.join(", ")) : ""
    };
  });

  const kit = {
    sku,
    family_code: FAMILY_CODE,
    family_label: FAMILY_LABEL,
    position: inferPosition(r0["Remarks"]),
    approval,
    powertrains_allowed: enginesAllowed,
    drivetrain_allowed: null,
    rear_wheels_allowed: null,
    fitments,
    pricing_nl: {
      parts_ex_vat_eur: parts,
      minute_rate_eur: MINUTE_RATE,
      vat_rate: VAT_RATE,
      mode: "add",
      labor_ex_vat_min_eur: labor,
      labor_ex_vat_max_eur: labor,
      total_inc_vat_from_eur: totalInc
    }
  };

  if (ean) kit.ean = ean;

  kits.push(kit);
}

// 5) write output
fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, JSON.stringify({ kits }, null, 2), "utf8");

console.log(`? Klaar: ${kits.length} HV-kits naar ${OUTPUT}`);
