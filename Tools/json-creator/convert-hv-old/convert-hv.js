import fs from "fs";
import path from "path";
import xlsx from "xlsx";

const INPUT = path.resolve("input", "MAD.xlsx");
const OUTPUT_DIR = path.resolve("output"); // evt. aanpassen naar wwwroot/data

// prijzen-config
const MINUTE_RATE = 1.25;
const VAT_RATE = 0.21;

// ─────────────────────────────────────────────
// NL woordenlijsten
// ─────────────────────────────────────────────

const KIND_OF_KIT_NL = {
  "Auxiliary coil spring": "Hulpveren",
  "Auxiliary Coil Spring": "Hulpveren",
  "Reinforced coil spring": "Versterkte veren",
  "Reinforced Coil Spring": "Versterkte veren",
  "Lift springs kit": "Verhogingsset veren",
  "Lowering Springs": "Verlagingsveren",
  "Special Duty coil spring": "Special Duty veer",
};

const APPROVAL_NL = {
  TUV: "TÜV",
  ABE: "ABE",
  EC: "EC",
  ECE: "ECE",
  No: "-",
};

const REMARK_REPLACE = [
  { from: "Only L1", to: "Alleen L1" },
  { from: "Rear springs only", to: "Alleen achterveren" },
  { from: "Maximum rear axle load", to: "Maximale achteraslast" },
  { from: "Cylindrical front springs", to: "Cilindrische voorveren" },
  { from: "Conical front springs", to: "Conische voorveren" },
  { from: "Sportwagon", to: "Sportwagon" }, // spelling normalisatie
];

// ─────────────────────────────────────────────
// Helpers algemeen
// ─────────────────────────────────────────────

function fmtMonthYear(v) {
  if (v === null || v === undefined || v === "") return "";
  if (v instanceof Date && !isNaN(v)) {
    const mm = String(v.getMonth() + 1).padStart(2, "0");
    const yyyy = v.getFullYear();
    return `${mm}-${yyyy}`;
  }
  const s = String(v).trim();
  if (/^\d{2}-\d{4}$/.test(s)) return s;
  return s;
}

function normalizeMake(make) {
  if (!make) return "";
  return String(make).trim().toUpperCase().replace(/\s+/g, "-");
}

function splitEngines(engineRaw) {
  if (!engineRaw) return null;
  const s = String(engineRaw).trim();
  if (!s || /^all$/i.test(s) || /^alle$/i.test(s)) return null;

  const parts = s
    .split(/[,/;]| and | en /i)
    .map((p) => p.trim())
    .filter(Boolean);

  const mapping = [
    { key: /petrol|benzine|gasoline/i, val: "Benzine" },
    { key: /diesel/i, val: "Diesel" },
    { key: /hybrid|plug-?in/i, val: "Hybrid" },
    { key: /lpg/i, val: "LPG" },
    { key: /electric|ev/i, val: "Electric" },
  ];

  const out = [];
  for (const p of parts) {
    let val = null;
    for (const m of mapping) {
      if (m.key.test(p)) {
        val = m.val;
        break;
      }
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
  return s
    .split(/[,\s/]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function inferPositionFromRemark(remarks = "") {
  const r = String(remarks).toLowerCase();
  if (r.includes("front") || r.includes("voor")) return "front";
  if (r.includes("rear") || r.includes("achter")) return "rear";
  return "rear";
}

// Alleen voor HV/SD
function inferPositionSmart(kindOfKit, fitments, remark0) {
  const kind = String(kindOfKit || "").toLowerCase();

  // Lift springs kit -> beide assen
  if (kind === "lift springs kit" || kind.includes("lift springs kit")) {
    return ["front", "rear"];
  }

  // Iets met "Reinforced Front Springs" in de fitments
  const hasFrontRemark = (fitments || []).some((f) =>
    /reinforced front springs/i.test(String(f.remark || ""))
  );
  if (hasFrontRemark) return "front";

  // fallback
  return inferPositionFromRemark(remark0);
}

// ─────────────────────────────────────────────
// Helpers brandstof
// ─────────────────────────────────────────────

function getYearFromMmYyyy(v) {
  if (!v) return null;
  const s = String(v);
  const m = s.match(/\d{2}-(\d{4})/);
  return m ? parseInt(m[1], 10) : null;
}

const EV_MODEL_RULES = [
  // Volkswagen
  { make: /VOLKSWAGEN|VW/, model: /^ID[.\s-]?\d/ },
  { make: /VOLKSWAGEN|VW/, model: /E-GOLF|E UP|E-UP/ },

  // Audi
  { make: /AUDI/, model: /E-TRON/ },

  // Mercedes EQ
  { make: /MERCEDES/, model: /^EQ[A-Z]/ },

  // Hyundai
  { make: /HYUNDAI/, model: /IONIQ\s*5|IONIQ\s*6/ },
  { make: /HYUNDAI/, model: /KONA.*ELECTRIC|KONA\s*EV/ },

  // Kia
  { make: /KIA/, model: /EV6|EV9/ },
  { make: /KIA/, model: /NIRO\s*(EV|E)|E-NIRO/ },
  { make: /KIA/, model: /SOUL\s*(EV|E)|E-SOUL/ },

  // Renault
  { make: /RENAULT/, model: /ZOE/ },
  { make: /RENAULT/, model: /MEGANE.*E-TECH.*ELECTRIC/ },
  { make: /RENAULT/, model: /TWINGO.*ELECTRIC/ },

  // Peugeot
  { make: /PEUGEOT/, model: /E-208|E 208/ },
  { make: /PEUGEOT/, model: /E-2008|E 2008/ },
  { make: /PEUGEOT/, model: /E-PARTNER|E-EXPERT|E-BOXER/ },

  // Opel / Vauxhall
  { make: /OPEL|VAUXHALL/, model: /CORSA.*(ELECTRIC|E\b)/ },
  { make: /OPEL|VAUXHALL/, model: /MOKKA.*(ELECTRIC|E\b)/ },
  { make: /OPEL|VAUXHALL/, model: /VIVARO-E|COMBO-E|ZAFIRA-E/ },

  // Citroën
  { make: /CITROEN|CITROËN/, model: /Ë-?C4|E-?C4/ },
  { make: /CITROEN|CITROËN/, model: /Ë-?BERLINGO|E-?BERLINGO/ },
  { make: /CITROEN|CITROËN/, model: /Ë-?JUMPY|E-?JUMPY|Ë-?SPACETOURER|E-?SPACETOURER/ },

  // Nissan
  { make: /NISSAN/, model: /LEAF/ },
  { make: /NISSAN/, model: /ARIYA/ },

  // BMW
  { make: /BMW/, model: /^I3\b|^I4\b|^IX3\b|^IX\b|^I5\b|^I7\b/ },

  // Tesla
  { make: /TESLA/, model: /MODEL\s*[3SYX]/ },
];

function isEvModelFromName(makeRaw, modelRaw) {
  const make = String(makeRaw || "").toUpperCase();
  const model = String(modelRaw || "").toUpperCase();

  for (const rule of EV_MODEL_RULES) {
    if (rule.make.test(make) && rule.model.test(model)) {
      return true;
    }
  }
  return false;
}

function inferPowertrainsAllowed(grp, fitments) {
  // 1) expliciete Engine-waarden via splitEngines
  const allEngineVals = [];
  const rawEngineStrings = [];

  for (const r of grp) {
    const raw = String(r["Engine"] || "").trim();
    if (raw) rawEngineStrings.push(raw);

    const e = splitEngines(r["Engine"]);
    if (e && e.length) {
      for (const val of e) {
        if (!allEngineVals.includes(val)) allEngineVals.push(val);
      }
    }
  }

  let out = [...allEngineVals];

  // 2) ALL / leeg checken
  const isAllOnly =
    rawEngineStrings.length > 0 &&
    rawEngineStrings.every((s) => /^all$/i.test(s));
  const isEmptyAll = rawEngineStrings.length === 0;
  const isAllLike = isAllOnly || isEmptyAll;

  // 3) oudste bouwjaar van de fitments bepalen
  let minYear = null;
  for (const f of fitments || []) {
    const y = getYearFromMmYyyy(f.year_from);
    if (y && (minYear === null || y < minYear)) {
      minYear = y;
    }
  }

  // 4) Bij ALL/leeg + geen expliciete engines -> jaartallen-heuristiek
  if (!out.length && isAllLike && minYear) {
    if (minYear < 2010) {
      out = ["Benzine", "Diesel", "LPG"];
    } else if (minYear < 2020) {
      out = ["Benzine", "Diesel", "Hybrid", "LPG"];
    } else {
      out = ["Benzine", "Diesel", "Hybrid", "LPG"];
    }
  }

  // 5) EV-model-detectie: bij ALL-like en twijfel -> alléén elektrisch model
  if (isAllLike && (!out.length || !out.includes("Electric"))) {
    const r0 = grp[0] || {};
    const makeRaw = r0["Make"] || (fitments && fitments[0]?.make);
    const modelRaw = r0["Model"] || (fitments && fitments[0]?.model);

    if (isEvModelFromName(makeRaw, modelRaw)) {
      out = ["Electric"];
    }
  }

  // 6) Extra logica op basis van remarks/notes (Incl./Excl. Electric/Hybrid)
  const textBlob = [
    ...(fitments || []).map((f) => f.remark || ""),
    ...(fitments || []).map((f) => f.notes || ""),
  ]
    .join(" ")
    .toLowerCase();

  // Electric expliciet
  if (
    /(\b|_)electric(\b|_)/i.test(textBlob) ||
    /incl\.\s*electric|electric incl\./i.test(textBlob)
  ) {
    if (!out.includes("Electric")) out.push("Electric");
  }
  if (/excl\.\s*electric|electric excl\./i.test(textBlob)) {
    out = out.filter((x) => x !== "Electric");
  }

  // Hybrid expliciet
  if (/hybrid/i.test(textBlob)) {
    if (!out.includes("Hybrid")) out.push("Hybrid");
  }

  return out.length ? out : null;
}

// ─────────────────────────────────────────────
// Helpers vertaling / remark
// ─────────────────────────────────────────────

function translateKindOfKit(kind) {
  if (!kind) return "";
  const raw = String(kind).trim();
  const found = KIND_OF_KIT_NL[raw];
  return found || raw;
}

function translateApproval(approval) {
  if (!approval) return "";
  const raw = String(approval).trim();
  const found = APPROVAL_NL[raw];
  return found || raw;
}

function normalizeRemark(remarkRaw) {
  if (!remarkRaw) return "";
  let s = String(remarkRaw).trim();

  REMARK_REPLACE.forEach((r) => {
    s = s.replace(r.from, r.to);
  });

  return s;
}

// ─────────────────────────────────────────────
// Generieke builder
// ─────────────────────────────────────────────

function buildKits(rowsFiltered, { familyLabel, useSmartPosition }) {
  const bySku = new Map();
  for (const r of rowsFiltered) {
    const sku = String(r["Kit number"]).trim();
    if (!sku) continue;
    if (!bySku.has(sku)) bySku.set(sku, []);
    bySku.get(sku).push(r);
  }

  const kits = [];

  for (const [sku, grp] of bySku.entries()) {
    const r0 = grp[0];

    const parts = Number(r0["Sales price"] || 0);
    const timeMin = Number(r0["Time"] || 0);
    const labor = Math.round(timeMin * MINUTE_RATE * 100) / 100;
    const totalInc = Math.round((parts + labor) * (1 + VAT_RATE));

    const approvalRaw = String(r0["Approval"] || "").trim();
    const approvalNl = translateApproval(approvalRaw);

    const eanRaw = r0["EAN code"];
    const ean = eanRaw ? String(eanRaw).replace(/\.0$/, "") : undefined;

    const kindOfKitRaw = String(r0["Kind of kit"] || "").trim();
    const kindOfKitNl = translateKindOfKit(kindOfKitRaw);

    const fitments = grp.map((r) => {
      const enginesRow = splitEngines(r["Engine"]);
      const remarkRaw = String(r["Remarks"] || "").trim();
      return {
        make: normalizeMake(r["Make"]),
        model: String(r["Model"] || "").trim(),
        platform_codes: platformCodes(r["Type"]),
        remark: normalizeRemark(remarkRaw),
        year_from: fmtMonthYear(r["Year start"] || r["Year Start"]),
        year_to: fmtMonthYear(r["Year end"] || r["Year End"]),
        notes: enginesRow ? "Engine: " + enginesRow.join(", ") : "",
      };
    });

    // family_code uit sku prefix
    const skuUp = sku.toUpperCase();
    let family_code = "OTHER";
    if (skuUp.startsWith("HV-")) family_code = "HV";
    else if (skuUp.startsWith("SD-")) family_code = "SD";
    else if (skuUp.startsWith("NR-")) family_code = "NR";
    else if (skuUp.startsWith("LS-")) family_code = "LS";

    const position = useSmartPosition
      ? inferPositionSmart(kindOfKitRaw, fitments, r0["Remarks"])
      : inferPositionFromRemark(r0["Remarks"]);

    const enginesAllowed = inferPowertrainsAllowed(grp, fitments);

    const dims = String(r0["Dimensions"] || "").trim();
    const weight = String(r0["Weight"] || "").trim();

    const pics = [];
    const p1 = String(r0["Picture 1"] || "").trim();
    const p2 = String(r0["Picture 2"] || "").trim();
    if (p1) pics.push(p1);
    if (p2 && p2 !== p1) pics.push(p2);

    const kit = {
      sku,
      family_code,
      family_label: familyLabel,
      kind_of_kit: kindOfKitRaw,
      kind_of_kit_nl: kindOfKitNl,
      position,
      approval: approvalRaw,
      approval_nl: approvalNl,
      powertrains_allowed: enginesAllowed,
      drivetrain_allowed: null,
      rear_wheels_allowed: null,
      images: pics.length ? pics : undefined,
      dimensions: dims || undefined,
      weight: weight || undefined,
      fitments,
      pricing_nl: {
        parts_ex_vat_eur: parts,
        minute_rate_eur: MINUTE_RATE,
        vat_rate: VAT_RATE,
        mode: "add",
        labor_ex_vat_min_eur: labor,
        labor_ex_vat_max_eur: labor,
        total_inc_vat_from_eur: totalInc,
      },
    };

    if (ean) kit.ean = ean;

    kits.push(kit);
  }

  return kits;
}

// ─────────────────────────────────────────────
// main
// ─────────────────────────────────────────────

const wb = xlsx.readFile(INPUT, { cellDates: true });
const sheetName = wb.SheetNames[0];
const sheet = wb.Sheets[sheetName];
const rows = xlsx.utils.sheet_to_json(sheet, { defval: "", raw: false });

// HV + SD (hulpveren + Special Duty)
const hvRows = rows.filter((r) => {
  const sku = String(r["Kit number"] || "").trim().toUpperCase();
  return sku.startsWith("HV-") || sku.startsWith("SD-");
});
const hvKits = buildKits(hvRows, {
  familyLabel: "Hulpveren",
  useSmartPosition: true,
});

// NR (luchtvering)
const nrRows = rows.filter((r) => {
  const sku = String(r["Kit number"] || "").trim().toUpperCase();
  return sku.startsWith("NR-");
});
const nrKits = buildKits(nrRows, {
  familyLabel: "Luchtvering",
  useSmartPosition: false,
});

// LS (verlagingsveren)
const lsRows = rows.filter((r) => {
  const sku = String(r["Kit number"] || "").trim().toUpperCase();
  return sku.startsWith("LS-");
});
const lsKits = buildKits(lsRows, {
  familyLabel: "Verlagingsveren",
  useSmartPosition: false,
});

// schrijven
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

fs.writeFileSync(
  path.join(OUTPUT_DIR, "hv-kits.json"),
  JSON.stringify({ kits: hvKits }, null, 2),
  "utf8"
);
fs.writeFileSync(
  path.join(OUTPUT_DIR, "nr-kits.json"),
  JSON.stringify({ kits: nrKits }, null, 2),
  "utf8"
);
fs.writeFileSync(
  path.join(OUTPUT_DIR, "ls-kits.json"),
  JSON.stringify({ kits: lsKits }, null, 2),
  "utf8"
);

console.log(
  `✅ Klaar: ${hvKits.length} HV/SD-kits, ${nrKits.length} NR-kits, ${lsKits.length} LS-kits naar ${OUTPUT_DIR}`
);
