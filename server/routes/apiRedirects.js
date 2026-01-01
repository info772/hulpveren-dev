const express = require("express");
const { listRedirects } = require("../services/redirectService");

module.exports = (db) => {
  const router = express.Router();

  router.get("/", (req, res, next) => {
    try {
      const items = listRedirects(db, { enabledOnly: true });
      res.json({ items });
    } catch (err) {
      next(err);
    }
  });

  return router;
};
