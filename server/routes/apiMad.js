const express = require("express");
const fs = require("fs");
const path = require("path");
const { storagePaths } = require("../services/storage");
const { buildMadIndex } = require("../services/madService");

module.exports = () => {
  const router = express.Router();

  router.get("/index", (req, res, next) => {
    try {
      const filePath = path.join(storagePaths.generatedRoot, "mad-index.json");
      if (fs.existsSync(filePath)) {
        const payload = fs.readFileSync(filePath, "utf8");
        res.type("json").send(payload);
        return;
      }
      const currentPath = path.join(storagePaths.madRoot, "current.json");
      if (!fs.existsSync(currentPath)) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      const currentPayload = JSON.parse(fs.readFileSync(currentPath, "utf8"));
      const items = currentPayload.items || [];
      const indexPayload = buildMadIndex(items);
      res.json(indexPayload);
    } catch (err) {
      next(err);
    }
  });

  return router;
};
