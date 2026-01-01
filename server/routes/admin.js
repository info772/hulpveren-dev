const express = require("express");
const { requireAdmin } = require("../middleware/requireAdmin");
const { heroUpload, madUpload } = require("../services/uploads");
const { verifyLogin } = require("../services/authService");
const { sanitizeSlug, normalizeStatus, toBoolean } = require("../services/validators");
const { listBlogs, getBlogById, createBlog, updateBlog, deleteBlog, buildBlogJson } = require("../services/blogService");
const { handleMadUpload, listImports, setCurrentImport, rebuildMadIndexFromCurrent } = require("../services/madService");
const { getSettings, updateSettings } = require("../services/settingsService");
const { listRedirects, createRedirect, updateRedirect, deleteRedirect, writeRedirectsJson } = require("../services/redirectService");

function setFlash(req, type, message) {
  req.session.flash = { type, message };
}

function getFlash(req) {
  const flash = req.session.flash || null;
  req.session.flash = null;
  return flash;
}

function getHeroPath(file, slug) {
  if (!file) return "";
  const safeSlug = slug || "draft";
  return `/storage/blogs/${safeSlug}/${file.filename}`;
}

module.exports = (db, csrfProtection) => {
  const router = express.Router();

  router.use(csrfProtection);
  router.use((req, res, next) => {
    res.locals.csrfToken = req.csrfToken();
    res.locals.user = req.session.adminUser || null;
    res.locals.flash = getFlash(req);
    next();
  });

  router.get("/login", (req, res) => {
    res.render("login", { title: "Login" });
  });

  router.post("/login", (req, res) => {
    const user = verifyLogin(db, req.body.username, req.body.password);
    if (!user) {
      setFlash(req, "error", "Ongeldige login.");
      res.redirect("/admin/login");
      return;
    }
    req.session.adminUser = user;
    res.redirect("/admin/dashboard");
  });

  router.post("/logout", requireAdmin, (req, res) => {
    req.session.destroy(() => {
      res.redirect("/admin/login");
    });
  });

  router.use(requireAdmin);

  const renderDashboard = (req, res) => {
    const stats = {
      blogCount: db.prepare("SELECT COUNT(*) as count FROM blogs").get().count,
      publishedCount: db.prepare("SELECT COUNT(*) as count FROM blogs WHERE status = 'published'").get().count,
      madCurrent: db.prepare("SELECT createdAt, recordCount FROM mad_imports WHERE isCurrent = 1").get(),
      redirectsCount: db.prepare("SELECT COUNT(*) as count FROM redirects").get().count,
    };
    res.render("dashboard", { title: "Dashboard", stats });
  };

  router.get("/", renderDashboard);
  router.get("/dashboard", renderDashboard);

  router.get("/blogs", (req, res) => {
    const rawStatus = req.query.status ? String(req.query.status) : "";
    const status = ["draft", "published", "archived"].includes(rawStatus) ? rawStatus : "";
    const search = req.query.q ? String(req.query.q).trim() : "";
    const items = listBlogs(db, { status: status || null, search: search || null });
    res.render("blogs/index", { title: "Blogs", items, status, search });
  });

  router.get("/blogs/new", (req, res) => {
    res.render("blogs/form", { title: "Nieuwe blog", blog: {}, isEdit: false, errors: [] });
  });

  router.get("/blogs/:id/edit", (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    const blog = getBlogById(db, id);
    if (!blog) {
      res.status(404).send("Niet gevonden.");
      return;
    }
    res.render("blogs/form", { title: "Blog bewerken", blog, isEdit: true, errors: [] });
  });

  router.post("/blogs", heroUpload.single("heroImage"), (req, res, next) => {
    try {
      const slug = sanitizeSlug(req.body.slug || req.body.title);
      const payload = {
        slug,
        title: req.body.title,
        excerpt: req.body.excerpt,
        content: req.body.content,
        category: req.body.category,
        author: req.body.author,
        date: req.body.date,
        readTime: req.body.readTime,
        status: normalizeStatus(req.body.status),
      };
      if (req.file && slug) {
        payload.heroImagePath = getHeroPath(req.file, slug);
      }
      const result = createBlog(db, payload);
      if (result.errors) {
        res.render("blogs/form", { title: "Nieuwe blog", blog: payload, isEdit: false, errors: result.errors });
        return;
      }
      setFlash(req, "success", "Blog opgeslagen.");
      res.redirect(`/admin/blogs/${result.blog.id}/edit`);
    } catch (err) {
      next(err);
    }
  });

  router.post("/blogs/:id", heroUpload.single("heroImage"), (req, res, next) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      const slug = sanitizeSlug(req.body.slug || req.body.title);
      const payload = {
        slug,
        title: req.body.title,
        excerpt: req.body.excerpt,
        content: req.body.content,
        category: req.body.category,
        author: req.body.author,
        date: req.body.date,
        readTime: req.body.readTime,
        status: normalizeStatus(req.body.status),
      };
      if (req.file && slug) {
        payload.heroImagePath = getHeroPath(req.file, slug);
      }
      const result = updateBlog(db, id, payload);
      if (result.errors) {
        res.render("blogs/form", { title: "Blog bewerken", blog: { id, ...payload }, isEdit: true, errors: result.errors });
        return;
      }
      setFlash(req, "success", "Blog bijgewerkt.");
      res.redirect(`/admin/blogs/${id}/edit`);
    } catch (err) {
      next(err);
    }
  });

  router.post("/blogs/:id/delete", (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    deleteBlog(db, id);
    setFlash(req, "success", "Blog verwijderd.");
    res.redirect("/admin/blogs");
  });

  router.post("/blogs/:id/publish", (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    const result = updateBlog(db, id, { status: "published" });
    if (result.errors) {
      setFlash(req, "error", "Publiceren mislukt.");
    } else {
      setFlash(req, "success", "Blog gepubliceerd.");
    }
    res.redirect("/admin/blogs");
  });

  router.post("/blogs/:id/unpublish", (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    const result = updateBlog(db, id, { status: "draft" });
    if (result.errors) {
      setFlash(req, "error", "Unpublish mislukt.");
    } else {
      setFlash(req, "success", "Blog op draft gezet.");
    }
    res.redirect("/admin/blogs");
  });

  router.post("/blogs/:id/status", (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    const status = normalizeStatus(req.body.status);
    const result = updateBlog(db, id, { status });
    if (result.errors) {
      setFlash(req, "error", "Status update mislukt.");
    } else {
      setFlash(req, "success", "Status bijgewerkt.");
    }
    res.redirect("/admin/blogs");
  });

  router.get("/mad", (req, res) => {
    const imports = listImports(db);
    res.render("mad", { title: "MAD Upload", imports });
  });

  router.post("/mad/upload", madUpload.single("madFile"), (req, res, next) => {
    try {
      if (!req.file) {
        setFlash(req, "error", "Geen bestand gekozen.");
        res.redirect("/admin/mad");
        return;
      }
      handleMadUpload(db, req.file.path, req.file.originalname);
      setFlash(req, "success", "MAD upload opgeslagen.");
      res.redirect("/admin/mad");
    } catch (err) {
      next(err);
    }
  });

  const setCurrentHandler = (req, res, next) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      const result = setCurrentImport(db, id);
      if (result.errors) {
        setFlash(req, "error", "Import niet gevonden.");
      } else {
        setFlash(req, "success", "MAD import als current gezet.");
      }
      res.redirect("/admin/mad");
    } catch (err) {
      next(err);
    }
  };

  router.post("/mad/:id/current", setCurrentHandler);
  router.post("/mad/:id/set-current", setCurrentHandler);

  router.get("/settings", (req, res) => {
    const settings = getSettings(db);
    res.render("settings", { title: "Settings", settings });
  });

  router.post("/settings", (req, res) => {
    const payload = {
      footer: {
        phone: req.body.footer_phone || "",
        whatsapp: req.body.footer_whatsapp || "",
        address: req.body.footer_address || "",
        openingHours: req.body.footer_openingHours || "",
      },
      seo: {
        titleSuffix: req.body.seo_titleSuffix || "",
        defaultOgImage: req.body.seo_defaultOgImage || "",
      },
      features: {
        blogEnabled: toBoolean(req.body.feature_blogEnabled),
        madEnabled: toBoolean(req.body.feature_madEnabled),
      },
    };
    updateSettings(db, payload);
    setFlash(req, "success", "Settings opgeslagen.");
    res.redirect("/admin/settings");
  });

  router.get("/redirects", (req, res) => {
    const redirects = listRedirects(db);
    res.render("redirects/index", { title: "Redirects", redirects });
  });

  router.get("/redirects/new", (req, res) => {
    res.render("redirects/form", {
      title: "Redirect toevoegen",
      redirect: { fromPath: "", toPath: "", code: 301, enabled: 1 },
      isEdit: false,
    });
  });

  router.get("/redirects/:id/edit", (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    const redirect = listRedirects(db).find((item) => item.id === id);
    if (!redirect) {
      res.status(404).send("Niet gevonden.");
      return;
    }
    res.render("redirects/form", { title: "Redirect bewerken", redirect, isEdit: true });
  });

  router.post("/redirects", (req, res) => {
    const result = createRedirect(db, req.body);
    if (result.errors) {
      setFlash(req, "error", "Redirect niet opgeslagen.");
    } else {
      setFlash(req, "success", "Redirect opgeslagen.");
    }
    res.redirect("/admin/redirects");
  });

  router.post("/redirects/:id", (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    const result = updateRedirect(db, id, req.body);
    if (result.errors) {
      setFlash(req, "error", "Redirect niet bijgewerkt.");
    } else {
      setFlash(req, "success", "Redirect bijgewerkt.");
    }
    res.redirect("/admin/redirects");
  });

  router.post("/redirects/:id/delete", (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    deleteRedirect(db, id);
    setFlash(req, "success", "Redirect verwijderd.");
    res.redirect("/admin/redirects");
  });

  router.post("/rebuild", (req, res, next) => {
    try {
      const blogCount = buildBlogJson(db);
      const madCount = rebuildMadIndexFromCurrent();
      const redirectCount = writeRedirectsJson(db);
      setFlash(req, "success", `JSONs rebuilt. Blogs: ${blogCount}, MAD: ${madCount}, Redirects: ${redirectCount}.`);
      res.redirect("/admin/dashboard");
    } catch (err) {
      next(err);
    }
  });

  return router;
};
