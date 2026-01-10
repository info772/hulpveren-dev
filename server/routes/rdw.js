const express = require("express");

const router = express.Router();

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dagen
const cache = new Map(); // plate -> { expiresAt, payload }

// RDW dataset: Gekentekende_voertuigen
// kenteken param = zonder streepjes, uppercase
const RDW_URL = "https://opendata.rdw.nl/resource/m9d7-ebf2.json";

function normalizePlate(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function getCached(plate) {
  const hit = cache.get(plate);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    cache.delete(plate);
    return null;
  }
  return hit.payload;
}

function setCached(plate, payload) {
  cache.set(plate, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
}

async function fetchJsonWithTimeout(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      const err = new Error(`rdw_http_${res.status}`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  } finally {
    clearTimeout(t);
  }
}

router.get("/:plate", async (req, res) => {
  const plate = normalizePlate(req.params.plate);

  if (!plate || plate.length < 6) {
    return res.status(400).json({ error: "invalid_plate" });
  }

  const cached = getCached(plate);
  if (cached) {
    res.set("Cache-Control", "public, max-age=3600"); // client mag 1 uur cachen
    return res.json(cached);
  }

  try {
    const url = `${RDW_URL}?kenteken=${encodeURIComponent(plate)}`;
    const data = await fetchJsonWithTimeout(url, 8000);

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(404).json({ error: "not_found" });
    }

    const row = data[0];

    // RDW veldnaam: datum_eerste_toelating (YYYYMMDD)
    const ymd = String(row.datum_eerste_toelating || "");
    const year = ymd && ymd.length >= 4 ? Number(ymd.slice(0, 4)) : 0;

    if (!year || Number.isNaN(year)) {
      return res.status(422).json({ error: "no_year" });
    }

    const firstAdmissionDate =
      ymd.length === 8
        ? `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`
        : null;

    const payload = { year, firstAdmissionDate };

    setCached(plate, payload);

    res.set("Cache-Control", "public, max-age=3600");
    return res.json(payload);
  } catch (e) {
    const status = e && e.name === "AbortError" ? 504 : 502;
    return res.status(status).json({ error: "rdw_failed" });
  }
});

module.exports = router;
