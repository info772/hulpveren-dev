function requireAdminKey(req, res, next) {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected) {
    res.status(500).json({ error: "admin_key_missing" });
    return;
  }

  const provided = req.get("X-Admin-Key") || "";
  if (provided !== expected) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  next();
}

module.exports = {
  requireAdminKey,
};
