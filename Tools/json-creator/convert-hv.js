import fs from "fs";
import path from "path";
import xlsx from "xlsx";

const INPUT = path.resolve("input", "mad_catalogue.xlsx");
const OUTPUT_DIR = path.resolve("output"); // evt. aanpassen naar wwwroot/data

// prijzen-config
const MINUTE_RATE = 1.25;
const VAT_RATE = 0.21;
const LS_INC_UPCHARGE = 190; // extra incl. btw voor montage + uitlijning bij verlagingsveren

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
  const stripped = String(make)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
  return stripped.replace(/\s+/g, "-");
}

function splitEngines(engineRaw) {
  if (!engineRaw) return null;
  let s = String(engineRaw).trim();
  if (!s) return null;

  const parts = s
    .split(/[,/;]| and | en /i)
    .map((p) => p.trim())
    .filter(Boolean);

  const mapping = [
  // PHEV / Hybrid
  { key: /e-?tron/i, val: "Hybrid" },
  { key: /e-?hybrid/i, val: "Hybrid" },

  // Vol-elektrisch (incl. e-Movano, e-Crafter, e-Doblo, maar niet e-tron/e-hybrid)
  { key: /electric|ev|bev|\be-(?!tron\b|hybrid\b)/i, val: "Electric" },

  // Hybrides algemeen
  { key: /plug-?in|phev|hybrid|hybride|hev|mhev|mild[- ]hybrid/i, val: "Hybrid" },

  // Diesel – uitgebreid met Multijet, CDTI, CDI, dCi, TDI, etc.
  {
    key: /diesel|dci|tdi|cdti|cdi|multijet|hdi|jtdm|d-4d/i,
    val: "Diesel",
  },

  // Benzine
  { key: /petrol|benzine|gasoline|essence|tsi|mpi|tfsi|t-?gdi/i, val: "Benzine" },

  // LPG
  { key: /lpg|autogas/i, val: "LPG" },
];



  const out = [];
  let hasAllWord = false;

  for (const rawPart of parts) {
    let p = rawPart.trim();
    const lower = p.toLowerCase();

    // "All"/"Alle" → vlag, geen motor-type
    if (lower === "all" || lower === "alle") {
      hasAllWord = true;
      continue;
    }

    // Uitsluitingen ("Excl. ...") niet als motor meenemen
    if (/^(excl|exclusief|niet voor|except|without|zonder)\b/i.test(lower)) {
      continue;
    }

    // "Motor:" / "Engine:" eraf
    p = p.replace(/^(motor|engine)\s*:\s*/i, "").trim();
	p = p.replace(/^(incl\.?|only)\s*/i, "").trim();

    // "Incl." vooraan eraf → "Incl. e-tron" → "e-tron"
    p = p.replace(/^incl\.?\s*/i, "").trim();
    if (!p) continue;

    let val = null;
    for (const m of mapping) {
      if (m.key.test(p)) {
        val = m.val;
        break;
      }
    }

    // Onbekende tokens (Sportback, Limousine, “Allstreet” etc.) negeren
    if (!val) continue;

    if (!out.includes(val)) out.push(val);
  }

  // Alleen "All" → geen beperking
  if (!out.length && hasAllWord) return null;

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
    rawEngineStrings.every((s) => /^all$/i.test(s) || /^alle$/i.test(s));
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

  // 4) merk bepalen (voor Toyota/Lexus uitzondering)
  const r0 = grp[0] || {};
  const makeRaw = r0["Make"] || (fitments && fitments[0]?.make) || "";
  const makeUp = String(makeRaw).toUpperCase();

  // 5) Jaartal-heuristiek alleen als er GEEN expliciete motoren zijn
  if (!out.length && isAllLike && minYear) {
    if (minYear < 2004) {
      out = ["Benzine", "Diesel", "LPG"];
    } else if (minYear <= 2009) {
      if (/TOYOTA|LEXUS/.test(makeUp)) {
        out = ["Benzine", "Diesel", "Hybrid", "LPG"];
      } else {
        out = ["Benzine", "Diesel", "LPG"];
      }
    } else if (minYear <= 2015) {
      out = ["Benzine", "Diesel", "Hybrid", "LPG"];
    } else {
      out = ["Benzine", "Diesel", "Hybrid", "LPG"];
    }
  }

  // 6) EV-model-detectie: bij ALL-like + twijfel → alléén Electric model
  if (isAllLike && (!out.length || !out.includes("Electric"))) {
    const modelRaw = r0["Model"] || (fitments && fitments[0]?.model);
    if (isEvModelFromName(makeRaw, modelRaw)) {
      out = ["Electric"];
    }
  }

  // 7) Extra logica op basis van Engine + remarks/notes
    // 7) Extra logica op basis van Engine + remarks/notes
  const textBlob = [
    ...grp.map((r) => r["Engine"] || ""),
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
  const hasHybridWord = /hybrid/i.test(textBlob);
  if (hasHybridWord && !out.includes("Hybrid")) {
    out.push("Hybrid");
  }

  // "Motor: Incl. Hybrid" of "Motor: Incl. e-tron" → alle verbrandingsmotoren + Hybrid
  const hasInclHybrid =
    /motor\s*:\s*incl\.?\s*hybrid/i.test(textBlob) ||
    /engine\s*:\s*incl\.?\s*hybrid/i.test(textBlob) ||
    /incl\.?\s*hybrid/i.test(textBlob);

  const hasInclEtron =
    /motor\s*:\s*incl\.?\s*e-?tron/i.test(textBlob) ||
    /engine\s*:\s*incl\.?\s*e-?tron/i.test(textBlob) ||
    /incl\.?\s*e-?tron/i.test(textBlob);

  if (hasInclHybrid || hasInclEtron) {
    if (!out.length || (out.length === 1 && out[0] === "Hybrid")) {
      out = ["Benzine", "Diesel", "Hybrid", "LPG"];
    } else {
      if (!out.includes("Hybrid")) out.push("Hybrid");
    }
  }

  // 8) Rommel opruimen: geen "Excl. ..." in de lijst
  out = out.filter(
    (val) =>
      !/^(excl|exclusief|niet voor|except|without|zonder)\b/i.test(
        String(val || "")
      )
  );


  // Speciaal: "Excl. e-Doblo" (en varianten) = geen Electric, rest blijft
  const hasExclEDoblo =
    /excl\.\s*e-?doblo/i.test(textBlob) ||
    /not\s+for\s+e-?doblo/i.test(textBlob) ||
    /without\s+e-?doblo/i.test(textBlob);

  if (hasExclEDoblo) {
    // Electric expliciet NIET toegestaan
    out = out.filter((x) => x !== "Electric");

    // Als er nu niks meer over is, neem klassieke brandstoffen
    if (!out.length) {
      out = ["Benzine", "Diesel", "LPG"];
    }
  }

  // ... textBlob bevat nu Engine + remarks + notes, alles lowercased
  const hasDiesel = out.includes("Diesel");
  const hasBenzine = out.includes("Benzine");

  // Heeft tekst een "1.2 (75hp)" / "1.4 (95 hp)"-achtig patroon?
  const hasPlainHpBlock =
    /\b\d\.\d\b\s*\(\d+\s*hp\)/i.test(textBlob) ||
    /\b\d\.\d\b\s*(?:\d{2,3}\s*ps)/i.test(textBlob);

  // Geen expliciete "CNG/LPG" als enige brandstof (we willen geen fout-positieve)
  const hasAltGas =
    /cng|lpg|g-?tec|bifuel|bivalent|gas\b/i.test(textBlob);

  if (hasDiesel && !hasBenzine && hasPlainHpBlock && !hasAltGas) {
    // we voegen Benzine toe: combinaties zoals
    // "1.4 (95hp) Excl. CNG, 1.3D Multijet"
    out.push("Benzine");
  }


  return out.length ? out : null;
}

// ─────────────────────────────────────────────
// Helpers vertaling / remark
// ─────────────────────────────────────────────

function translateKindOfKit(kind) {
  if (!kind) return "";
  const raw = String(kind).trim();
  const lower = raw.toLowerCase();

  // harde mapping op bekende patronen
  if (lower.includes("auxiliary") && lower.includes("coil")) {
    return "Hulpveren";
  }
  if (lower.includes("reinforced") && lower.includes("coil")) {
    return "Versterkte veren";
  }
  if (lower.includes("lift") && lower.includes("spring")) {
    return "Verhogingsset veren";
  }
  if (lower.includes("lowering") && lower.includes("spring")) {
    return "Verlagingsveren";
  }
  if (lower.includes("special duty")) {
    return "Special Duty veer";
  }

  // fallback: gebruik de originele tekst
  return raw;
}


function translateApproval(approval) {
  if (!approval) return "";
  const raw = String(approval).trim();
  const up = raw.toUpperCase();

  if (up.includes("TUV") || up.includes("TÜV")) return "TÜV";
  if (up.includes("ABE")) return "ABE";
  if (up.includes("ECE") || up.includes("EC")) return "ECE";
  if (up === "NO" || up === "-" || up === "NONE") return "-";

  // fallback: originele waarde laten staan
  return raw;
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

function parseEuroNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v;

  // Alle tekens behalve cijfers, punt, komma en minteken er uit
  const s = String(v)
    .trim()
    .replace(/[^\d,.-]/g, "")
    .replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function roundUpToNine(value) {
  if (value == null) return null;
  const n = Math.ceil(value);          // eerst naar boven afronden op hele euro
  const rest = n % 10;
  return rest === 9 ? n : n + ((9 - rest) % 10);
}



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

    const rawParts = parseEuroNumber(r0["Sales price"]);
	const timeMin = parseEuroNumber(r0["Time"]) || 0;
	const labor = Math.round(timeMin * MINUTE_RATE * 100) / 100;

	let totalInc = null;
if (rawParts !== null && rawParts > 0) {
  const baseTotal = (rawParts + labor) * (1 + VAT_RATE);
  totalInc = roundUpToNine(baseTotal);
}
    const heightDiff = parseHeightDifference(r0["Height difference"] || r0["Height diff"]);




    const approvalRaw = String(r0["Approval"] || "").trim();
    const approvalNl = translateApproval(approvalRaw);

    const eanRaw = r0["EAN code"];
    const ean = eanRaw ? String(eanRaw).replace(/\.0$/, "") : undefined;

    const kindOfKitRaw = String(r0["Kind of kit"] || "").trim();
    const kindOfKitNl = translateKindOfKit(kindOfKitRaw);

    const fitments = grp.map((r) => {
      const enginesRow = splitEngines(r["Engine"]);
      const engineRaw = String(r["Engine"] || "").trim();
      const remarkRaw = String(r["Remarks"] || "").trim();
      return {
        make: normalizeMake(r["Make"]),
        model: String(r["Model"] || "").trim(),
        platform_codes: platformCodes(r["Type"]),
        remark: normalizeRemark(remarkRaw),
        year_from: fmtMonthYear(r["Year start"] || r["Year Start"]),
        year_to: fmtMonthYear(r["Year end"] || r["Year End"]),
        engines: enginesRow && enginesRow.length ? enginesRow : null,
        engine_raw: engineRaw || null,
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

    let position = useSmartPosition
      ? inferPositionSmart(kindOfKitRaw, fitments, r0["Remarks"])
      : inferPositionFromRemark(r0["Remarks"]);

    if (familyLabel === "Verlagingsveren" && heightDiff) {
      const hasFront = Number.isFinite(heightDiff.front);
      const hasRear = Number.isFinite(heightDiff.rear);
      if (hasFront && hasRear) position = "both";
      else if (hasFront) position = "front";
      else if (hasRear) position = "rear";
    }

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
        parts_ex_vat_eur: rawParts,
        minute_rate_eur: MINUTE_RATE,
        vat_rate: VAT_RATE,
        mode: "add",
        labor_ex_vat_min_eur: labor,
        labor_ex_vat_max_eur: labor,
        total_inc_vat_from_eur:
          familyLabel === "Verlagingsveren" && totalInc !== null
            ? totalInc + LS_INC_UPCHARGE
            : totalInc,
      },
    };

    if (familyLabel === "Verlagingsveren" && heightDiff) {
      kit.suspension_delta_mm = {
        front_mm: Number.isFinite(heightDiff.front) ? heightDiff.front : null,
        rear_mm: Number.isFinite(heightDiff.rear) ? heightDiff.rear : null,
      };
    }

    if (ean) kit.ean = ean;

    kits.push(kit);
  }

  return kits;
}

function parseHeightDifference(raw) {
  if (!raw) return null;
  const txt = String(raw).replace(/mm/gi, "").trim();
  if (!txt) return null;
  const parts = txt.split(/[\\/]/).map((p) => p.trim());
  const toNum = (v) => {
    if (!v || v === "-" || v === "_") return null;
    const n = parseFloat(v.replace(/[^0-9.+-]/g, ""));
    return Number.isFinite(n) ? n : null;
  };
  if (parts.length === 1) {
    const n = toNum(parts[0]);
    return n === null ? null : { front: n, rear: n };
  }
  return {
    front: toNum(parts[0]),
    rear: toNum(parts[1]),
  };
}

// ─────────────────────────────────────────────
// main
// ─────────────────────────────────────────────

const wb = xlsx.readFile(INPUT, { cellDates: true });
const sheetName = wb.SheetNames[0];
const sheet = wb.Sheets[sheetName];

// Alles rauw uit de sheet
const rawRows = xlsx.utils.sheet_to_json(sheet, { defval: "", raw: true });

// Proberen een kolom te vinden die 'Last change' heet (of Reason/Reden, voor de toekomst)
const reasonKey =
  rawRows.length > 0
    ? Object.keys(rawRows[0]).find((k) => /last change|reason|reden/i.test(k))
    : null;

// Als er een 'Last change' / Reason-kolom is: verwijderde/out-of-production sets eruit filteren
const rows = reasonKey
  ? rawRows.filter((r) => {
      const reasonRaw = String(r[reasonKey] || "");
      const reason = reasonRaw.toLowerCase();

      if (!reason.trim()) return true; // geen reden = gewoon meenemen

      // alles wat duidelijk op "verwijderd / uit programma" duidt, skippen
      if (reason.includes("out of production")) return false;
      if (reason.includes("deleted")) return false;
      if (reason.includes("remove")) return false;

      return true;
    })
  : rawRows;



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
