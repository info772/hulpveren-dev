const fetch = require("node-fetch");

const RDW_BASE_URL = (process.env.RDW_BASE_URL || "https://opendata.rdw.nl/resource/m9d7-ebf2.json").replace(
  /\/+$/,
  ""
);
const DEFAULT_TIMEOUT_MS = Number.parseInt(process.env.RDW_TIMEOUT_MS || "8000", 10);

async function fetchWithTimeout(url, options, timeoutMs, retries) {
  let attempt = 0;
  while (true) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      return res;
    } catch (err) {
      clearTimeout(timeoutId);
      attempt += 1;
      if (attempt > retries) throw err;
    }
  }
}

function normalizePlate(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function toInt(value) {
  if (value === undefined || value === null || value === "") return null;
  const num = Number.parseInt(String(value).trim(), 10);
  return Number.isFinite(num) ? num : null;
}

function normalizeText(value) {
  const raw = String(value || "").trim();
  return raw ? titleCase(raw) : "";
}

function normalizeColor(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^niet geregistreerd$/i.test(raw)) return "";
  return titleCase(raw);
}

function parseYear(value) {
  const match = String(value || "").match(/\d{4}/);
  if (!match) return null;
  const year = Number.parseInt(match[0], 10);
  return Number.isFinite(year) ? year : null;
}

function normalizeDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }
  if (digits.length >= 6) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}`;
  }
  if (digits.length >= 4) {
    return digits.slice(0, 4);
  }
  return raw;
}

function titleCaseToken(token) {
  if (!token) return "";
  if (/^[A-Z0-9]+$/.test(token) && token.length <= 3) return token;
  const lower = token.toLowerCase();
  return lower ? lower[0].toUpperCase() + lower.slice(1) : "";
}

function titleCase(value) {
  return String(value || "")
    .trim()
    .split(/\s+/)
    .map((word) =>
      word
        .split("-")
        .map((part) => titleCaseToken(part))
        .join("-")
    )
    .join(" ")
    .trim();
}

async function lookupRdwVehicle(plate) {
  const normalized = normalizePlate(plate);
  if (!normalized) {
    return { vehicle: null, raw: null, upstreamMs: 0 };
  }

  const url = new URL(RDW_BASE_URL);
  url.searchParams.set("kenteken", normalized);
  url.searchParams.set("$limit", "1");

  const start = Date.now();
  let res;
  try {
    res = await fetchWithTimeout(
      url.toString(),
      { method: "GET", headers: { Accept: "application/json" } },
      DEFAULT_TIMEOUT_MS,
      1
    );
  } catch (err) {
    err.upstreamMs = Date.now() - start;
    err.code = err.name === "AbortError" ? "RDW_TIMEOUT" : "RDW_NETWORK";
    throw err;
  }

  const text = await res.text();
  const upstreamMs = Date.now() - start;
  if (!res.ok) {
    const err = new Error(`RDW status ${res.status}`);
    err.status = res.status;
    err.upstreamMs = upstreamMs;
    err.code = "RDW_STATUS";
    throw err;
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    err.upstreamMs = upstreamMs;
    err.code = "RDW_BAD_JSON";
    throw err;
  }

  const entry = Array.isArray(data) && data.length ? data[0] : null;
  if (!entry) {
    return { vehicle: null, raw: text, upstreamMs };
  }

  const make = titleCase(entry.merk || "");
  const model = titleCase(entry.handelsbenaming || "");
  const firstRegistrationDate = normalizeDate(entry.datum_eerste_toelating || "");
  const year = parseYear(firstRegistrationDate || "");
  const vehicleType = normalizeText(entry.voertuigsoort || "");
  const bodyType = normalizeText(entry.inrichting || "");
  const firstColor = normalizeColor(entry.eerste_kleur || "");
  const secondColor = normalizeColor(entry.tweede_kleur || "");
  const seatCount = toInt(entry.aantal_zitplaatsen);
  const cylinders = toInt(entry.aantal_cilinders);
  const engineContents = toInt(entry.cilinderinhoud);
  const weightEmpty = toInt(entry.massa_ledig_voertuig);
  const maxWeight = toInt(entry.toegestane_maximum_massa_voertuig);
  const apkExpiryDate = normalizeDate(entry.vervaldatum_apk || "");
  const titleDate = normalizeDate(entry.datum_tenaamstelling || "");
  if (!make || !model || !year) {
    return { vehicle: null, raw: text, upstreamMs };
  }

  return {
    vehicle: {
      make,
      model,
      year,
      firstRegistrationDate,
      plate: normalized,
      vehicleType,
      bodyType,
      firstColor,
      secondColor,
      seatCount,
      cylinders,
      engineContents,
      weightEmpty,
      maxWeight,
      apkExpiryDate,
      titleDate,
    },
    raw: text,
    upstreamMs,
  };
}

module.exports = {
  lookupRdwVehicle,
};
