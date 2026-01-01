const express = require("express");
const crypto = require("crypto");
const { getSettings } = require("../services/settingsService");

module.exports = (db) => {
  const router = express.Router();

  router.get("/", (req, res, next) => {
    try {
      const settings = getSettings(db);
      const payload = {
        settings,
        updatedAt: settings?.meta?.updatedAt || null,
      };
      const etag = crypto.createHash("sha1").update(JSON.stringify(settings)).digest("hex");
      if (req.headers["if-none-match"] === etag) {
        res.status(304).end();
        return;
      }
      res.set("ETag", etag);
      res.set("Cache-Control", "no-cache");
      res.json(payload);
    } catch (err) {
      next(err);
    }
  });

  return router;
};
