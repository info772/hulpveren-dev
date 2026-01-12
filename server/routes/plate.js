const express = require("express");
const TtlCache = require("../cache/ttlCache");
const { getTypesByLicenseplateNL, UpstreamError } = require("../services/proxyClient");
const { lookupRdwVehicle } = require("../services/rdwClient");
const { normalizePlate, isValidPlate, maskPlate, hashPlate } = require("../utils/plate");

const router = express.Router();
const PLATE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new TtlCache({ defaultTtlMs: PLATE_CACHE_TTL_MS });
const includeRaw = /^(1|true|yes)$/i.test(process.env.PLATE_INCLUDE_RAW || "");
const DEBUG_PLATE = /^(1|true|yes)$/i.test(process.env.DEBUG_PLATE || "");
const ENRICH_RDW = /^(1|true|yes)$/i.test(process.env.PLATE_ENRICH_RDW || "1");
const RDW_MERGE_KEYS = [
  "vehicleType",
  "bodyType",
  "firstColor",
  "secondColor",
  "seatCount",
  "cylinders",
  "engineContents",
  "weightEmpty",
  "maxWeight",
  "apkExpiryDate",
  "titleDate",
  "firstRegistrationDate",
  "year",
];

function mergeRdwVehicle(candidate, rdwVehicle) {
  if (!candidate || !rdwVehicle) return candidate;
  const merged = { ...candidate };
  RDW_MERGE_KEYS.forEach((key) => {
    const value = rdwVehicle[key];
    if (value === undefined || value === null || value === "") return;
    const current = merged[key];
    if (current === undefined || current === null || current === "") {
      merged[key] = value;
    }
  });
  return merged;
}

router.get("/:plate", async (req, res, next) => {
  const normalized = normalizePlate(req.params.plate);
  if (!isValidPlate(normalized)) {
    res.status(400).json({ error: "invalid_plate" });
    return;
  }

  res.locals.plateMask = maskPlate(normalized);
  res.locals.plateHash = hashPlate(normalized);

  const cached = cache.get(normalized);
  if (cached) {
    if (DEBUG_PLATE) {
      console.log("[plate]", {
        path: req.originalUrl,
        plate: normalized,
        candidates:
          cached?.vehicleCandidates?.length || (cached?.vehicle ? 1 : 0),
        source: cached?.source || "cache",
        cached: true,
      });
    }
    res.json(cached);
    return;
  }

  try {
    const result = await getTypesByLicenseplateNL(normalized);
    res.locals.upstreamMs = result.upstreamMs;
    if (DEBUG_PLATE) {
      console.log("[plate]", {
        path: req.originalUrl,
        plate: normalized,
        upstreamMs: result.upstreamMs,
        message: result.message || null,
        error: result.error || null,
        raw: result.raw ? result.raw.slice(0, 300) : null,
      });
    }

    if (result.error) {
      if (result.error === "licenseplate_not_found") {
        let rdwResult;
        try {
          rdwResult = await lookupRdwVehicle(normalized);
        } catch (err) {
          if (DEBUG_PLATE) {
            console.log("[plate][rdw]", {
              path: req.originalUrl,
              plate: normalized,
              upstreamMs: err.upstreamMs || null,
              error: err.code || err.name || "rdw_error",
              message: err.message || null,
            });
          }
          res.status(502).json({
            error: "upstream_error",
            plate: normalized,
            source: "rdw",
          });
          return;
        }

        if (rdwResult && rdwResult.vehicle) {
          const payload = {
            plate: normalized,
            source: "rdw",
            confidence: "basic",
            vehicle: rdwResult.vehicle,
          };
          cache.set(normalized, payload);
          res.json(payload);
          return;
        }

        res.status(404).json({
          error: "licenseplate_not_found",
          plate: normalized,
          source: "proxyv7",
        });
        return;
      }

      res.status(502).json({
        error: "upstream_error",
        plate: normalized,
        source: "proxyv7",
      });
      return;
    }

    let rdwVehicle = null;
    if (ENRICH_RDW) {
      try {
        const rdwResult = await lookupRdwVehicle(normalized);
        rdwVehicle = rdwResult && rdwResult.vehicle ? rdwResult.vehicle : null;
      } catch (err) {
        if (DEBUG_PLATE) {
          console.log("[plate][rdw]", {
            path: req.originalUrl,
            plate: normalized,
            upstreamMs: err.upstreamMs || null,
            error: err.code || err.name || "rdw_error",
            message: err.message || null,
          });
        }
      }
    }

    const candidates = rdwVehicle
      ? result.candidates.map((candidate) => mergeRdwVehicle(candidate, rdwVehicle))
      : result.candidates;
    const payload = {
      plate: normalized,
      vehicleCandidates: candidates,
      source: "proxyv7",
    };
    if (includeRaw) {
      payload.raw = result.raw;
    }
    if (DEBUG_PLATE) {
      console.log("[plate]", {
        path: req.originalUrl,
        plate: normalized,
        candidates: payload.vehicleCandidates.length,
        cached: false,
      });
    }
    cache.set(normalized, payload);
    res.json(payload);
  } catch (err) {
    res.locals.upstreamMs = err.upstreamMs || null;
    if (DEBUG_PLATE) {
      console.log("[plate]", {
        path: req.originalUrl,
        plate: normalized,
        upstreamMs: res.locals.upstreamMs,
        error: err.code || err.name || "error",
        message: err.message || null,
      });
    }
    if (err instanceof UpstreamError || err.code?.startsWith("UPSTREAM")) {
      res.status(502).json({
        error: "upstream_error",
        plate: normalized,
        source: "proxyv7",
      });
      return;
    }
    next(err);
  }
});

module.exports = router;
