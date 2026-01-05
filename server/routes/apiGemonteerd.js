const express = require("express");
const { requireAdmin } = require("../middleware/requireAdmin");
const { listGemonteerdImages } = require("../services/gemonteerdService");

module.exports = () => {
  const router = express.Router();
  router.use(requireAdmin);

  router.get("/", (req, res, next) => {
    try {
      const items = listGemonteerdImages();
      res.json({ items });
    } catch (err) {
      next(err);
    }
  });

  return router;
};
