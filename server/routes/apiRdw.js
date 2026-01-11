const express = require("express");
const fetch = require("node-fetch");

const router = express.Router();

function normalizePlate(s) {
  return String(s || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

router.get("/:plate", async (req, res) => {
  try {
    const plate = normalizePlate(req.params.plate);

    if (!plate) {
      return res.status(400).json({ error: "bad_request", message: "missing plate" });
    }

    const url =
      "https://opendata.rdw.nl/resource/m9d7-ebf2.json" +
      `?$limit=1&kenteken=${encodeURIComponent(plate)}`;

    const r = await fetch(url, { headers: { Accept: "application/json" } });

    if (!r.ok) {
      return res.status(502).json({ error: "rdw_upstream_error", status: r.status });
    }

    const arr = await r.json();
    const row = Array.isArray(arr) ? arr[0] : null;

    if (!row) return res.status(404).json({ error: "not_found" });

    const det = String(row.datum_eerste_toelating || "");
    const yearMin = det.length >= 4 ? Number(det.slice(0, 4)) : undefined;
    const yearMax = yearMin ? new Date().getFullYear() : undefined;

    return res.json({ ...row, yearMin, yearMax });
  } catch (e) {
    return res.status(500).json({ error: "server_error", message: e?.message || String(e) });
  }
});

module.exports = router;
