function requireAdmin(req, res, next) {
  if (req.session?.adminUser) {
    next();
    return;
  }

  if (req.originalUrl.startsWith("/admin/api")) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  res.redirect("/admin/login");
}

module.exports = {
  requireAdmin,
};
