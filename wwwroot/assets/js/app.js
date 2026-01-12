// /assets/js/app.js


(() => {
  "use strict";

// === SEO module (optional) ===
let SeoContent = null;
let SeoContentPromise = null;
const SEO_SCRIPT_URL = "/assets/js/seo/seoContent.js";
try {
  SeoContent = require("./seo/seoContent.js");
} catch (e) {
  SeoContent = null;
}
if (SeoContent && typeof window !== "undefined") {
  window.SeoContent = SeoContent;
}

const resolveSeoContent = () => {
  if (SeoContent) return SeoContent;
  if (typeof window === "undefined") return null;
  if (window.SeoContent) {
    SeoContent = window.SeoContent;
    return SeoContent;
  }
  if (window.HVSeo) {
    SeoContent = window.HVSeo;
    window.SeoContent = SeoContent;
    return SeoContent;
  }
  return null;
};

const ensureSeoContent = () => {
  const existing = resolveSeoContent();
  if (existing) return Promise.resolve(existing);
  if (SeoContentPromise) return SeoContentPromise;
  if (typeof document === "undefined") return Promise.resolve(null);
  SeoContentPromise = new Promise((resolve) => {
    const script = document.createElement("script");
    script.defer = true;
    const existingScript = document.querySelector(
      'script[src*="/assets/js/seo/seoContent.js"]'
    );
    script.src = existingScript?.getAttribute("src") || SEO_SCRIPT_URL;
    script.onload = () => resolve(resolveSeoContent());
    script.onerror = () => resolve(null);
    const head = document.head || document.getElementsByTagName("head")[0];
    if (head) head.appendChild(script);
    else document.documentElement.appendChild(script);
  });
  return SeoContentPromise;
};

const shouldAutoLoadSeo = () => {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  const path = location.pathname || "";
  return /\/(hulpveren|luchtvering|verlagingsveren)(\/|$)/i.test(path);
};

const initSeoAutoLoad = () => {
  if (!shouldAutoLoadSeo()) return;
  const run = () => {
    ensureSeoContent();
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    run();
  }
};

initSeoAutoLoad();

const buildSeoInfos = (pairs, ctx, mod) => {
  const list = Array.isArray(pairs) ? pairs : [];
  return list
    .map((pair) => {
      const kit = pair?.k || pair;
      if (!kit) return null;
      const fitment = pair?.f || null;
      const derived =
        typeof mod.getKitDerived === "function" ? mod.getKitDerived(kit) : {};
      const axle =
        typeof mod.getAxleConfig === "function"
          ? mod.getAxleConfig(kit, fitment, ctx)
          : "";
      return {
        sku: kit?.sku || "",
        springApplication: derived?.springApplication || "assist",
        solutionLevel: derived?.solutionLevel || "standard",
        includesFSD: !!derived?.includesFSD,
        axle: axle || "rear",
        kit,
      };
    })
    .filter(Boolean);
};

const insertSeoOnce = (target, html) => {
  if (!target || !html) return;
  if (target.dataset && target.dataset.seoRendered === "1") return;
  target.insertAdjacentHTML("beforeend", html);
  if (target.dataset) target.dataset.seoRendered = "1";
};

const hvSeoRenderBrand = (ctx, target) => {
  const mod = resolveSeoContent();
  if (mod && typeof mod.renderBrand === "function") {
    let html = "";
    try {
      html = mod.renderBrand(ctx);
    } catch (err) {
      html = "";
    }
    if (target) insertSeoOnce(target, html);
    return html || "";
  }
  if (target) {
    ensureSeoContent().then((loaded) => {
      if (!loaded || typeof loaded.renderBrand !== "function") return;
      let html = "";
      try {
        html = loaded.renderBrand(ctx);
      } catch (err) {
        html = "";
      }
      insertSeoOnce(target, html);
    });
  }
  return "";
};

const hvSeoRenderModel = (pairs, ctx, target) => {
  const renderWith = (mod) => {
    if (!mod || typeof mod.renderModel !== "function") return "";
    const infos = buildSeoInfos(pairs, ctx, mod);
    if (!infos.length) return "";
    try {
      return mod.renderModel(infos, ctx) || "";
    } catch (err) {
      return "";
    }
  };
  const mod = resolveSeoContent();
  const html = renderWith(mod);
  if (target) insertSeoOnce(target, html);
  if (!html && target) {
    ensureSeoContent().then((loaded) => {
      const loadedHtml = renderWith(loaded);
      insertSeoOnce(target, loadedHtml);
    });
  }
  return html || "";
};



  /* Fix Summary:
   * Broken: Plate fetch could hang and some plate routes rendered empty after strict filtering.
   * Change: Added timeout/single-flight fetch, filtered-tab fallbacks, and a debug route audit.
   * Test: /kenteken search + /hulpveren/<make>/<model>/kt_<plate>; add ?debug=1 for route audit logs.
   */

	const DATA_URL = "/data/hv-kits.json";
	const HV_BASE = "/hulpveren";
	const NR_BASE = "/luchtvering";
	const LS_BASE = "/verlagingsveren";
	const BASE = HV_BASE; // hv-specifiek, elders wordt CURRENT_BASE gebruikt
	const PRODUCT_LABEL = { hv: "hulpveren", nr: "luchtvering", ls: "verlagingsveren" };

	const pathLower = location.pathname.toLowerCase();
  const IS_SET_PAGE = /^\/hulpveren\/hv-\d{6}\/?$/.test(pathLower);
	const CURRENT_FAMILY = pathLower.startsWith(NR_BASE)
	  ? "nr"
	  : pathLower.startsWith(LS_BASE)
	    ? "ls"
	    : "hv";
	const CURRENT_BASE =
	  CURRENT_FAMILY === "nr" ? NR_BASE : CURRENT_FAMILY === "ls" ? LS_BASE : HV_BASE;
  const PLATE_LANDING_PATH = "/kenteken";
  const PLATE_PREFIX = "kt_";
  const PLATE_API_BASE = (window.HV_PLATE_API_BASE || "/api/plate").replace(
    /\/+$/,
    ""
  );
  const PLATE_CACHE_TTL_MS = 15 * 60 * 1000;
  const PLATE_FETCH_TIMEOUT_MS = 12000;
  const PLATE_FETCH_INFLIGHT = new Map();
  const ALDOC_CODES = {
    brand: 204,
    hv: 1031,
    nr: 5147,
  };
  const CONTACT_PHONE = "tel:+31165856568";
  const WHATSAPP_URL = "https://wa.me/311651320219";
  const MONTAGE_URL = "/montage";
  const MODEL_SLUG_CACHE = new Map();
  const MODEL_INDEX_CACHE = new Map();

  function getPlateContext() {
    const stored = () => {
      try {
        const sess = sessionStorage.getItem("hv_plate_context");
        if (sess) return JSON.parse(sess);
      } catch (_) {}
      try {
        const loc = localStorage.getItem("hv_plate_context");
        if (loc) return JSON.parse(loc);
        const plateOnly = localStorage.getItem("hv_plate");
        if (plateOnly) return { plate: plateOnly, vehicle: {} };
      } catch (_) {}
      return {};
    };
    return (
      (window.HVPlateContext &&
        typeof window.HVPlateContext.getPlateContext === "function" &&
        window.HVPlateContext.getPlateContext()) ||
      window.hv_plate_context ||
      stored() ||
      {}
    );
  }

  function getKtSegment() {
    const ctx = getPlateContext();
    const plate = ctx.plate ? normalizePlateInput(ctx.plate).toLowerCase() : "";
    if (!plate) return "";
    return `${PLATE_PREFIX}${plate}`;
  }

  document.addEventListener("click", (evt) => {
    const a = evt.target.closest("a");
    if (!a) return;
    const href = a.getAttribute("href") || "";
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
      return;
    }
    const ktSeg = getKtSegment();
    if (!ktSeg) return;
    const url = new URL(href, window.location.origin);
    const pathLower = url.pathname.toLowerCase().replace(/\/+$/, "") + "/";
    if (!/^\/(hulpveren|luchtvering|verlagingsveren)\//i.test(pathLower)) return;
    if (pathLower.includes("/kt_")) return;

    const ctx = getPlateContext();
    const type = pathLower.split("/").filter(Boolean)[0] || "";

    // haal bestaande path onderdelen
    const parts = url.pathname.split("/").filter(Boolean);
    const existingMake = parts[1] || "";
    const existingModel = parts[2] || "";

    const makeSlug =
      slugify(
        existingMake ||
          (ctx.route && ctx.route.makeSlug) ||
          (ctx.vehicle && (ctx.vehicle.make || ctx.vehicle.makename)) ||
          ""
      ) || "";
    const modelSlug =
      slugify(
        existingModel ||
          (ctx.route && ctx.route.modelSlug) ||
          (ctx.vehicle && (ctx.vehicle.model || ctx.vehicle.modelLabel || ctx.vehicle.modelname)) ||
          ""
      ) || "";

    let newParts = [type];
    if (makeSlug) newParts.push(makeSlug);
    if (modelSlug) newParts.push(modelSlug);
    newParts.push(ktSeg.toLowerCase());
    const newPath = "/" + newParts.filter(Boolean).join("/") + "/";

    url.pathname = newPath;
    evt.preventDefault();
    window.location.href = url.toString();
  });

  if (IS_SET_PAGE) {
    document.documentElement.classList.add("is-set-page");
  }



  // Legacy anchors (#HV-...) naar nieuwe SKU-URL omleiden
  (function redirectHashToSku() {
    const hash = (() => {
  const h = (location.hash || "").replace(/^#/, "");
  return /^HV-\d+/i.test(h) ? h : "";
})();

    if (/^(HV|SD|NR)-/i.test(hash) && /^\/hulpveren\/[^/]+\/[^/]+/i.test(location.pathname)) {
    const target = `${HV_BASE}/${hash.toLowerCase()}/`;
      location.replace(target);
    }
  })();

  const DEBUG =
    String(window.HV_DEBUG || "").toLowerCase() === "1" ||
    new URLSearchParams(location.search).get("debug") === "1";

  const debugLog = (...args) => {
    if (!DEBUG || !window.console || typeof window.console.log !== "function") return;
    window.console.log("[hv-debug]", ...args);
  };

  const ROUTE_AUDIT_URLS = [
    "/",
    "/hulpveren/",
    "/luchtvering/",
    "/verlagingsveren/",
    "/blog/",
    "/hulpveren/audi/a4/",
    "/luchtvering/audi/a4/",
    "/verlagingsveren/audi/a4/",
  ];

  const runRouteAudit = async () => {
    if (!DEBUG || !window.fetch || !window.DOMParser) return;
    const origin = window.location.origin;
    const resolved = (value, base) => {
      try {
        return new URL(value, base).toString();
      } catch {
        return "";
      }
    };
    const isSameOrigin = (value) => {
      try {
        return new URL(value).origin === origin;
      } catch {
        return false;
      }
    };
    const collectAssets = (doc, baseUrl) => {
      const urls = new Set();
      doc.querySelectorAll('link[rel="stylesheet"][href]').forEach((el) => {
        const href = resolved(el.getAttribute("href") || "", baseUrl);
        if (href) urls.add(href);
      });
      doc.querySelectorAll("script[src]").forEach((el) => {
        const src = resolved(el.getAttribute("src") || "", baseUrl);
        if (src) urls.add(src);
      });
      return Array.from(urls);
    };
    const checkAsset = async (url) => {
      try {
        const res = await fetch(url, { method: "HEAD", cache: "no-store" });
        if (!res.ok) {
          console.warn("route-audit:asset", { url, status: res.status });
        }
        return res.ok;
      } catch (err) {
        try {
          const res = await fetch(url, { cache: "no-store" });
          if (!res.ok) {
            console.warn("route-audit:asset", { url, status: res.status });
          }
          return res.ok;
        } catch (err2) {
          console.warn("route-audit:asset", { url, error: String(err2) });
          return false;
        }
      }
    };

    console.groupCollapsed("route-audit");
    for (const path of ROUTE_AUDIT_URLS) {
      try {
        const res = await fetch(path, { cache: "no-store", redirect: "follow" });
        const finalUrl = res.url || resolved(path, origin);
        if (res.redirected) {
          console.info("route-audit:redirect", { path, finalUrl, status: res.status });
        }
        if (!res.ok) {
          console.warn("route-audit:route", { path, status: res.status });
          continue;
        }
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, "text/html");
        const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute("href") || "";
        if (canonical) {
          const canonicalUrl = resolved(canonical, finalUrl);
          if (canonicalUrl && canonicalUrl !== finalUrl) {
            console.info("route-audit:canonical", { path, canonical: canonicalUrl });
          }
        }
        const assets = collectAssets(doc, finalUrl).filter(isSameOrigin);
        for (const assetUrl of assets) {
          await checkAsset(assetUrl);
        }
      } catch (err) {
        console.warn("route-audit:error", { path, error: String(err) });
      }
    }
    console.groupEnd();
  };

  const loadScriptOnce = (src, key) =>
    new Promise((resolve, reject) => {
      if (key && window[key]) return resolve();
      if (document.querySelector(`script[data-src="${src}"]`)) return resolve();
      const script = document.createElement("script");
      script.src = src;
      script.defer = true;
      script.setAttribute("data-src", src);
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });

  const initSiteData = async () => {
    try {
      await loadScriptOnce("/assets/js/apiClient.js", "HVApiClient");
      await loadScriptOnce("/assets/js/siteSettings.js", "HVSiteSettings");
      if (window.HVSiteSettings && typeof window.HVSiteSettings.init === "function") {
        await window.HVSiteSettings.init();
      }
      await loadScriptOnce("/assets/js/blog.js", "HVBlog");
      if (window.HVBlog && typeof window.HVBlog.init === "function") {
        window.HVBlog.init();
      }
    } catch (err) {
      debugLog("site-data:init_failed", { error: err?.message || String(err) });
    }
  };

  const ensurePlateContext = () => {
    if (window.HVPlateContext && typeof window.HVPlateContext.init === "function") {
      window.HVPlateContext.init();
      return;
    }
    if (window.HVPlateContextLoading) return;
    window.HVPlateContextLoading = true;
    const script = document.createElement("script");
    script.src = "/assets/js/plateContext.js";
    script.defer = true;
    script.onload = () => {
      window.HVPlateContextLoading = false;
      if (window.HVPlateContext && typeof window.HVPlateContext.init === "function") {
        window.HVPlateContext.init();
      }
    };
    script.onerror = () => {
      window.HVPlateContextLoading = false;
    };
    document.head.appendChild(script);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      ensurePlateContext();
      initSiteData();
    });
  } else {
    ensurePlateContext();
    initSiteData();
  }

  // Alleen SPA draaien op /hulpveren of /luchtvering, en alleen als er een echte app-container is
  let app =
    document.getElementById("app") ||
    document.querySelector("main.app");

  const isAppRoute = (() => {
    const p = location.pathname.toLowerCase();
    const bases = [HV_BASE, NR_BASE];
    return bases.some((b) => p === b || p.startsWith(b + "/"));
  })();

  const ensureAppContainer = () => {
    if (app || !isAppRoute) return app;
    const main = document.querySelector("main") || document.body;
    if (!main) return null;
    const container = document.createElement("div");
    container.id = "app";
    container.className = "app";
    main.appendChild(container);
    app = container;
    debugLog("app-container:created", { path: location.pathname });
    return app;
  };

  if (!app && isAppRoute) {
    ensureAppContainer();
  }

  const hasApp = !!(app && isAppRoute);

  // Afbeeldingsbronnen (nieuwe site: lokale map)
  const IMAGE_BASES = ["/assets/img/HV-kits/"];
  const FAVICON_PATH = "/img/branding/APR-Favicon.png";
  const GEMONTEERD_MANIFEST_URL = "/assets/img/Gemonteerd/manifest.json";
  const GEMONTEERD_BASE = "/assets/img/Gemonteerd";
  let SKU_INDEX = null;

  // Standaard e-mail voor leadformulier (kan je overschrijven in een <script>)
  window.LEAD_FORM_MAILTO =
    window.LEAD_FORM_MAILTO || "info@auto-parts-roosendaal.nl";

  // Zorg dat menu-labels ook op oudere statische pagina's kloppen
  const updateNavLabels = () => {
    [
      {
        selector:
          '.nav-item-mega[data-family="nr"] .nav-toggle-cta, .hv-nav-item-mega[data-family="nr"] .hv-nav-toggle',
        label: "MAD Luchtvering",
      },
      {
        selector:
          '.nav-item-mega[data-family="ls"] .nav-toggle-cta, .hv-nav-item-mega[data-family="ls"] .hv-nav-toggle',
        label: "MAD Verlagingsveren",
      },
    ].forEach(({ selector, label }) => {
      document.querySelectorAll(selector).forEach((el) => {
        el.textContent = label;
      });
    });
  };

  const bindMobileMegaScroll = () => {
    const isMobile = () => window.matchMedia("(max-width: 960px)").matches;
    document
      .querySelectorAll(
        '.nav-item-mega a[data-make], .hv-nav-item-mega a[data-make]'
      )
      .forEach((a) => {
        if (a.dataset.mobileScrollBound === "1") return;
        a.dataset.mobileScrollBound = "1";
        a.addEventListener("click", () => {
          if (!isMobile()) return;
          const item =
            a.closest(".nav-item-mega") || a.closest(".hv-nav-item-mega");
          if (!item) return;
          const models =
            item.querySelector('[id^="hv-mega-models"]') ||
            item.querySelector(".hv-mega-models");
          if (!models) return;
          requestAnimationFrame(() => {
            models.scrollIntoView({ behavior: "smooth", block: "start" });
          });
        });
      });
  };

  const scheduleMobileMegaScroll = () => {
    let tries = 0;
    const tick = () => {
      bindMobileMegaScroll();
      if (tries++ < 8) setTimeout(tick, 250);
    };
    tick();
  };

  const ensureFavicon = () => {
    const rels = ["icon", "shortcut icon", "apple-touch-icon"];
    rels.forEach((rel) => {
      let link = document.querySelector(`link[rel="${rel}"]`);
      if (!link) {
        link = document.createElement("link");
        link.setAttribute("rel", rel);
        document.head.appendChild(link);
      }
      link.setAttribute("href", FAVICON_PATH);
      if (rel !== "apple-touch-icon") link.setAttribute("type", "image/png");
    });
  };

  const ensureCanonicalOg = () => {
    const head = document.head || document.querySelector("head");
    if (!head) return;
    const url = (() => {
      try {
        const loc = window.location;
        const clean = loc.pathname.replace(/\/{2,}/g, "/");
		const canonicalPath = clean === "/" ? "/" : (clean.replace(/\/+$/, "") || "/");

        return `${loc.origin}${canonicalPath}`;
      } catch {
        return "";
      }
    })();

    const getOrCreate = (selector, tag, attrs = {}) => {
      let el = document.querySelector(selector);
      if (!el) {
        el = document.createElement(tag);
        Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
        head.appendChild(el);
      }
      return el;
    };

    if (url) {
      const canon = getOrCreate('link[rel="canonical"]', "link", {
        rel: "canonical",
      });
      if (!canon.getAttribute("href")) canon.setAttribute("href", url);
    }

    const descMeta = document.querySelector('meta[name="description"]');
    const desc = descMeta ? descMeta.getAttribute("content") || "" : "";
    const ogType = getOrCreate('meta[property="og:type"]', "meta", {
      property: "og:type",
    });
    if (!ogType.getAttribute("content")) ogType.setAttribute("content", "website");

    const ogTitle = getOrCreate('meta[property="og:title"]', "meta", {
      property: "og:title",
    });
    if (!ogTitle.getAttribute("content") && document.title)
      ogTitle.setAttribute("content", document.title);

    const ogDesc = getOrCreate('meta[property="og:description"]', "meta", {
      property: "og:description",
    });
    if (!ogDesc.getAttribute("content") && desc)
      ogDesc.setAttribute("content", desc);

    if (url) {
      const ogUrl = getOrCreate('meta[property="og:url"]', "meta", {
        property: "og:url",
      });
      if (!ogUrl.getAttribute("content")) ogUrl.setAttribute("content", url);
    }
  };

  const bindHeaderLeaveClose = () => {
    return;
    const header = document.querySelector(".site-header");
    if (!header || header.dataset.hvHoverBound === "1") return;
    header.dataset.hvHoverBound = "1";
    const CLOSE_MARGIN = 120;
    const navShell = header.querySelector(".nav-shell");
    let timer;
    let watching = false;
    let rafId = null;
    const isFarAway = (evt) => {
      const rect =
        (navShell && navShell.getBoundingClientRect()) ||
        header.getBoundingClientRect();
      return (
        evt.clientX < rect.left - CLOSE_MARGIN ||
        evt.clientX > rect.right + CLOSE_MARGIN ||
        evt.clientY < rect.top - CLOSE_MARGIN ||
        evt.clientY > rect.bottom + CLOSE_MARGIN
      );
    };
    const closeAll = () => {
      header.classList.remove("nav-open");
      header.classList.add("nav-force-close");
      header
        .querySelectorAll(".nav-item-mega, .hv-nav-item-mega")
        .forEach((item) => {
          item.classList.remove("is-open");
          item
            .querySelectorAll(".nav-toggle-cta, .hv-nav-toggle")
            .forEach((btn) => btn.setAttribute("aria-expanded", "false"));
        });
    };
    header.addEventListener("mouseenter", () => clearTimeout(timer));
    header.addEventListener("mouseleave", () => {
      if (!window.matchMedia("(hover:hover)").matches) return;
      clearTimeout(timer);
      timer = setTimeout(closeAll, 120);
    });

    const onMove = (evt) => {
      const anyOpen =
        header.querySelector(".nav-item-mega.is-open, .hv-nav-item-mega.is-open") ||
        header.classList.contains("nav-open");
      if (!anyOpen) return;
      if (!isFarAway(evt)) return;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        closeAll();
        rafId = null;
      });
    };

    const startWatch = () => {
      if (watching) return;
      watching = true;
      document.addEventListener("mousemove", onMove);
    };
    const stopWatch = () => {
      if (!watching) return;
      watching = false;
      document.removeEventListener("mousemove", onMove);
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
    };

    header.addEventListener("mouseenter", startWatch);
    header.addEventListener("mouseleave", startWatch);
    document.addEventListener("scroll", () => stopWatch(), { passive: true });
    header.addEventListener("mouseenter", () => {
      header.classList.remove("nav-force-close");
    });
  };

  const applyHeadFixes = () => {
    updateNavLabels();
    ensureFavicon();
    scheduleMobileMegaScroll();
    bindHeaderLeaveClose();
    ensureCanonicalOg();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyHeadFixes);
  } else {
    applyHeadFixes();
  }
  setTimeout(applyHeadFixes, 200);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", adjustSetPageH1, { once: true });
  } else {
    adjustSetPageH1();
  }
  if (DEBUG) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        setTimeout(runRouteAudit, 600);
      });
    } else {
      setTimeout(runRouteAudit, 600);
    }
  }

  /* ================== Basis helpers ================== */

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[m]));

  // Prefer source field, fallback to derived.* (used for dynamic SEO/sets)
  function getField(record, key) {
    if (!record || !key) return undefined;
    if (record[key] !== undefined && record[key] !== null) return record[key];
    if (record.derived && record.derived[key] !== undefined) return record.derived[key];
    return undefined;
  }

  const slugify = (s) =>
    String(s || "")
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/#/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const normalizeForRoute = (p) => {
      p = (p || "/").split(/[?#]/)[0];
      p = p.replace(/\/{2,}/g, "/");
      if (p.length > 1) p = p.replace(/\/+$/, "");
      return p || "/";
    };

    const normalizePlateInput = (value) =>
      String(value || "")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");

    const plateSlug = (value) => normalizePlateInput(value).toLowerCase();

    const findPlateSegment = (parts) => {
      if (!Array.isArray(parts) || !parts.length) return null;
      const lastIndex = parts.length - 1;
      if (parts[lastIndex] && parts[lastIndex].startsWith(PLATE_PREFIX)) {
        const platePart = parts[lastIndex] || "";
        const plate = platePart.slice(PLATE_PREFIX.length);
        if (!plate) return null;
        return { index: lastIndex, plate, platePart };
      }
      const index = parts.findIndex(
        (part) => part && part.startsWith(PLATE_PREFIX)
      );
      if (index < 0) return null;
      const platePart = parts[index] || "";
      const plate = platePart.slice(PLATE_PREFIX.length);
      if (!plate) return null;
      return { index, plate, platePart };
    };

    const readSessionCache = (key) => {
      try {
        const raw = sessionStorage.getItem(key);
        if (!raw) return null;
        const payload = JSON.parse(raw);
        if (payload.expiresAt && payload.expiresAt < Date.now()) {
          sessionStorage.removeItem(key);
          return null;
        }
        return payload.value;
      } catch (err) {
        return null;
      }
    };

    const writeSessionCache = (key, value, ttlMs) => {
      try {
        const payload = {
          value,
          expiresAt: ttlMs ? Date.now() + ttlMs : null,
        };
        sessionStorage.setItem(key, JSON.stringify(payload));
      } catch (err) {
        // ignore storage failures
      }
    };

    const plateCacheKey = (plate) => `plate:${plate}`;

    const pickBestModelSlug = (rawSlug, candidates) => {
      if (!rawSlug) return "";
      if (!Array.isArray(candidates) || !candidates.length) return rawSlug;
      if (candidates.includes(rawSlug)) return rawSlug;
      let best = "";
      candidates.forEach((slug) => {
        if (!slug) return;
        if (rawSlug.includes(slug) || slug.includes(rawSlug)) {
          if (slug.length > best.length) best = slug;
        }
      });
      return best || rawSlug;
    };

    const loadHvModelSlugs = async (makeSlug) => {
      if (!makeSlug) return [];
      const key = `hv:${makeSlug}`;
      if (MODEL_SLUG_CACHE.has(key)) return MODEL_SLUG_CACHE.get(key);
      const data = await fetchJson(`/data/models/${makeSlug}.json`, null);
      const list = data && Array.isArray(data.models) ? data.models : [];
      const slugs = Array.from(
        new Set(
          list
            .map((m) => slugify(m.slug || m.label || ""))
            .filter(Boolean)
        )
      );
      MODEL_SLUG_CACHE.set(key, slugs);
      return slugs;
    };

    const loadModelIndex = async (base, url) => {
      if (MODEL_INDEX_CACHE.has(base)) return MODEL_INDEX_CACHE.get(base);
      const data = await fetchJson(url, []);
      const index = new Map();
      (data || []).forEach((entry) => {
        const make = slugify(entry.MAKE_SLUG || entry.MAKE || entry.MAKE_RAW || "");
        const model = slugify(
          entry.MODEL_SLUG || entry.MODEL || entry.MODEL_NAME || ""
        );
        if (!make || !model) return;
        if (!index.has(make)) index.set(make, new Set());
        index.get(make).add(model);
      });
      MODEL_INDEX_CACHE.set(base, index);
      return index;
    };

    const loadModelSlugsForBase = async (base, makeSlug) => {
      if (!makeSlug || !base) return [];
      if (base === HV_BASE) return loadHvModelSlugs(makeSlug);
      if (base === NR_BASE) {
        const index = await loadModelIndex(base, "/data/nr-model-pages.json");
        return Array.from(index.get(makeSlug) || []);
      }
      if (base === LS_BASE) {
        const index = await loadModelIndex(base, "/data/ls-model-pages.json");
        return Array.from(index.get(makeSlug) || []);
      }
      return [];
    };

    const resolvePlateModelSlug = async ({ base, makeSlug, modelSlug }) => {
      if (!makeSlug || !modelSlug) return modelSlug;
      const candidates = await loadModelSlugsForBase(base, makeSlug);
      return pickBestModelSlug(modelSlug, candidates);
    };

    const fetchWithTimeout = async (
      url,
      options = {},
      timeoutMs = PLATE_FETCH_TIMEOUT_MS
    ) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await fetch(url, { ...options, signal: controller.signal });
      } catch (err) {
        if (err && err.name === "AbortError") {
          const timeoutErr = new Error("plate_timeout");
          timeoutErr.code = "timeout";
          timeoutErr.status = 408;
          timeoutErr.endpoint = url;
          throw timeoutErr;
        }
        throw err;
      } finally {
        clearTimeout(timer);
      }
    };

    const fetchPlateData = async (plateRaw) => {
      const normalized = normalizePlateInput(plateRaw);
      if (!normalized || normalized.length < 6) {
        const err = new Error("invalid_plate");
        err.code = "invalid_plate";
        throw err;
      }
      const cacheKey = plateCacheKey(normalized);
      const cached = readSessionCache(cacheKey);
      if (cached) {
        debugLog("plate:cache_hit", { plate: normalized });
        return cached;
      }
      if (PLATE_FETCH_INFLIGHT.has(normalized)) {
        return PLATE_FETCH_INFLIGHT.get(normalized);
      }

      const inflight = (async () => {
        const endpoint = `${PLATE_API_BASE}/${encodeURIComponent(normalized)}`;
        const res = await fetchWithTimeout(endpoint, { cache: "no-store" });
        const snippet = await res
          .clone()
          .text()
          .then((text) => text.slice(0, 200))
          .catch(() => "");
        debugLog("plate:fetch", { plate: normalized, status: res.status, endpoint });
        if (!res.ok) {
          console.warn("plate:fetch_error", {
            plate: normalized,
            endpoint,
            status: res.status,
            snippet,
          });
          const err = new Error(`plate_fetch_failed:${res.status}`);
          err.status = res.status;
          err.endpoint = endpoint;
          throw err;
        }
        if (snippet) {
          debugLog("plate:fetch_snippet", { plate: normalized, endpoint, snippet });
        }
        const data = await res.json();
        writeSessionCache(cacheKey, data, PLATE_CACHE_TTL_MS);
        return data;
      })();

      PLATE_FETCH_INFLIGHT.set(normalized, inflight);
      try {
        return await inflight;
      } finally {
        PLATE_FETCH_INFLIGHT.delete(normalized);
      }
    };

    const normalizeKey = (key) =>
      String(key || "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");

    const ALDOC_BRAND_KEY_SET = new Set(
      [
        "brandcode",
        "brand_code",
        "brandid",
        "brand_id",
        "merkcode",
        "merk_code",
        "merkid",
        "merk_id",
        "suppliercode",
        "supplier_code",
        "supplierid",
        "supplier_id",
      ].map(normalizeKey)
    );

    const ALDOC_PRODUCT_KEY_SET = new Set(
      [
        "productcode",
        "product_code",
        "productgroupcode",
        "productgroup_code",
        "productgroupid",
        "productgroup_id",
        "productgroepcode",
        "productgroep_code",
        "productgroepid",
        "productgroep_id",
        "articlecode",
        "article_code",
        "partcode",
        "part_code",
        "groupcode",
        "group_code",
        "productid",
        "product_id",
      ].map(normalizeKey)
    );

    const SKU_FIELD_KEYS = [
      "SKU",
      "Sku",
      "sku",
      "PartNumber",
      "PartNo",
      "PartNr",
      "ArticleNumber",
      "ArticleNo",
      "ItemNumber",
      "ItemNo",
      "ProductNumber",
      "ProductNo",
      "Number",
      "ItemCode",
      "ArticleCode",
      "PartCode",
    ];

    const toNumberValue = (value) => {
      if (value == null) return null;
      if (typeof value === "number" && Number.isFinite(value)) return value;
      const match = String(value || "").match(/\d+/);
      if (!match) return null;
      const parsed = Number.parseInt(match[0], 10);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const findNumericByKey = (value, keySet, depth = 0) => {
      if (!value || typeof value !== "object") return null;
      if (depth > 4) return null;
      if (Array.isArray(value)) {
        for (const entry of value) {
          const found = findNumericByKey(entry, keySet, depth + 1);
          if (found != null) return found;
        }
        return null;
      }
      for (const [key, val] of Object.entries(value)) {
        if (keySet.has(normalizeKey(key))) {
          const num = toNumberValue(val);
          if (num != null) return num;
        }
        if (val && typeof val === "object") {
          const nested = findNumericByKey(val, keySet, depth + 1);
          if (nested != null) return nested;
        }
      }
      return null;
    };

    const extractNumericSku = (value) => {
      if (value == null) return "";
      const match = String(value || "").match(/\b(\d{4,})\b/);
      return match ? match[1] : "";
    };

    const normalizeSkuValue = (value) => {
      const match = String(value || "")
        .toUpperCase()
        .match(/\b(HV|NR|LS)\s*[- ]?\s*(\d{3,})\b/);
      if (!match) return "";
      return `${match[1]}-${match[2]}`;
    };

    const collectStringValues = (value, out, depth = 0) => {
      if (!value || depth > 4) return;
      if (typeof value === "string") {
        out.push(value);
        return;
      }
      if (Array.isArray(value)) {
        value.forEach((entry) => collectStringValues(entry, out, depth + 1));
        return;
      }
      if (typeof value === "object") {
        Object.values(value).forEach((entry) =>
          collectStringValues(entry, out, depth + 1)
        );
      }
    };

    const itemText = (item) => {
      const parts = [];
      collectStringValues(item, parts, 0);
      return parts.join(" ");
    };

    const extractSkuFromItem = (item) => {
      if (!item || typeof item !== "object") return { sku: "", digits: "" };
      let digits = "";
      for (const key of SKU_FIELD_KEYS) {
        if (!(key in item)) continue;
        const val = item[key];
        const sku = normalizeSkuValue(val);
        if (sku) return { sku, digits: sku.split("-")[1] || "" };
        if (!digits) digits = extractNumericSku(val);
      }
      const textSku = normalizeSkuValue(itemText(item));
      if (textSku) return { sku: textSku, digits: textSku.split("-")[1] || "" };
      return { sku: "", digits };
    };

    const looksLikeAldocItem = (obj) => {
      if (!obj || typeof obj !== "object") return false;
      const keys = Object.keys(obj);
      if (!keys.length) return false;
      return keys.some((key) => {
        const k = key.toLowerCase();
        return (
          k.includes("part") ||
          k.includes("product") ||
          k.includes("article") ||
          k.includes("brand") ||
          k.includes("supplier") ||
          k.includes("sku") ||
          k.includes("item") ||
          k.includes("menu")
        );
      });
    };

    const collectAldocItems = (payload) => {
      const out = [];
      const seen = new WeakSet();
      const visit = (value, depth) => {
        if (!value || typeof value !== "object" || depth > 6) return;
        if (seen.has(value)) return;
        seen.add(value);
        if (Array.isArray(value)) {
          value.forEach((entry) => visit(entry, depth + 1));
          return;
        }
        if (looksLikeAldocItem(value)) out.push(value);
        Object.values(value).forEach((entry) => {
          if (entry && typeof entry === "object") visit(entry, depth + 1);
        });
      };
      visit(payload, 0);
      return out;
    };

    const isLoweringGroup = (item) => {
      const text = itemText(item).toLowerCase();
      return text.includes("verlagingsveren");
    };

    const extractAldocSets = (payload) => {
      const items = collectAldocItems(payload);
      const hv = new Set();
      const nr = new Set();
      const ls = new Set();
      let matchedItems = 0;

      items.forEach((item) => {
        const brandCode = findNumericByKey(item, ALDOC_BRAND_KEY_SET);
        if (brandCode !== ALDOC_CODES.brand) return;
        matchedItems += 1;

        const info = extractSkuFromItem(item);
        let sku = info.sku;
        if (!sku && info.digits) {
          const productCode = findNumericByKey(item, ALDOC_PRODUCT_KEY_SET);
          if (productCode === ALDOC_CODES.hv) sku = `HV-${info.digits}`;
          else if (productCode === ALDOC_CODES.nr) sku = `NR-${info.digits}`;
          else if (isLoweringGroup(item)) sku = `LS-${info.digits}`;
        }

        if (!sku) return;
        const upper = sku.toUpperCase();
        if (upper.startsWith("HV-")) hv.add(upper);
        else if (upper.startsWith("NR-")) nr.add(upper);
        else if (upper.startsWith("LS-")) ls.add(upper);
      });

      return {
        hvSkus: Array.from(hv).sort(),
        nrSkus: Array.from(nr).sort(),
        lsSkus: Array.from(ls).sort(),
        matchedItems,
        totalItems: items.length,
      };
    };

    const getPlateBaseFromPath = (pathname) => {
      const clean = normalizeForRoute(pathname).toLowerCase();
      if (clean === HV_BASE || clean.startsWith(HV_BASE + "/")) return HV_BASE;
      if (clean === NR_BASE || clean.startsWith(NR_BASE + "/")) return NR_BASE;
      if (clean === LS_BASE || clean.startsWith(LS_BASE + "/")) return LS_BASE;
      return null;
    };

    const initPlateMount = () => {
      const target = document.getElementById("kenteken");
      if (!target || target.dataset.hvPlateAutoMounted === "1") return;
      target.dataset.hvPlateAutoMounted = "1";

      const mountWidget = () => {
        if (!window.HVPlate || typeof window.HVPlate.mount !== "function") return;
        window.HVPlate.mount("#kenteken", { autoSelectIfSingle: true });
      };

      if (window.HVPlate && typeof window.HVPlate.mount === "function") {
        mountWidget();
        return;
      }

      const existingScript = document.querySelector(
        'script[src="/assets/js/plate.js"]'
      );
      if (existingScript) {
        existingScript.addEventListener("load", mountWidget, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = "/assets/js/plate.js";
      script.onload = mountWidget;
      document.body.appendChild(script);
    };

    const bindPlateRedirect = () => {
      if (window.__hvPlateRedirectBound) return;
      window.__hvPlateRedirectBound = true;
      window.addEventListener("hv:vehicleSelected", () => {});
    };

    const initPlateHelpers = () => {
      initPlateMount();
      bindPlateRedirect();
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initPlateHelpers);
    } else {
      initPlateHelpers();
    }

    const readPlateSelection = () => {
      const ctx =
        window.HVPlateContext && typeof window.HVPlateContext.getPlateContext === "function"
          ? window.HVPlateContext.getPlateContext()
          : null;
      return {
        plate: ctx && ctx.plate ? String(ctx.plate) : "",
        vehicle: ctx && ctx.vehicle ? ctx.vehicle : null,
        route: ctx && ctx.route ? ctx.route : null,
      };
    };

    const getActivePlateContext = () =>
      window.HVPlateContext && typeof window.HVPlateContext.getPlateContext === "function"
        ? window.HVPlateContext.getPlateContext()
        : null;

    const getPlatePathInfo = (pathname, base) => {
      if (!base) return null;
      const baseClean = normalizeForRoute(base).toLowerCase().replace(/^\/+/, "");
      const clean = normalizeForRoute(pathname).toLowerCase();
      const parts = clean.split("/").filter(Boolean);
      if (!parts.length || parts[0] !== baseClean) return null;
      const slugParts = parts.slice(1);
      if (slugParts.length < 2) return null;
      const plateMatch = findPlateSegment(slugParts);
      if (!plateMatch || plateMatch.index < 2) return null;
      return {
        plateSlug: plateMatch.plate,
        makeSlug: slugParts[0],
        modelSlug: slugParts[1],
      };
    };

    const parseAldocDateValue = (value) => {
      const raw = String(value ?? "").trim();
      if (!raw) return null;
      const digits = raw.replace(/\D/g, "");
      if (digits.length >= 6) {
        const year = Number.parseInt(digits.slice(0, 4), 10);
        const month = Number.parseInt(digits.slice(4, 6), 10);
        if (Number.isFinite(year) && year > 0) {
          return {
            year,
            month: month >= 1 && month <= 12 ? month : null,
          };
        }
      }
      const match = raw.match(/\d{4}/);
      if (match) {
        const year = Number.parseInt(match[0], 10);
        return Number.isFinite(year) ? { year, month: null } : null;
      }
      return null;
    };

    const formatAldocDate = (date) => {
      if (!date || !date.year) return "";
      if (date.month) {
        return `${String(date.month).padStart(2, "0")}-${date.year}`;
      }
      return String(date.year);
    };

    const formatAldocRangeLabel = (fromDate, toDate) => {
      const fromLabel = formatAldocDate(fromDate);
      const toLabel = formatAldocDate(toDate);
      if (fromLabel && toLabel) return `${fromLabel}/${toLabel}`;
      return fromLabel || toLabel || "";
    };

    const parseYearMonth = (input, defaultMonth = 1) => {
      if (input == null || input === "") return null;
      if (typeof input === "object" && input.year) {
        const year = Number.parseInt(input.year, 10);
        const month = Number.parseInt(input.month, 10) || defaultMonth;
        if (!Number.isFinite(year)) return null;
        const safeMonth =
          Number.isFinite(month) && month >= 1 && month <= 12 ? month : defaultMonth;
        return { year, month: safeMonth };
      }

      const raw = String(input || "").trim();
      if (!raw) return null;

      const yearOnly = raw.match(/^(\d{4})$/);
      if (yearOnly) {
        return { year: Number.parseInt(yearOnly[1], 10), month: defaultMonth };
      }

      const yearMonth = raw.match(/^(\d{4})[\/-](\d{1,2})(?:[\/-]\d{1,2})?$/);
      if (yearMonth) {
        const year = Number.parseInt(yearMonth[1], 10);
        const month = Number.parseInt(yearMonth[2], 10);
        if (!Number.isFinite(year)) return null;
        return {
          year,
          month: month >= 1 && month <= 12 ? month : defaultMonth,
        };
      }

      const monthYear = raw.match(/^(\d{1,2})[\/-](\d{4})$/);
      if (monthYear) {
        const month = Number.parseInt(monthYear[1], 10);
        const year = Number.parseInt(monthYear[2], 10);
        if (!Number.isFinite(year)) return null;
        return {
          year,
          month: month >= 1 && month <= 12 ? month : defaultMonth,
        };
      }

      const dayMonthYear = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
      if (dayMonthYear) {
        const month = Number.parseInt(dayMonthYear[2], 10);
        const year = Number.parseInt(dayMonthYear[3], 10);
        if (!Number.isFinite(year)) return null;
        return {
          year,
          month: month >= 1 && month <= 12 ? month : defaultMonth,
        };
      }

      const digits = raw.replace(/\D/g, "");
      if (digits.length >= 8) {
        const year = Number.parseInt(digits.slice(0, 4), 10);
        const month = Number.parseInt(digits.slice(4, 6), 10);
        if (!Number.isFinite(year)) return null;
        return {
          year,
          month: month >= 1 && month <= 12 ? month : defaultMonth,
        };
      }
      if (digits.length >= 6) {
        const year = Number.parseInt(digits.slice(0, 4), 10);
        const month = Number.parseInt(digits.slice(4, 6), 10);
        if (!Number.isFinite(year)) return null;
        return {
          year,
          month: month >= 1 && month <= 12 ? month : defaultMonth,
        };
      }
      if (digits.length >= 4) {
        const year = Number.parseInt(digits.slice(0, 4), 10);
        return Number.isFinite(year) ? { year, month: defaultMonth } : null;
      }

      return null;
    };

    const toComparable = (ym) => {
      if (!ym || !Number.isFinite(ym.year) || !Number.isFinite(ym.month)) return null;
      return ym.year * 12 + (ym.month - 1);
    };

    const normalizeRange = (start, end) => {
      if (!start && !end) return null;
      return { start: start || null, end: end || null };
    };

    const parseRange = (input) => {
      if (input == null || input === "") return null;
      if (typeof input === "object") {
        if (input.label) {
          const viaLabel = parseRange(String(input.label));
          if (viaLabel) return viaLabel;
        }
        if (
          Object.prototype.hasOwnProperty.call(input, "start") ||
          Object.prototype.hasOwnProperty.call(input, "end")
        ) {
          const start = parseYearMonth(input.start, 1);
          const end = parseYearMonth(input.end, 12);
          return normalizeRange(start, end);
        }
        if (
          Object.prototype.hasOwnProperty.call(input, "from") ||
          Object.prototype.hasOwnProperty.call(input, "to")
        ) {
          const start = parseYearMonth(input.from, 1);
          const end = parseYearMonth(input.to, 12);
          return normalizeRange(start, end);
        }
        return null;
      }

      const raw = String(input || "").trim();
      if (!raw) return null;

      const slashParts = raw.split("/");
      if (slashParts.length >= 2) {
        const start = parseYearMonth(slashParts[0], 1);
        const end = parseYearMonth(slashParts[1], 12);
        return parseRange({ start, end });
      }

      const yearRange = raw.match(/(\d{4})\s*-\s*(\d{4})/);
      if (yearRange) {
        const start = parseYearMonth(yearRange[1], 1);
        const end = parseYearMonth(yearRange[2], 12);
        return parseRange({ start, end });
      }

      const singleStart = parseYearMonth(raw, 1);
      const singleEnd = parseYearMonth(raw, 12);
      return normalizeRange(singleStart, singleEnd);
    };

    const rangesOverlap = (rangeA, rangeB) => {
      if (!rangeA || !rangeB) return true;
      const aStart = toComparable(rangeA.start);
      const aEnd = toComparable(rangeA.end);
      const bStart = toComparable(rangeB.start);
      const bEnd = toComparable(rangeB.end);
      const left = aStart == null ? -Infinity : aStart;
      const right = aEnd == null ? Infinity : aEnd;
      const otherLeft = bStart == null ? -Infinity : bStart;
      const otherRight = bEnd == null ? Infinity : bEnd;
      return left <= otherRight && otherLeft <= right;
    };

    const clampGeneration = (range, generation) => {
      if (!range || !generation) return range;
      const start = range.start ? { ...range.start } : null;
      const end = range.end ? { ...range.end } : null;
      if (generation === 3) {
        const boundaryEnd = { year: 2015, month: 5 };
        return {
          start,
          end: clampRangeMax(end, boundaryEnd),
        };
      }
      if (generation === 4) {
        const boundaryStart = { year: 2015, month: 6 };
        return {
          start: clampRangeMin(start, boundaryStart),
          end,
        };
      }
      return range;
    };

    const formatYearMonth = (ym) => {
      if (!ym || !ym.year) return "";
      const month = ym.month ? String(ym.month).padStart(2, "0") : "01";
      return `${ym.year}-${month}`;
    };

    const buildPlateYearRange = (vehicle) => {
      if (!vehicle) return null;
      const minYear =
        vehicle.yearMin ??
        vehicle.estimatedYearMin ??
        vehicle.year_min ??
        vehicle.year_from ??
        null;
      const maxYear =
        vehicle.yearMax ??
        vehicle.estimatedYearMax ??
        vehicle.year_max ??
        vehicle.year_to ??
        null;
      if (minYear != null || maxYear != null) {
        const from = minYear ?? maxYear;
        const to = maxYear ?? minYear;
        return {
          from,
          to,
          label: formatYearRangeLabel({ from, to }),
          source: vehicle.yearSource || "plate",
        };
      }
      const fromRaw =
        vehicle.typeFrom ??
        vehicle.type_from ??
        vehicle.year_from ??
        vehicle.yearFrom ??
        vehicle.from ??
        vehicle.year ??
        null;
      const toRaw =
        vehicle.typeTill ??
        vehicle.type_till ??
        vehicle.year_to ??
        vehicle.yearTo ??
        vehicle.till ??
        vehicle.year ??
        null;

      const fromDate = parseAldocDateValue(fromRaw);
      const toDate = parseAldocDateValue(toRaw);
      const fromYear = fromDate ? fromDate.year : null;
      const toYear = toDate ? toDate.year : null;
      if (fromYear == null && toYear == null) return null;
      const label = formatAldocRangeLabel(fromDate, toDate);
      return {
        from: fromYear ?? toYear,
        to: toYear ?? fromYear,
        label,
        source: "plate",
      };
    };

    const buildPlateAutoLabel = (vehicle) => {
      if (!vehicle) return "";
      const make = vehicle.make || vehicle.makename || "";
      const model = vehicle.model || vehicle.modelname || "";
      const modelRemark = vehicle.modelRemark || vehicle.model_remark || "";
      const bodyType = vehicle.bodyType || vehicle.bodytype || "";
      const parts = [];
      const base = [make, model].filter(Boolean).join(" ");
      if (base) parts.push(base);
      if (modelRemark) parts.push(`(${modelRemark})`);
      if (bodyType) parts.push(bodyType);
      return parts.join(" ").trim();
    };

    const formatPower = (kw) => {
      const num = Number(kw);
      if (!Number.isFinite(num)) return "";
      const kwRounded = Math.round(num);
      const hp = Math.round(num * 1.35962);
      return `${kwRounded}kW / ${hp}pk`;
    };

    const extractEngineCodes = (vehicle) => {
      if (!vehicle) return "";
      const direct =
        vehicle.engineCode ||
        vehicle.engineCodes ||
        vehicle.engine_code ||
        vehicle.engine_codes ||
        vehicle.motorCode ||
        vehicle.motorcode ||
        "";
      if (direct) return String(direct);
      const type = String(vehicle.type || vehicle.typename || "");
      const match = type.match(/[A-Z0-9]{2,}(?:;[A-Z0-9]{2,})+/);
      return match ? match[0] : "";
    };

    const normalizeVehicleValue = (value) => {
      if (value === undefined || value === null) return "";
      const text = String(value).trim();
      if (!text) return "";
      if (/^niet geregistreerd$/i.test(text)) return "";
      return text;
    };

    const pickVehicleValue = (vehicle, keys) => {
      if (!vehicle) return "";
      for (const key of keys) {
        if (!Object.prototype.hasOwnProperty.call(vehicle, key)) continue;
        const value = normalizeVehicleValue(vehicle[key]);
        if (value) return value;
      }
      return "";
    };

    const pickVehicleRaw = (vehicle, keys) => {
      if (!vehicle) return null;
      for (const key of keys) {
        if (!Object.prototype.hasOwnProperty.call(vehicle, key)) continue;
        const value = vehicle[key];
        if (value === undefined || value === null || value === "") continue;
        if (typeof value === "string" && /^niet geregistreerd$/i.test(value.trim()))
          continue;
        return value;
      }
      return null;
    };

    const toInt = (value) => {
      if (value === undefined || value === null || value === "") return null;
      const num = Number.parseInt(String(value).trim(), 10);
      return Number.isFinite(num) ? num : null;
    };

    const formatInt = (value) => {
      const num = toInt(value);
      return num == null ? "" : String(num);
    };

    const formatUnit = (value, unit) => {
      const num = toInt(value);
      if (num == null) return "";
      return `${num} ${unit}`;
    };

    const buildPlateContext = ({ base, makeSlug, modelSlug }) => {
      const info = getPlatePathInfo(location.pathname, base);
      if (!info) return null;
      if (makeSlug && info.makeSlug !== String(makeSlug).toLowerCase()) return null;
      if (modelSlug && info.modelSlug !== String(modelSlug).toLowerCase())
        return null;

      const selection = readPlateSelection();
      const storedPlateSlug = selection ? plateSlug(selection.plate) : "";
      let vehicle = selection ? selection.vehicle : null;

      if (!vehicle || !storedPlateSlug || storedPlateSlug !== info.plateSlug) {
        vehicle = null;
      }

      if (vehicle) {
        const makeMatch = slugify(vehicle.make || vehicle.makename || "");
        const modelMatch = slugify(vehicle.model || vehicle.modelname || "");
        const route = selection && selection.route ? selection.route : null;
        const makeResolved = (route && route.makeSlug) || makeMatch;
        const modelResolved = (route && route.modelSlug) || modelMatch;

        const modelMatches =
          modelResolved === info.modelSlug ||
          info.modelSlug.startsWith(modelResolved) ||
          modelResolved.startsWith(info.modelSlug);
        if (makeResolved !== info.makeSlug || !modelMatches) {
          vehicle = null;
        }
      }

      const plateValue = selection && selection.plate ? String(selection.plate) : "";
      const plate = plateValue || (info.plateSlug ? info.plateSlug.toUpperCase() : "");
      const yearRange = vehicle ? buildPlateYearRange(vehicle) : null;
      const autoLabel = vehicle ? buildPlateAutoLabel(vehicle) : "";
      const type = vehicle ? String(vehicle.type || vehicle.typename || "") : "";
      const typeRemark = vehicle
        ? String(vehicle.typeRemark || vehicle.type_remark || "")
        : "";
      const powerText = vehicle
        ? formatPower(vehicle.kw || vehicle.kwCat || vehicle.kw_cat)
        : "";
      const rangeLabel = yearRange ? yearRange.label : "";
      let uitvoering = [type, typeRemark].filter(Boolean).join(" ").trim();
      if (rangeLabel) {
        uitvoering = uitvoering ? `${uitvoering} (${rangeLabel})` : rangeLabel;
      }
      if (powerText) {
        uitvoering = uitvoering ? `${uitvoering}, ${powerText}` : powerText;
      }
      const motorCode = vehicle ? extractEngineCodes(vehicle) : "";

      return {
        plateSlug: info.plateSlug,
        plateMasked: "",
        plate,
        vehicle,
        yearRange,
        autoLabel,
        uitvoering,
        motorCode,
      };
    };

    const buildPlateInfoHtml = (context) => {
      if (!context || !context.vehicle) return "";
      const vehicle = context.vehicle || {};
      const rows = [];
      const addRow = (label, value) => {
        if (value === undefined || value === null || value === "") return;
        rows.push(buildMetaRow(label, value));
      };
      const cleanText = (value) => {
        const text = normalizeVehicleValue(value);
        if (!text) return "";
        if (/^n\.?\s*v\.?\s*t\.?$/i.test(text)) return "";
        if (/niet\s+van\s+toepassing/i.test(text)) return "";
        return text;
      };
      const cleanNumber = (value) => {
        const num = toInt(value);
        return Number.isFinite(num) && num > 0 ? num : null;
      };
      const colorText = [cleanText(vehicle.firstColor), cleanText(vehicle.secondColor)]
        .filter(Boolean)
        .join(" / ");
      const uitvoeringText = [cleanText(context.uitvoering || ""), colorText]
        .filter(Boolean)
        .join(" - ");
      const voertuigsoortText = [
        cleanText(vehicle.vehicleType),
        cleanText(vehicle.bodyType),
      ]
        .filter(Boolean)
        .join(" - ");
      const motorCodeText = cleanText(vehicle.engineCode || context.motorCode || "");
      const driveText = cleanText(
        vehicle.driveTypeLabel || vehicle.driveLabel || vehicle.driveType || ""
      );
      const cylinders = cleanNumber(vehicle.cylinders);
      const engineContents = cleanNumber(vehicle.engineContents);
      const weightEmpty = cleanNumber(vehicle.weightEmpty);
      const maxWeight = cleanNumber(vehicle.maxWeight);
      addRow("Kenteken", context.plate || context.plateMasked || "");
      addRow("Auto", context.autoLabel || "");
      addRow("Uitvoering", uitvoeringText);
      addRow("Voertuigsoort", voertuigsoortText);
      addRow("Cilinderinhoud", engineContents ? `${engineContents} cc` : "");
      addRow("Motorcode", motorCodeText);
      addRow("Aantal cilinders", cylinders != null ? String(cylinders) : "");
      addRow("Aandrijving", driveText);
      addRow("Massa ledig voertuig", weightEmpty ? `${weightEmpty} kg` : "");
      addRow(
        "Toegestane maximum massa voertuig",
        maxWeight ? `${maxWeight} kg` : ""
      );
      if (!rows.length) return "";
      return `
        <div class="card product plate-context" data-vehicle-info-card>
          <div class="body">
            <div class="eyebrow">Voertuig</div>
            <div class="meta">
              ${rows.join("")}
            </div>
          </div>
        </div>
      `;
    };

    const insertPlateInfoBlock = (context) => {
      const html = buildPlateInfoHtml(context);
      if (!html || document.querySelector(".plate-context")) return;
      const filtersWrap = document.querySelector(".filters-wrap");
      if (filtersWrap) {
        filtersWrap.insertAdjacentHTML("beforebegin", html);
        return;
      }
      const crumbs =
        document.querySelector(".site-breadcrumbs") ||
        document.querySelector(".crumbs") ||
        document.querySelector(".breadcrumbs");
      if (crumbs) {
        crumbs.insertAdjacentHTML("afterend", html);
        return;
      }
      const mainWrap = document.querySelector("main .wrap");
      if (mainWrap) {
        mainWrap.insertAdjacentHTML("afterbegin", html);
      }
    };

    const renderVehicleInfoCard = () => {
      const context = window.hv_plate_context || null;
      if (!context) return;
      const html = buildPlateInfoHtml(context);
      if (!html) return;
      const card = document.querySelector("[data-vehicle-info-card]");
      if (card) {
        card.outerHTML = html;
        return;
      }
      const filtersWrap = document.querySelector(".filters-wrap");
      if (filtersWrap) {
        filtersWrap.insertAdjacentHTML("beforebegin", html);
        return;
      }
      const crumbs =
        document.querySelector(".site-breadcrumbs") ||
        document.querySelector(".crumbs") ||
        document.querySelector(".breadcrumbs");
      if (crumbs) {
        crumbs.insertAdjacentHTML("afterend", html);
        return;
      }
      const mainWrap = document.querySelector("main .wrap");
      if (mainWrap) {
        mainWrap.insertAdjacentHTML("afterbegin", html);
      }
    };

    const applyPlateContextToStaticLs = (context) => {
      if (!context || !context.yearRange) return;
      const grid = document.getElementById("ls-grid");
      if (!grid) return;
      if (!grid.children.length && context.plate) {
        const parts = normalizeForRoute(location.pathname).split("/").filter(Boolean);
        const makeSlug = parts[1] || "";
        const target = makeSlug ? `${LS_BASE}/${makeSlug}/` : `${LS_BASE}/`;
        window.location.href = target;
        return;
      }
      const from = context.yearRange.from ?? context.yearRange.to;
      const to = context.yearRange.to ?? context.yearRange.from;
      const yearFrom = document.getElementById("ls-year-from");
      const yearTo = document.getElementById("ls-year-to");
      const yearSlider = document.getElementById("ls-year-slider");
      const yearLabel = document.getElementById("ls-year-label");
      if (yearFrom && from != null) yearFrom.value = String(from);
      if (yearTo && to != null) yearTo.value = String(to);
      if (yearSlider) yearSlider.value = 0;
      if (yearLabel && context.yearRange.label) {
        yearLabel.textContent = context.yearRange.label;
      }
      const applyBtn = document.getElementById("ls-apply");
      if (applyBtn) applyBtn.click();
    };

    const initPlateContextFeatures = () => {
      if (hasApp) return;
      const refresh = () => {
        const context = buildPlateContext({ base: CURRENT_BASE });
        if (!context) return;
        insertPlateInfoBlock(context);
        if (CURRENT_FAMILY === "ls") {
          applyPlateContextToStaticLs(context);
        }
      };
      refresh();
      window.addEventListener("vehicle:changed", refresh);
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initPlateContextFeatures);
      document.addEventListener("DOMContentLoaded", renderVehicleInfoCard);
    } else {
      initPlateContextFeatures();
      renderVehicleInfoCard();
    }

    window.addEventListener("hv:plateContextUpdated", renderVehicleInfoCard);

  function parsePlateRoute(pathname, base = BASE) {
    const p = normalizeForRoute(pathname);
    const baseNorm = normalizeForRoute(base);
    const pLower = p.toLowerCase();
    const baseLower = baseNorm.toLowerCase();
    if (!pLower.startsWith(baseLower + "/")) return null;

    const parts = pLower
      .slice((baseLower + "/").length)
      .split("/")
      .filter(Boolean);
    if (!parts.length) return null;
    const plateMatch = findPlateSegment(parts);
    if (!plateMatch) return null;
    const make = parts[0] || "";
    const model =
      plateMatch.index >= 2 ? parts[1] || "" : ""; // model alleen als er een extra segment vóór kt_ zit
    const variant =
      plateMatch.index >= 3 ? parts[2] || "" : "";
    return {
      make,
      model,
      plate: plateMatch.plate,
      variant,
    };
  }

  function parseRoute(pathname, base = BASE) {
    const p = normalizeForRoute(pathname);
    const baseNorm = normalizeForRoute(base);
    const pLower = p.toLowerCase();
    const baseLower = baseNorm.toLowerCase();
    if (pLower === "/" || pLower === baseLower) return { kind: "brands" };

    const plateRoute = parsePlateRoute(pLower, baseLower);
    if (plateRoute) return { kind: "plate", ...plateRoute };

    if (pLower.startsWith(baseLower + "/")) {
      const parts = pLower
        .slice((baseLower + "/").length)
        .split("/")
        .filter(Boolean);
      if (parts.length === 1) return { kind: "make", make: parts[0] };
      if (parts.length >= 2)
        return { kind: "model", make: parts[0], model: parts[1] };
    }
    return { kind: "other", path: p };
  }

  function hasPlateToken(pathname, base = BASE) {
    const p = normalizeForRoute(pathname).toLowerCase();
    const baseLower = normalizeForRoute(base).toLowerCase();
    if (!p.startsWith(baseLower + "/")) return false;
    const parts = p
      .slice((baseLower + "/").length)
      .split("/")
      .filter(Boolean);
    return !!findPlateSegment(parts);
  }

  function buildIndex(kits) {
    const makes = new Map(); // makeSlug -> {label, models: Map(modelSlug -> label)}
    for (const kit of kits || []) {
      for (const f of kit.fitments || []) {
        const makeLabel = String(f.make || "").trim();
        const modelLabel = String(f.model || "").trim();
        const make = slugify(makeLabel);
        const model = slugify(modelLabel);
        if (!make || !model) continue;

        if (!makes.has(make))
          makes.set(make, { label: makeLabel, models: new Map() });
        const entry = makes.get(make);
        if (!entry.models.has(model)) entry.models.set(model, modelLabel);
        if (makeLabel.length > entry.label.length) entry.label = makeLabel;
      }
    }
    return makes;
  }

  function buildKitMap(kits) {
    const map = new Map();
    for (const kit of kits || []) {
      const sku = String(kit?.sku || "").trim().toUpperCase();
      if (!sku) continue;
      map.set(sku, kit);
    }
    return map;
  }

  function pickFitmentForKit(kit, makeSlug, modelSlug) {
    const fitments = Array.isArray(kit?.fitments) ? kit.fitments : [];
    if (!fitments.length) return {};
    const makeTarget = String(makeSlug || "").toLowerCase();
    const modelTarget = String(modelSlug || "").toLowerCase();
    let makeMatch = null;
    for (const f of fitments) {
      const make = slugify(f?.make || "");
      const model = slugify(f?.model || "");
      if (makeTarget && make !== makeTarget) continue;
      if (modelTarget && model === modelTarget) return f;
      if (!makeMatch) makeMatch = f;
    }
    return makeMatch || fitments[0];
  }

  function setTitle(t) {
    // Bepaal op basis van de URL welk type pagina het is
    const r = parseRoute(location.pathname, CURRENT_BASE);

    // Voor model-pagina's (bijv. /hulpveren/audi/a4) NIET overschrijven;
    // daar gebruiken we de statische <title> uit de HTML.
    if (r && r.kind === "model") {
      console.log("setTitle: skip override on model page:", t);
      return;
    }

    // Voor merken/overzicht mag JS de title wel zetten
    document.title = t;
  }

  function adjustSetPageH1() {
    const path = (location.pathname || "").toLowerCase();
    let family = null;
    if (/\/verlagingsveren\/ls-\d+/.test(path)) family = "ls";
    else if (/\/luchtvering\/nr-\d+/.test(path)) family = "nr";
    else if (/\/hulpveren\/hv-\d+/.test(path)) family = "hv";
    if (!family) return;

    const m = path.match(/(ls|nr|hv)-\d+/);
    const sku = m ? m[0].toUpperCase() : null;
    const h1 = document.querySelector("h1");
    if (!h1 || !sku) return;

    let base = h1.textContent.trim();
    const crumbs = Array.from(document.querySelectorAll(".crumbs a")).map((a) =>
      a.textContent.trim()
    );
    if (crumbs.length >= 2) {
      const model = crumbs.pop();
      const make = crumbs.pop();
      const familyLabel = family === "ls" ? "verlagen" : family === "nr" ? "luchtvering" : "hulpveren";
      base = `${make} ${model} ${familyLabel}`;
    }
    if (!base.toLowerCase().includes(sku.toLowerCase())) {
      h1.textContent = `${base} – ${sku.toUpperCase()}`;
    }
  }

  /* ================== Footer: merken + modellen ================== */

  function initFooter(makes, route, base = BASE, family = "hv") {
    const product = PRODUCT_LABEL[family] || "hulpveren";
    const safeMakes =
      makes && typeof makes.entries === "function" ? makes : new Map();

    // Jaar onderin footer
    const yearEl = document.getElementById("hv-footer-year");
    if (yearEl) {
      yearEl.textContent = `© ${new Date().getFullYear()}`;
    }

    const brandsEl = document.getElementById("hv-footer-brands");
    const modelsEl = document.getElementById("hv-footer-models");
    const labelEl = document.getElementById("hv-footer-models-label");

    // Als de footer op deze pagina niet bestaat â†’ klaar
    if (!brandsEl && !modelsEl && !yearEl) return;

    if (IS_SET_PAGE && brandsEl) {
      const section = brandsEl.closest("section") || brandsEl.parentElement;
      if (section) section.remove();
    }

    const brandEntries = Array.from(safeMakes.entries()).sort((a, b) =>
      a[1].label.localeCompare(b[1].label, "nl")
    );
    const preferredOrder = [
      "audi",
      "hyundai",
      "kia",
      "seat",
      "skoda",
      "suzuki",
      "toyota",
      "volkswagen",
    ];
    const preferred = preferredOrder
      .map((slug) => brandEntries.find(([s]) => s === slug))
      .filter(Boolean);
    const remaining = brandEntries.filter(
      ([slug]) => !preferredOrder.includes(slug)
    );

    // ---- Merken: hv-footer-brands ----
    if (brandsEl && !IS_SET_PAGE) {
      const maxBrands = 24;
      const frag = document.createDocumentFragment();

      [...preferred, ...remaining].slice(0, maxBrands).forEach(([makeSlug, data]) => {
        const a = document.createElement("a");
        a.className = "hv-footer-tag";
        a.href = `${base}/${esc(makeSlug)}`;
        a.textContent = data.label;
        frag.appendChild(a);
      });

      brandsEl.innerHTML = "";
      brandsEl.appendChild(frag);
    }

    // ---- Modellen: hv-footer-models ----
    if (!modelsEl) return;

    let items = [];

    // 1) Als we op een merk- of modelpagina zitten â†’ toon modellen van dat merk
    if (route.kind === "make" || route.kind === "model" || route.kind === "plate") {
      const entry = safeMakes.get(route.make);
      if (entry) {
        const models = Array.from(entry.models.entries()).sort((a, b) =>
          a[1].localeCompare(b[1])
        );
        items = models.slice(0, 30).map(([modelSlug, modelLabel]) => ({
          brandSlug: route.make,
          brandLabel: entry.label,
          modelSlug,
          modelLabel,
        }));

        if (labelEl) {
          labelEl.textContent =
            "Modellen van " +
            entry.label +
            " waarvoor MAD " +
            product +
            " beschikbaar is.";
        }
      }
    }

    // 2) Geen merkcontext? â†’ mix van populaire modellen
    if (!items.length) {
      const mixed = [];
      brandEntries.forEach(([makeSlug, data]) => {
        let count = 0;
        for (const [modelSlug, modelLabel] of data.models.entries()) {
          mixed.push({
            brandSlug: makeSlug,
            brandLabel: data.label,
            modelSlug,
            modelLabel,
          });
          count++;
          if (count >= 2) break; // max 2 modellen per merk in de mix
        }
      });
      items = mixed.slice(0, 30);

      if (labelEl) {
        labelEl.textContent =
          "Populaire modellen waarvoor MAD " + product + " leverbaar is.";
      }
    }

    const fragModels = document.createDocumentFragment();
    items.forEach((m) => {
      const a = document.createElement("a");
      a.className = "hv-footer-tag";
      a.href = `${base}/${esc(m.brandSlug)}/${esc(m.modelSlug)}`;
      a.textContent = `${m.brandLabel} ${m.modelLabel}`;
      fragModels.appendChild(a);
    });

    modelsEl.innerHTML = "";
    modelsEl.appendChild(fragModels);
  }

  async function applyFooterFallback(base, family = "hv") {
    if (family !== "hv" || IS_SET_PAGE) return;

    const brandsEl = document.getElementById("hv-footer-brands");
    const modelsEl = document.getElementById("hv-footer-models");
    const labelEl = document.getElementById("hv-footer-models-label");
    if (!brandsEl && !modelsEl) return;

    const hasBrands = brandsEl && brandsEl.children.length > 0;
    const hasModels = modelsEl && modelsEl.children.length > 0;
    if (hasBrands && hasModels) return;

    const fallback = await fetchJson("/data/footer-defaults.json", null);
    if (!fallback || typeof fallback !== "object") return;

    const brands = Array.isArray(fallback.brands) ? fallback.brands : [];
    const models = Array.isArray(fallback.models) ? fallback.models : [];

    if (brandsEl && !hasBrands && brands.length) {
      const frag = document.createDocumentFragment();
      brands.forEach((item) => {
        const slug = esc(item.slug || "");
        const label = item.label || item.slug || "";
        if (!slug || !label) return;
        const a = document.createElement("a");
        a.className = "hv-footer-tag";
        a.href = `${base}/${slug}`;
        a.textContent = label;
        frag.appendChild(a);
      });
      brandsEl.innerHTML = "";
      brandsEl.appendChild(frag);
    }

    if (modelsEl && !hasModels && models.length) {
      const frag = document.createDocumentFragment();
      models.forEach((item) => {
        const makeSlug = esc(item.makeSlug || "");
        const modelSlug = esc(item.modelSlug || "");
        const makeLabel = item.makeLabel || item.makeSlug || "";
        const modelLabel = item.modelLabel || item.modelSlug || "";
        if (!makeSlug || !modelSlug || !makeLabel || !modelLabel) return;
        const a = document.createElement("a");
        a.className = "hv-footer-tag";
        a.href = `${base}/${makeSlug}/${modelSlug}`;
        a.textContent = `${makeLabel} ${modelLabel}`;
        frag.appendChild(a);
      });
      modelsEl.innerHTML = "";
      modelsEl.appendChild(frag);
      if (labelEl) {
        labelEl.textContent = "Populaire modellen waarvoor MAD hulpveren leverbaar zijn.";
      }
    }
  }

  function buildSkuIndex(kits) {
    const map = new Map();
    for (const kit of kits || []) {
      const sku = String(kit?.sku || "").trim().toUpperCase();
      if (!sku || !Array.isArray(kit?.fitments)) continue;
      let makeMap = map.get(sku);
      if (!makeMap) {
        makeMap = new Map();
        map.set(sku, makeMap);
      }
      for (const f of kit.fitments) {
        const makeLabel = String(f?.make || "").trim();
        const modelLabel = String(f?.model || "").trim();
        const makeSlug = slugify(makeLabel);
        if (!makeSlug || !modelLabel) continue;
        const existing = makeMap.get(makeSlug);
        if (!existing || modelLabel.length > existing.length) {
          makeMap.set(makeSlug, modelLabel);
        }
      }
    }
    return map;
  }

  function resolveModelLabel(modelMap, fileSlug) {
    if (!modelMap || typeof modelMap.forEach !== "function") return "";
    let bestSlug = "";
    let bestLabel = "";
    modelMap.forEach((label, slug) => {
      if (fileSlug.includes(slug) && slug.length > bestSlug.length) {
        bestSlug = slug;
        bestLabel = label;
      }
    });
    return bestLabel;
  }

  function humanizeFileLabel(baseName, makeLabel) {
    const cleaned = baseName
      .replace(/[_]+/g, " ")
      .replace(/-+/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\b(hulpveren|verhogingsveren|voor|met|koni|schokdempers|set)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!cleaned) return makeLabel;
    const hasMake =
      makeLabel &&
      cleaned.toLowerCase().includes(String(makeLabel).toLowerCase());
    return hasMake ? cleaned : `${makeLabel} ${cleaned}`.trim();
  }

  async function insertGemonteerdGallery({ route, makes, kits }) {
    if (
      !route ||
      (route.kind !== "make" && route.kind !== "model" && route.kind !== "plate")
    )
      return;
    const footer = document.querySelector("footer");
    if (!footer) return;
    if (document.getElementById("mounted-gallery")) return;

    const manifest = await fetchJson(GEMONTEERD_MANIFEST_URL, []);
    if (!Array.isArray(manifest) || !manifest.length) return;

    const makeSlug = route.make;
    const makeEntry = makes && makes.get ? makes.get(makeSlug) : null;
    const makeLabel = makeEntry?.label || makeSlug;
    const modelMap = makeEntry?.models || new Map();
    const modelSlug =
      route.kind === "model" || route.kind === "plate" ? route.model : "";
    const modelLabel = modelSlug ? (modelMap.get(modelSlug) || "") : "";
    const skuIndex = SKU_INDEX || (kits ? buildSkuIndex(kits) : null);
    if (!SKU_INDEX && skuIndex) SKU_INDEX = skuIndex;

    const cards = [];
    const seen = new Set();

    manifest.forEach((fileName) => {
      const baseName = String(fileName || "").replace(/\.[^.]+$/, "");
      const fileSlug = slugify(baseName);
      if (!fileSlug) return;
      if (seen.has(fileName)) return;

      const skuMatch = baseName.match(/([A-Za-z]{2,}-\d+)/);
      const sku = skuMatch ? skuMatch[1].toUpperCase() : "";

      let include = false;
      let label = makeLabel;
      const fileModelLabel = resolveModelLabel(modelMap, fileSlug);

      const matchesMake = makeSlug && fileSlug.includes(makeSlug);
      const matchesModel = modelSlug && fileSlug.includes(modelSlug);
      let matchesSku = false;
      let skuModelLabel = "";

      if (sku && skuIndex && skuIndex.has(sku)) {
        const skuMakeMap = skuIndex.get(sku);
        if (skuMakeMap && skuMakeMap.has(makeSlug)) {
          matchesSku = true;
          skuModelLabel = skuMakeMap.get(makeSlug) || "";
        }
      }

      // Model/plate pagina: alleen als foto expliciet model of SKU voor dit merk raakt
      if (route.kind === "model" || route.kind === "plate") {
        if (matchesModel || (matchesMake && matchesModel) || (matchesSku && (!modelSlug || slugify(skuModelLabel) === modelSlug))) {
          include = true;
          if (matchesSku && skuModelLabel) {
            label = `${makeLabel} ${skuModelLabel}`;
          } else if (modelLabel) {
            label = `${makeLabel} ${modelLabel}`;
          } else if (fileModelLabel) {
            label = `${makeLabel} ${fileModelLabel}`;
          } else {
            label = humanizeFileLabel(baseName, makeLabel);
          }
        }
      } else {
        // Merkpagina: alleen foto’s met merk in bestandsnaam of SKU die bij het merk hoort
        if (matchesMake || matchesSku) {
          include = true;
          if (matchesSku && skuModelLabel) {
            label = `${makeLabel} ${skuModelLabel}`;
          } else if (fileModelLabel) {
            label = `${makeLabel} ${fileModelLabel}`;
          } else {
            label = humanizeFileLabel(baseName, makeLabel);
          }
        }
      }

      if (!include) return;
      seen.add(fileName);

      const alt = `Gemonteerde set voor ${label}`;
      cards.push({
        src: `${GEMONTEERD_BASE}/${fileName}`,
        alt,
        label,
      });
    });

    if (!cards.length) return;

    const section = document.createElement("section");
    section.className = "page-section mounted-gallery";
    section.id = "mounted-gallery";
    const headingLabel = modelLabel ? `${makeLabel} ${modelLabel}` : makeLabel;
    section.innerHTML = `
      <h2>Gemonteerd op ${esc(headingLabel)}</h2>
      <p>Voorbeelden van gemonteerde sets voor ${esc(headingLabel)}. Bekijk de uitvoering en afwerking in de praktijk.</p>
      <div class="mounted-grid"></div>
    `;

    const grid = section.querySelector(".mounted-grid");
    if (cards.length === 1) grid.classList.add("is-single");
    cards.forEach((c) => {
      const card = document.createElement("figure");
      card.className = "mounted-card";
      card.innerHTML = `
        <img src="${c.src}" alt="${esc(c.alt)}" loading="lazy" decoding="async" />
        <figcaption class="mounted-caption">${esc(c.label)}</figcaption>
      `;
      grid.appendChild(card);
    });

    footer.parentNode.insertBefore(section, footer);
  }

  function findMakeMatch(fileSlug, makes) {
    let best = null;
    if (!makes || typeof makes.forEach !== "function") return best;
    makes.forEach((data, slug) => {
      if (fileSlug.includes(slug)) {
        if (!best || slug.length > best.slug.length) {
          best = { slug, label: data.label, models: data.models };
        }
      }
    });
    return best;
  }

  async function insertExperienceGallery({ makes, kits }) {
    const host = document.getElementById("experience-mounted");
    if (!host) return;
    if (host.dataset.filled === "1") return;
    host.dataset.filled = "1";

    const manifest = await fetchJson(GEMONTEERD_MANIFEST_URL, []);
    if (!Array.isArray(manifest) || !manifest.length) return;

    const skuIndex = SKU_INDEX || (kits ? buildSkuIndex(kits) : null);
    if (!SKU_INDEX && skuIndex) SKU_INDEX = skuIndex;

    const items = [];
    manifest.forEach((fileName) => {
      const baseName = String(fileName || "").replace(/\.[^.]+$/, "");
      const fileSlug = slugify(baseName);
      if (!fileSlug) return;

      const skuMatch = baseName.match(/([A-Za-z]{2,}-\d+)/);
      const sku = skuMatch ? skuMatch[1].toUpperCase() : "";

      let makeLabel = "";
      let modelLabel = "";

      const makeMatch = findMakeMatch(fileSlug, makes);
      if (makeMatch) {
        makeLabel = makeMatch.label;
        modelLabel = resolveModelLabel(makeMatch.models, fileSlug);
      } else if (sku && skuIndex && skuIndex.has(sku)) {
        const skuMakeMap = skuIndex.get(sku);
        if (skuMakeMap && skuMakeMap.size) {
          const entries = Array.from(skuMakeMap.entries()).sort((a, b) =>
            String(a[0]).localeCompare(String(b[0]), "nl")
          );
          const [makeSlug, mLabel] = entries[0];
          const makeEntry = makes && makes.get ? makes.get(makeSlug) : null;
          makeLabel = makeEntry?.label || makeSlug;
          modelLabel = mLabel || "";
        }
      }

      let label = "";
      if (makeLabel && modelLabel) {
        label = `${makeLabel} ${modelLabel}`;
      } else if (makeLabel) {
        label = humanizeFileLabel(baseName, makeLabel);
      } else if (sku) {
        label = `Set ${sku}`;
      } else {
        label = humanizeFileLabel(baseName, "");
      }

      items.push({
        src: `${GEMONTEERD_BASE}/${fileName}`,
        alt: `Gemonteerde set ${label}`.trim(),
        label,
        sortMake: makeLabel || "zzzz",
        sortModel: modelLabel || "zzzz",
        sortFile: baseName,
      });
    });

    const sorted = items.sort((a, b) => {
      const byMake = a.sortMake.localeCompare(b.sortMake, "nl");
      if (byMake) return byMake;
      const byModel = a.sortModel.localeCompare(b.sortModel, "nl");
      if (byModel) return byModel;
      return a.sortFile.localeCompare(b.sortFile, "nl");
    });

    host.innerHTML = `
      <h2>Gemonteerd per merk &amp; model</h2>
      <p>Een overzicht van gemonteerde sets, gesorteerd op merk en model.</p>
      <div class="mounted-grid"></div>
    `;

    const grid = host.querySelector(".mounted-grid");
    if (!grid) return;
    if (sorted.length === 1) grid.classList.add("is-single");
    sorted.forEach((c) => {
      const card = document.createElement("figure");
      card.className = "mounted-card";
      card.innerHTML = `
        <img src="${c.src}" alt="${esc(c.alt)}" loading="lazy" decoding="async" />
        <figcaption class="mounted-caption">${esc(c.label)}</figcaption>
      `;
      grid.appendChild(card);
    });
  }

  const wrap = (html) => `<section class="wrap">${html}</section>`;
  const grid = (html) => `<div class="grid">${html}</div>`;
  const heroTitleEl = document.querySelector(".hero h1");
  const heroLeadEl = document.querySelector(".hero .lead");

  function updateHero(makeLabel, modelLabel) {
    if (heroTitleEl) {
      heroTitleEl.textContent = modelLabel
        ? `${makeLabel} ${modelLabel} hulpveren`
        : `${makeLabel} hulpveren`;
    }
    if (heroLeadEl) {
      heroLeadEl.textContent = modelLabel
        ? `Filter op bouwjaar en gebruik. Kies je set inclusief montage voor de ${makeLabel} ${modelLabel}.`
        : `Kies je model en vind de juiste hulpveren voor ${makeLabel}. Filter op bouwjaar en gebruik, plan direct montage.`;
    }
  }

  function positionKey(k) {
    const raw = Array.isArray(k?.position) ? k.position.join(",") : k?.position;
    const blob = String(raw || "").toLowerCase();
    const hasFront = /\bfront\b/.test(blob);
    const hasRear = /\brear\b/.test(blob);
    if (hasFront && hasRear) return "both";
    if (hasFront) return "front";
    if (hasRear) return "rear";
    return "rear";
  }

  function positionNL(pos) {
    const p = String(pos || "").toLowerCase();
    if (p === "rear") return "Achteras";
    if (p === "front") return "Vooras";
    if (p === "both") return "Voor & achteras";
    return pos ? String(pos) : "-";
  }

  function normalizeApproval(raw) {
    const s = String(raw || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z]/g, "");
    if (!s) return "";
    const hasRDW = s.includes("RDW");
    const hasTUV = s.includes("TUV");
    if (hasRDW && hasTUV) return "RDW+TUV";
    if (hasRDW) return "RDW";
    if (hasTUV) return "TUV";
    return s;
  }

  function approvalNL(a) {
    const key = normalizeApproval(a);
    if (!key) return "-";
    if (key === "RDW+TUV") return "RDW + TÜV";
    if (key === "TUV") return "TÜV";
    return key;
  }

  function yearsNL(f) {
    const a = (f?.year_from || "").trim();
    const b = (f?.year_to || "").trim();
    if (!a && !b) return "—";
    return b ? `${a} — ${b}` : `${a} —`;
  }

  function platformNL(f) {
    const arr = Array.isArray(f?.platform_codes)
      ? f.platform_codes.filter(Boolean)
      : [];
    return arr.length ? arr.join(", ") : "—";
  }

  /* ================== Slimme tekst-parser (uit oude site) ================== */

  function tokenizeMeta() {
    const out = [];
    for (let i = 0; i < arguments.length; i++) {
      let t = arguments[i];
      if (!t) continue;
      t = String(t)
        .replace(/\u00A0/g, " ")
        .replace(/Incl\.(?=\S)/gi, "Incl. ")
        .replace(/Excl\.(?=\S)/gi, "Excl. ")
        .replace(/[;|/]+/g, ",")
        .replace(/\s*,\s*/g, ",")
        .trim();
      if (!t) continue;
      t.split(",").forEach((p) => {
        p = String(p).trim();
        if (p) out.push(p);
      });
    }
    return out;
  }

  /* ================== Ondersteuning: Leeg & beladen / Continue beladen ================== */

  function supportModeFromFit(f) {
    const raw = [f?.notes, f?.remark].filter(Boolean).join(" ");
    const blob = raw.toLowerCase();

    const isMinLoad = /\b(min\.?\s*load|min(?:imum)?\s*load|min\.?\s*belading|minimale\s*belading|maximum\s*support)\b/.test(
      blob
    );
    if (isMinLoad) return "continue";

    const toks = tokenizeMeta(f?.notes, f?.remark).map((t) =>
      String(t).toLowerCase()
    );

    const isContinue = toks.some((t) =>
      /\b(continue\s*beladen|constante\s*belast|permanent\s*beladen|constant\s*load|fixed\s*load|permanent\s*load)\b/.test(
        t
      )
    );

    const isLeegBeladen = toks.some((t) =>
      /\b(leeg\s*(?:&|en|\/)\s*beladen|empty\s*(?:&|and|\/)\s*loaded)\b/.test(t)
    );

    if (isContinue && !isLeegBeladen) return "continue";
    if (isLeegBeladen && !isContinue) return "leeg";
    if (isContinue && isLeegBeladen) return "continue";
    return null;
  }

  function supportKeyOf(f, k) {
    const m = supportModeFromFit(f);
    if (m) return m;
    const fc = String((k && k.family_code) || "").toUpperCase();
    if (fc === "SD" || fc === "LV") return "continue";
    return "leeg";
  }

  function nlSupportFromFit(f, k) {
    const key = supportKeyOf(f, k);
    if (key === "leeg")
      return "Leeg & beladen — comfortabel onbeladen; extra steun bij lading";
    if (key === "continue")
      return "Continue beladen — compenseert constante/permanente belasting";
    return "";
  }

  function supportLabel(kit, fitment) {
    const key = supportKeyOf(fitment, kit);
    if (key === "continue") return "Continue beladen";
    if (key === "leeg") return "Leeg & beladen";
    return "Leeg & beladen";
  }

  /* ================== Motor-detectie ================== */

  const ENGINE_SYNONYMS = {
    benzine: ["benzine", "petrol", "gasoline", "essence", "tsi", "mpi", "tfsi"],
    diesel: ["diesel", "tdi", "dci", "tdci", "hdi"],
    phev: ["plug-in hybrid", "plug in hybrid", "phev", "e-hybrid", "e hybrid"],
    hybrid: ["hybrid", "hybride", "hev", "mhev", "mild hybrid", "mild-hybrid"],
    electric: [
      "electric",
      "ev",
      "bev",
      "elektrisch",
      "e-golf",
      "egolf",
      "id.3",
      "id3",
      "id.4",
      "id4",
      "id-3",
      "id-4",
    ],
  };

  const ENGINE_LABELS = {
    electric: "Electric",
    phev: "Plug-in Hybrid",
    hybrid: "Hybrid",
    benzine: "Benzine",
    diesel: "Diesel",
  };

  const ENGINE_LABEL_ORDER = [
    "Electric",
    "Plug-in Hybrid",
    "Hybrid",
    "Benzine",
    "Diesel",
  ];

  function engineKeyFromString(s) {
    const t = String(s || "").toLowerCase();
    if (ENGINE_SYNONYMS.electric.some((k) => t.includes(k))) return "electric";
    if (ENGINE_SYNONYMS.phev.some((k) => t.includes(k))) return "phev";
    if (ENGINE_SYNONYMS.hybrid.some((k) => t.includes(k))) return "hybrid";
    if (ENGINE_SYNONYMS.diesel.some((k) => t.includes(k))) return "diesel";
    if (ENGINE_SYNONYMS.benzine.some((k) => t.includes(k))) return "benzine";
    return null;
  }

  function detectEngine(token) {
    const s = String(token || "");
    const m = s.match(/^\s*(engine|motor)\s*:\s*(.+)$/i);
    return engineKeyFromString(m ? m[2] : s);
  }

  function enginePolicyFromFit(f, k) {
    const ALL = new Set(["electric", "phev", "hybrid", "benzine", "diesel"]);
    const toks = tokenizeMeta(f?.notes, f?.remark);
    let onlyMode = false;
    let sawAll = false;
    const inc = new Set();
    const exc = new Set();

    for (const raw of toks) {
      const s = String(raw || "").trim();
      if (/^(engine|motor)\s*:\s*all$/i.test(s)) {
        sawAll = true;
        continue;
      }
      const pm = s.match(
        /^\s*(excl(?:usief)?|except|without|niet voor|only|alleen|ook voor)\s*[:\-]?\s*(.+)$/i
      );
      const payload = pm ? pm[2] : s;
      const keyRaw = detectEngine(payload);
      if (!keyRaw) continue;
      const key = String(keyRaw).toLowerCase();

      if (pm) {
        const pol = pm[1].toLowerCase();
        if (pol === "only" || pol === "alleen") {
          onlyMode = true;
          inc.add(key);
        } else if (pol === "ook voor") {
          inc.add(key);
        } else {
          exc.add(key);
        }
      } else {
        inc.add(key);
      }
    }

    let allow;
    if (onlyMode && inc.size) {
      allow = new Set(inc);
    } else if (inc.size) {
      allow = new Set([...inc].filter((k2) => !exc.has(k2)));
    } else if (exc.size) {
      allow = new Set([...ALL].filter((k2) => !exc.has(k2)));
    } else if (sawAll) {
      allow = new Set(ALL);
    } else {
      allow = new Set();
    }

    const deny = new Set([...ALL].filter((k2) => exc.has(k2)));

    const toLabels = (arr) =>
      arr
        .map((k) => ENGINE_LABELS[k])
        .filter(Boolean)
        .sort(
          (a, b) => ENGINE_LABEL_ORDER.indexOf(a) - ENGINE_LABEL_ORDER.indexOf(b)
        );

    return {
      allowKeys: new Set(allow),
      allowLabels: toLabels([...allow]),
      denyLabels: toLabels([...deny]),
    };
  }

  function enginesFromKitAndNotes(kit, fitment) {
    const baseArr = Array.isArray(kit?.powertrains_allowed)
      ? kit.powertrains_allowed.filter(Boolean)
      : [];
    const baseSet = new Set(baseArr);

    const pol = enginePolicyFromFit(fitment, kit);
    const allow = pol.allowLabels || [];
    const deny = pol.denyLabels || [];

    let labels = [];

    if (baseSet.size) {
      if (allow.length) {
        labels = allow.filter((lbl) => baseSet.has(lbl));
        if (!labels.length) labels = Array.from(baseSet);
      } else {
        labels = Array.from(baseSet);
      }

      if (deny.length) {
        const denySet = new Set(deny);
        labels = labels.filter((lbl) => !denySet.has(lbl));
      }
    } else {
      labels = allow.slice();
    }

    if (!labels.length) return ["—"];

    labels.sort(
      (a, b) => ENGINE_LABEL_ORDER.indexOf(a) - ENGINE_LABEL_ORDER.indexOf(b)
    );

    return labels;
  }

  /* ================== Extra chips ================== */

  function splitTags(s) {
    return String(s || "")
      .split(/[,;•]+/g)
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 10);
  }

  function chipClass(txt) {
    const t = String(txt || "").toLowerCase();
    if (t.includes("excl") || t.includes("niet")) return "danger";
    return "ok";
  }

  /* ================== Afbeeldingen: SKU + fallback laatste cijfer ================== */

  function fallbackFilesForSkuByLastDigit(sku) {
    const m = String(sku || "").match(/HV-(\d+)/i);
    if (!m) return ["HV-0.jpg"];

    const digits = m[1];
    const last = digits.slice(-1);

    switch (last) {
      case "0":
        return ["HV-0.jpg"];
      case "1":
      case "2":
        return ["HV-1.jpg"];
      case "3":
      case "4":
      case "6":
      case "7":
        return ["HV-3-7.jpg"];
      case "5":
        return ["HV-5.jpg", "HV-5(2).jpg"];
      case "8":
      case "9":
        return ["HV-8.jpg"];
      default:
        return ["HV-0.jpg"];
    }
  }

  function imageCandidatesForSku(sku) {
    const s = String(sku || "").trim();
    const files = [`${s}.jpg`, `${s}.png`, `${s}.webp`];
    const fbFiles = fallbackFilesForSkuByLastDigit(sku);
    fbFiles.forEach((f) => files.push(f));

    const urls = [];
    for (const base of IMAGE_BASES) {
      for (const file of files) urls.push(base + file);
    }
    return urls;
  }

  function sdFallbackForKit(kit) {
    const sku = String(kit?.sku || "").toUpperCase();
    if (!sku.startsWith("SD-")) return "";
    const pos = String(kit?.position || kit?.axle || kit?.axleConfig || "").toLowerCase();
    if (pos.includes("front") || pos.includes("voor")) {
      return "/assets/img/HV-kits/sd-front.png";
    }
    if (pos.includes("rear") || pos.includes("achter")) {
      return "/assets/img/HV-kits/sd-rear.png";
    }
    return "/assets/img/HV-kits/sd-front.png";
  }

  /* ================== Aandrijving-detectie (FWD/RWD/4WD) ================== */

  const DRIVE_SYNONYMS = {
    FWD: [
      "fwd",
      "front wheel drive",
      "front-wheel drive",
      "voorwielaandrijving",
      "voorwiel",
      "vorderradantrieb",
      "traction avant",
    ],
    RWD: [
      "rwd",
      "rear wheel drive",
      "rear-wheel drive",
      "achterwielaandrijving",
      "achterwiel",
      "hinterradantrieb",
      "propulsion",
    ],
    "4WD": [
      "4wd",
      "awd",
      "4x4",
      "4x4i",
      "all wheel drive",
      "all-wheel drive",
      "vierwielaandrijving",
      "quattro",
      "xdrive",
      "4matic",
      "4motion",
      "all4",
    ],
  };

  function driveKeyFromString(s) {
    const t = String(s || "").toLowerCase();
    for (const key of Object.keys(DRIVE_SYNONYMS)) {
      if (DRIVE_SYNONYMS[key].some((k) => t.includes(k))) return key;
    }
    return null;
  }

  function normalizeDriveTypeKey(dt) {
    const s = String(dt || "").toUpperCase();
    if (s === "AWD" || s === "4WD" || s === "4X4") return "4WD";
    if (s === "FWD") return "FWD";
    if (s === "RWD") return "RWD";
    return "";
  }

  function driveFilterKeyFromVehicle(vehicle, driveException) {
    if (!vehicle) return "";
    const key = normalizeDriveTypeKey(vehicle.driveType || "");
    if (!key) return "";
    if (key === "4WD") return "4WD";
    if (driveException) return key;
    return "2WD";
  }

  function drivePolicyFromFit(f, k) {
    const ALL = new Set(["FWD", "RWD", "4WD"]);
    const inc = new Set();
    const exc = new Set();
    let onlyMode = false;
    let sawIncl4wd = false;

    const toks = tokenizeMeta(
      f?.notes,
      f?.remark,
      k?.notes,
      k?.title,
      k?.name
    );

    toks.forEach((raw) => {
      const s = String(raw || "");
      if (/\bincl\.?\s*(?:4wd|awd|4x4)/i.test(s)) {
        // "Incl. 4WD" betekent Ã³Ã³k 2WD varianten zijn toegestaan
        sawIncl4wd = true;
      }
      if (/\b2\s*wd\b.*\b4\s*wd\b|\b4\s*wd\b.*\b2\s*wd\b/i.test(s)) {
        // "2WD & 4WD" (of varianten) betekent beide varianten zijn toegestaan
        sawIncl4wd = true;
      }
      const m = s.match(
        /^\s*(excl(?:usief)?|except|without|niet\s*voor|alleen|only|ook\s*voor)\s*[:\-]?\s*(.+)$/i
      );
      if (m) {
        const pol = m[1].toLowerCase();
        const key = driveKeyFromString(m[2]);
        if (!key) return;
        if (pol === "alleen" || pol === "only") {
          onlyMode = true;
          inc.clear();
          inc.add(key);
        } else if (pol === "ook voor") {
          inc.add(key);
        } else {
          exc.add(key);
        }
        return;
      }
      const k2 = driveKeyFromString(s);
      if (k2) inc.add(k2);
    });

    let allow;
    if (onlyMode && inc.size) allow = new Set(inc);
    else if (inc.size) allow = new Set([...inc].filter((k2) => !exc.has(k2)));
    else if (exc.size)
      allow = new Set([...ALL].filter((k2) => !exc.has(k2)));
    else allow = new Set();

    // "Incl. 4WD" duidt op 2WD + 4WD toepasbaarheid, tenzij expliciet anders
    if (!onlyMode && sawIncl4wd && !exc.size) {
      allow = new Set(ALL);
    }

    return { allowLabels: Array.from(allow) };
  }

  function isDriveException(makeSlug, modelSlug) {
    const make = String(makeSlug || "").toLowerCase();
    const model = String(modelSlug || "").toLowerCase();
    return (
      (make === "ford" && model === "transit") ||
      (make === "mercedes-benz" && model === "sprinter") ||
      (make === "volkswagen" && model === "crafter")
    );
  }

  function driveLabelsForDisplay(labels, makeSlug, modelSlug) {
    const allow = new Set(labels || []);
    if (isDriveException(makeSlug, modelSlug)) {
      return Array.from(allow);
    }
    const has2wd = allow.has("FWD") || allow.has("RWD") || allow.has("2WD");
    const out = [];
    if (has2wd) out.push("2WD");
    if (allow.has("4WD")) out.push("4WD");
    return out.length ? out : Array.from(allow);
  }

  function driveChipItems(allowSet, makeSlug, modelSlug) {
    const labels = driveLabelsForDisplay(Array.from(allowSet || []), makeSlug, modelSlug);
    return labels.map((lbl) => ({ key: lbl, label: lbl }));
  }

  /* ================== Enkel / Dubbellucht-detectie ================== */

  const RW_SYNONYMS = {
    srw: [
      "srw",
      "single rear wheel",
      "single rear wheels",
      "single rear",
      "single rear-wheel",
      "enkel lucht",
      "enkellucht",
      "enkel- lucht",
      "enkel achterwiel",
      "enkel achterwielen",
      "single wheel rear",
      "single wheel",
    ],
    drw: [
      "drw",
      "dually",
      "dual rear wheel",
      "dual rear wheels",
      "twin rear wheel",
      "twin rear wheels",
      "dubbel lucht",
      "dubbellucht",
      "dubbel- lucht",
      "dubbele lucht",
      "dubbel achterwiel",
      "dubbele achterwielen",
    ],
  };

  function rwKeyFromString(s) {
    const t = String(s || "")
      .toLowerCase()
      .replace(/\bluchtvering\b/g, " ")
      .replace(/\bair\s*suspension\b/g, " ");
    const hit = (arr) => arr.some((k) => t.includes(k));
    if (hit(RW_SYNONYMS.drw)) return "drw";
    if (hit(RW_SYNONYMS.srw)) return "srw";
    return null;
  }

  function rearWheelsPolicyFrom(f, k, strict = false) {
    const ALL = new Set(["srw", "drw"]);
    const blob = [f?.remark, f?.notes, k?.notes, k?.title, k?.name]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .replace(/\bluchtvering\b/g, " ")
      .replace(/\bair\s*suspension\b/g, " ");
    const toks = tokenizeMeta(
      f?.notes,
      f?.remark,
      k?.notes,
      k?.title,
      k?.name
    );

    let onlyMode = false;
    const inc = new Set();
    const exc = new Set();

    toks.forEach((raw) => {
      const s = String(raw || "").toLowerCase();
      let m = s.match(/^\s*(alleen|only)\s*(?:voor)?\s*[:\-]?\s*(.+)$/i);
      if (m) {
        const key = rwKeyFromString(m[2]);
        if (key) {
          onlyMode = true;
          inc.clear();
          inc.add(key);
        }
        return;
      }
      m = s.match(
        /^\s*(niet\s*voor|excl(?:\.|usief)?|except|without|zonder)\s*[:\-]?\s*(.+)$/i
      );
      if (m) {
        const key = rwKeyFromString(m[2]);
        if (key) exc.add(key);
        return;
      }
      const k2 = rwKeyFromString(s);
      if (k2) inc.add(k2);
    });

    [
      {
        re: /\b(alleen|only)\b[^a-z]*?(enkel(?:e)?\s*lucht|single\s+rear(?:\s+wheel)?s?)\b/i,
        key: "srw",
        mode: "only",
      },
      {
        re: /\b(alleen|only)\b[^a-z]*?(dubbel(?:e)?\s*lucht|dual|twin|dually|drw)\b/i,
        key: "drw",
        mode: "only",
      },
      {
        re: /\b(niet\s*voor|excl(?:\.|usief)?|except|without|zonder)\b[^a-z]*?(dubbel(?:e)?\s*lucht|dual|twin|dually|drw)\b/i,
        key: "drw",
        mode: "deny",
      },
      {
        re: /\b(niet\s*voor|excl(?:\.|usief)?|except|without|zonder)\b[^a-z]*?(enkel(?:e)?\s*lucht|single\s+rear(?:\s+wheel)?s?|srw)\b/i,
        key: "srw",
        mode: "deny",
      },
    ].forEach((rule) => {
      const m = blob.match(rule.re);
      if (!m) return;
      if (rule.mode === "only") {
        onlyMode = true;
        inc.clear();
        inc.add(rule.key);
      } else if (rule.mode === "deny") {
        exc.add(rule.key);
      }
    });

    let allow;
    if (onlyMode && inc.size) allow = new Set(inc);
    else if (inc.size) allow = new Set([...inc].filter((k2) => !exc.has(k2)));
    else if (exc.size)
      allow = new Set([...ALL].filter((k2) => !exc.has(k2)));
    else if (strict) allow = new Set();
    else allow = new Set(["srw"]);

    return { allow, deny: exc };
  }

  /* ================== Filter state ================== */

  const FILTER = {
    year: null, // nummer of null
    yearRange: null, // { from, to, label, source } of null
    support: new Set(), // 'leeg' | 'continue'
    drive: new Set(), // 'FWD' | 'RWD' | '4WD'
    rear: new Set(), // 'srw' | 'drw'
    pos: new Set(), // 'front' | 'rear' | 'both'
  };
  let YEAR_FILTER_NOTICE = "";
  let CURRENT_ROUTE_CTX = {
    makeSlug: null,
    modelSlug: null,
    driveException: false,
    plate: null,
    vehicleYM: null,
    vehicleRange: null,
    platformCodes: [],
    caddyGeneration: null,
    isCaddy: false,
  };
  const RANGE_FILTER_LOGGED = new Set();
  const RANGE_EMPTY_LOGGED = new Set();

  window.addEventListener("hv:vehicleYearRange", (e) => {
    const detail = e?.detail || {};
    const yearMin = detail.yearMin ?? null;
    const yearMax = detail.yearMax ?? null;
    const source = detail.source || "plate";
    console.log("[filters] got vehicleYearRange", yearMin, yearMax, source);
    if (yearMin == null && yearMax == null) return;
    FILTER.yearRange = {
      from: yearMin,
      to: yearMax,
      label: formatYearRangeLabel({ from: yearMin, to: yearMax }),
      source,
    };
    const elMin = document.querySelector("[name='flt-year-from'], [data-year-min]");
    const elMax = document.querySelector("[name='flt-year-to'], [data-year-max]");
    if (elMin) elMin.value = yearMin ?? "";
    if (elMax) elMax.value = yearMax ?? "";
    const labelEl = document.getElementById("flt-year-label");
    if (labelEl) {
      labelEl.textContent =
        FILTER.yearRange.label || formatYearRangeLabel(FILTER.yearRange) || "Alle";
    }
    updateFilterSummary();
    if (typeof window.applyHvFilters === "function") {
      window.applyHvFilters();
    } else if (typeof window.applyFilters === "function") {
      window.applyFilters();
    } else {
      // fallback: force rerender via event
      window.dispatchEvent(new Event("hv:filtersChanged"));
    }
  });

  function getYearRange(pairs) {
    const currentYear = new Date().getFullYear();
    let min = 9999;
    let max = 0;
    let hasAny = false;
    for (const { f } of pairs) {
      const y1 = +String(f.year_from || "").slice(-4) || 1990;
      const y2 = +String(f.year_to || "").slice(-4) || currentYear;
      if (!y1 && !y2) continue;
      hasAny = true;
      if (y1 < min) min = y1;
      if (y2 > max) max = y2;
    }
    if (!hasAny) {
      min = 1998;
      max = currentYear;
    }
    return { min, max, hasAny };
  }

  function getFitmentRange(fitment) {
    if (!fitment) return null;
    const textRange =
      fitment.fitmentRangeText ??
      fitment.fitment_range ??
      fitment.fitment ??
      fitment.range ??
      fitment.yearRange ??
      fitment.year_range ??
      null;
    const viaText = parseRange(textRange);
    if (viaText) return viaText;
    return parseRange({
      start: fitment?.year_from ?? fitment?.yearFrom ?? fitment?.from ?? null,
      end: fitment?.year_to ?? fitment?.yearTo ?? fitment?.till ?? null,
    });
  }

  function clampRangeMax(current, maxYM) {
    if (!maxYM) return current;
    if (!current) return maxYM;
    const currentValue = toComparable(current);
    const maxValue = toComparable(maxYM);
    if (currentValue == null || maxValue == null) return current;
    return currentValue > maxValue ? maxYM : current;
  }

  function clampRangeMin(current, minYM) {
    if (!minYM) return current;
    if (!current) return minYM;
    const currentValue = toComparable(current);
    const minValue = toComparable(minYM);
    if (currentValue == null || minValue == null) return current;
    return currentValue < minValue ? minYM : current;
  }

  function formatRangeLabel(range) {
    if (!range) return "";
    const start = formatYearMonth(range.start);
    const end = formatYearMonth(range.end);
    return [start, end].filter(Boolean).join(" / ");
  }

  function getPairSku(pair) {
    const raw = pair?.k?.sku ?? pair?.f?.sku ?? pair?.f?.sku_id ?? "";
    return String(raw || "").trim().toUpperCase();
  }

  function getEffectiveVehicleRange(ctx) {
    if (!ctx) return null;
    const base = ctx.vehicleRange || null;
    if (!base) return null;
    if (!ctx.isCaddy || !ctx.caddyGeneration) return base;
    return clampGeneration(base, ctx.caddyGeneration);
  }

  function logRangeExclusion(ctx, pair, vehicleRange, setRange, reason) {
    if (!DEBUG) return;
    if (!ctx || (!ctx.plate && !ctx.vehicleRange)) return;
    const plate = ctx.plate || "";
    const sku = getPairSku(pair) || "set";
    const key = `${plate}|${sku}|${reason || "range"}`;
    if (RANGE_FILTER_LOGGED.has(key)) return;
    RANGE_FILTER_LOGGED.add(key);
    debugLog("plate:range_exclude", {
      plate,
      sku,
      vehicleRange,
      setRange,
      vehicleRangeLabel: formatRangeLabel(vehicleRange),
      setRangeLabel: formatRangeLabel(setRange),
      reason,
    });
  }

  function logRangeEmpty(ctx, allPairs, label) {
    if (!DEBUG) return;
    if (!ctx || (!ctx.plate && !ctx.vehicleRange)) return;
    if (!Array.isArray(allPairs) || !allPairs.length) return;
    const plate = ctx.plate || "";
    const key = `${plate}|${label || "range"}`;
    if (RANGE_EMPTY_LOGGED.has(key)) return;
    RANGE_EMPTY_LOGGED.add(key);
    const effectiveRange = getEffectiveVehicleRange(ctx);
    const sample = allPairs.slice(0, 5).map((pair) => {
      const setRange = getFitmentRange(pair?.f);
      return {
        sku: getPairSku(pair) || "set",
        setRange,
        setRangeLabel: formatRangeLabel(setRange),
      };
    });
    debugLog("plate:range_empty", {
      plate,
      label,
      vehicleRange: effectiveRange,
      vehicleRangeLabel: formatRangeLabel(effectiveRange),
      sample,
    });
  }

  function pairMatchesVehicleContext(pair, ctx) {
    if (!ctx) return true;
    const isCaddy = ctx.isCaddy;
    const generation = ctx.caddyGeneration;
    const vehicleCodes = Array.isArray(ctx.platformCodes) ? ctx.platformCodes : [];
    const setRange = getFitmentRange(pair?.f);
    const vehicleRange = getEffectiveVehicleRange(ctx);

    if (vehicleRange && setRange && !rangesOverlap(vehicleRange, setRange)) {
      logRangeExclusion(
        ctx,
        pair,
        vehicleRange,
        setRange,
        `range overlap mismatch${isCaddy && generation ? ` (gen ${generation})` : ""}`
      );
      return false;
    }

    const setCodes = normalizePlatformCodes(
      pair?.k?.platformCodes ??
        pair?.k?.platform_codes ??
        pair?.f?.platformCodes ??
        pair?.f?.platform_codes ??
        null
    );
    if (vehicleCodes.length && setCodes.length) {
      const intersects = setCodes.some((code) => vehicleCodes.includes(code));
      if (!intersects) {
        logRangeExclusion(ctx, pair, vehicleRange, setRange, "platformcode mismatch");
        return false;
      }
    }

    // TODO: zodra platformCodes per set gevuld zijn, wordt dit een harde match.
    return true;
  }

  function yearOverlap(setFrom, setTill, minY, maxY) {
    const from = Number(setFrom || 0);
    const till = Number(setTill || 9999);
    return !(maxY < from || minY > till);
  }

  function filterPairs(allPairs) {
    YEAR_FILTER_NOTICE = "";
    const ctx = CURRENT_ROUTE_CTX || {};
    const driveException = !!ctx.driveException;
    let yearRange = FILTER.yearRange;
    if (!yearRange) {
      const ctxActive = getActivePlateContext && getActivePlateContext();
      const v = ctxActive && ctxActive.vehicle;
      const minY = v?.yearMin || v?.estimatedYearMin || null;
      const maxY = v?.yearMax || v?.estimatedYearMax || null;
      if (minY && maxY) {
        yearRange = {
          from: minY,
          to: maxY,
          label: formatYearRangeLabel({ from: minY, to: maxY }),
          source: v.yearSource || "plate_est",
        };
        FILTER.yearRange = yearRange;
      }
    }
    const rangeFiltered = allPairs.filter(({ k, f }) =>
      pairMatchesVehicleContext({ k, f }, ctx)
    );
    if (rangeFiltered.length === 0 && allPairs.length) {
      logRangeEmpty(ctx, allPairs, "filters");
    }
    const applyFilters = (skipYear) =>
      rangeFiltered.filter(({ k, f }) => {
        const y1 = +String(f.year_from || "").slice(-4) || 1990;
        const y2 = +String(f.year_to || "").slice(-4) || new Date().getFullYear();

        if (!skipYear) {
          if (FILTER.year != null) {
            if (FILTER.year < y1 || FILTER.year > y2) return false;
          } else if (yearRange && (yearRange.from != null || yearRange.to != null)) {
            const rangeFrom = yearRange.from ?? yearRange.to;
            const rangeTo = yearRange.to ?? yearRange.from;
            if (rangeFrom != null && rangeTo != null) {
              if (!yearOverlap(y1, y2, rangeFrom, rangeTo)) {
                return false;
              }
            }
          }
        }
        if (FILTER.support.size) {
          const mode = supportKeyOf(f, k);
          if (!FILTER.support.has(mode)) return false;
        }
        if (FILTER.drive.size) {
          const pol = drivePolicyFromFit(f, k);
          const allow = new Set(
            pol.allowLabels && pol.allowLabels.length
              ? pol.allowLabels
              : ["FWD", "RWD", "4WD"]
          );
          if (!driveException && (allow.has("FWD") || allow.has("RWD"))) {
            allow.add("2WD");
          }
          let ok = false;
          for (const wanted of FILTER.drive) {
            if (wanted === "2WD") {
              if (
                allow.has("2WD") ||
                (!driveException && (allow.has("FWD") || allow.has("RWD")))
              ) {
                ok = true;
                break;
              }
            } else if (allow.has(wanted)) {
              ok = true;
              break;
            }
          }
          if (!ok) return false;
        }
        if (FILTER.rear.size) {
          const wantsSRW = FILTER.rear.has("srw");
          const strict = !wantsSRW;
          const pol = rearWheelsPolicyFrom(f, k, strict);
          let ok = false;
          for (const wanted of FILTER.rear) {
            if (pol.allow.has(wanted)) {
              ok = true;
              break;
            }
          }
          if (!ok) return false;
        }
        if (FILTER.pos.size) {
          const posKey = positionKey(k);
          if (!FILTER.pos.has(posKey)) return false;
        }
        return true;
      });

    const filtered = applyFilters(false);
    if (
      FILTER.year == null &&
      yearRange &&
      yearRange.source !== "manual" &&
      (yearRange.from != null || yearRange.to != null) &&
      filtered.length === 0
    ) {
      YEAR_FILTER_NOTICE = `Bouwjaar-indicatie ${formatYearRangeLabel(yearRange) || ""} leverde geen matches; tonen alle opties.`;
      return applyFilters(true);
    }
    return filtered;
  }

  function explainPairMatch(pair) {
    const ctx = CURRENT_ROUTE_CTX || {};
    const driveException = !!ctx.driveException;
    const yearRange = FILTER.yearRange;
    const k = pair?.k || {};
    const f = pair?.f || {};
    const reasons = [];
    const isCaddy = ctx.isCaddy;
    const generation = ctx.caddyGeneration;
    const vehicleCodes = Array.isArray(ctx.platformCodes) ? ctx.platformCodes : [];

    const vehicleRange = getEffectiveVehicleRange(ctx);
    const setRange = getFitmentRange(f);
    if (vehicleRange && setRange && !rangesOverlap(vehicleRange, setRange)) {
      const vehicleLabel = formatRangeLabel(vehicleRange) || "kentekenrange";
      const setLabel = formatRangeLabel(setRange) || "setrange";
      reasons.push(`range ${vehicleLabel} overlapt niet met ${setLabel}`);
    }

    const setCodes = normalizePlatformCodes(
      k.platformCodes ?? k.platform_codes ?? f.platformCodes ?? f.platform_codes ?? null
    );
    if (vehicleCodes.length && setCodes.length) {
      const intersects = setCodes.some((code) => vehicleCodes.includes(code));
      if (!intersects) {
        reasons.push(
          `platformcodes ${setCodes.join(",") || "-"} niet in ${vehicleCodes.join(",")}`
        );
      }
    }

    const y1 = +String(f.year_from || "").slice(-4) || 1990;
    const y2 = +String(f.year_to || "").slice(-4) || new Date().getFullYear();
    if (FILTER.year != null) {
      if (FILTER.year < y1 || FILTER.year > y2) {
        reasons.push(`jaar ${FILTER.year} buiten ${y1}-${y2}`);
      }
    } else if (yearRange && (yearRange.from != null || yearRange.to != null)) {
      const rangeFrom = yearRange.from ?? yearRange.to;
      const rangeTo = yearRange.to ?? yearRange.from;
      if (rangeFrom != null && y2 < rangeFrom) {
        reasons.push(`jaar ${rangeFrom}-${rangeTo ?? rangeFrom} buiten ${y1}-${y2}`);
      } else if (rangeTo != null && y1 > rangeTo) {
        reasons.push(`jaar ${rangeFrom ?? rangeTo}-${rangeTo} buiten ${y1}-${y2}`);
      }
    }
    if (FILTER.support.size) {
      const mode = supportKeyOf(f, k);
      if (!FILTER.support.has(mode)) {
        reasons.push(`ondersteuning ${mode || "onbekend"}`);
      }
    }
    if (FILTER.drive.size) {
      const pol = drivePolicyFromFit(f, k);
      const allow = new Set(
        pol.allowLabels && pol.allowLabels.length
          ? pol.allowLabels
          : ["FWD", "RWD", "4WD"]
      );
      if (!driveException && (allow.has("FWD") || allow.has("RWD"))) {
        allow.add("2WD");
      }
      let ok = false;
      for (const wanted of FILTER.drive) {
        if (wanted === "2WD") {
          if (
            allow.has("2WD") ||
            (!driveException && (allow.has("FWD") || allow.has("RWD")))
          ) {
            ok = true;
            break;
          }
        } else if (allow.has(wanted)) {
          ok = true;
          break;
        }
      }
      if (!ok) {
        reasons.push(
          `aandrijving ${Array.from(FILTER.drive).join(",")} niet in ${Array.from(
            allow
          ).join(",")}`
        );
      }
    }
    if (FILTER.rear.size) {
      const wantsSRW = FILTER.rear.has("srw");
      const strict = !wantsSRW;
      const pol = rearWheelsPolicyFrom(f, k, strict);
      let ok = false;
      for (const wanted of FILTER.rear) {
        if (pol.allow.has(wanted)) {
          ok = true;
          break;
        }
      }
      if (!ok) {
        reasons.push(
          `achterwielen ${Array.from(FILTER.rear).join(",")} niet in ${Array.from(
            pol.allow
          ).join(",")}`
        );
      }
    }
    if (FILTER.pos.size) {
      const posKey = positionKey(k);
      if (!FILTER.pos.has(posKey)) {
        reasons.push(`locatie ${posKey || "onbekend"}`);
      }
    }

    return { ok: reasons.length === 0, reasons };
  }

  function formatPairLabel(pair) {
    const sku = String(pair?.k?.sku || "").toUpperCase();
    const make = pair?.f?.make || "";
    const model = pair?.f?.model || "";
    const y1 = String(pair?.f?.year_from || "").trim();
    const y2 = String(pair?.f?.year_to || "").trim();
    const years = y1 || y2 ? `${y1 || ""}-${y2 || ""}`.trim() : "";
    return [sku || "set", make, model, years].filter(Boolean).join(" ");
  }

  function renderPlateDebug({ container, vehicle, allPairs, filtered, meta }) {
    if (!DEBUG) return;
    const target = container || app || ensureAppContainer();
    if (!target) return;
    let root = document.getElementById("plate-debug");
    if (!root) {
      root = document.createElement("details");
      root.id = "plate-debug";
      root.className = "plate-debug";
      root.open = true;
      root.innerHTML =
        "<summary>Debug (kenteken)</summary><div class=\"plate-debug__body\"></div>";
      target.appendChild(root);
    }
    const body = root.querySelector(".plate-debug__body") || root;
    const rejects = [];
    if (Array.isArray(allPairs)) {
      allPairs.forEach((pair) => {
        const res = explainPairMatch(pair);
        if (!res.ok) {
          rejects.push({ pair, reasons: res.reasons });
        }
      });
    }
    const rejectItems = rejects.slice(0, 10).map((entry) => {
      const label = formatPairLabel(entry.pair);
      const reason = entry.reasons.join("; ");
      return `<li><code>${esc(label)}</code> - ${esc(reason)}</li>`;
    });

    const filterSnapshot = {
      plate: meta?.plate || null,
      makeSlug: meta?.makeSlug || null,
      modelSlug: meta?.modelSlug || null,
      source: meta?.source || null,
      vehicleYM: meta?.vehicleYM || null,
      vehicleRange: meta?.vehicleRange || null,
      caddyGeneration: meta?.caddyGeneration || null,
      platformCodes: meta?.platformCodes || null,
      year: FILTER.year,
      yearRange: FILTER.yearRange,
      support: Array.from(FILTER.support),
      drive: Array.from(FILTER.drive),
      rear: Array.from(FILTER.rear),
      pos: Array.from(FILTER.pos),
    };

    body.innerHTML = `
      <div class="note"><strong>Matches:</strong> ${
        Array.isArray(filtered) ? filtered.length : 0
      }</div>
      <div class="note"><strong>Filters:</strong></div>
      <pre>${esc(JSON.stringify(filterSnapshot, null, 2))}</pre>
      <div class="note"><strong>Vehicle:</strong></div>
      <pre>${esc(JSON.stringify(vehicle || null, null, 2))}</pre>
      <div class="note"><strong>Afgewezen (top 10):</strong></div>
      ${
        rejectItems.length
          ? `<ol>${rejectItems.join("")}</ol>`
          : "<div class=\"note\">Geen afgewezen matches.</div>"
      }
    `;
  }

  function updateFilterSummary() {
    const parts = [];
    let yearLabel = "alle";
    if (FILTER.year != null) {
      yearLabel = String(FILTER.year);
    } else if (FILTER.yearRange) {
      const baseLabel =
        FILTER.yearRange.label || formatYearRangeLabel(FILTER.yearRange);
      if (baseLabel) {
        const plateSources = new Set(["plate", "rdw", "plate_est", "aldoc", "aldoc_uitvoering"]);
        yearLabel = plateSources.has(FILTER.yearRange.source)
          ? `${baseLabel} (kenteken)`
          : baseLabel;
      }
    }
    parts.push(`jaar: ${yearLabel}`);
    if (FILTER.support.size) {
      const map = { leeg: "Leeg & beladen", continue: "Continue beladen" };
      parts.push(
        "ondersteuning: " +
          Array.from(FILTER.support)
            .map((k) => map[k] || k)
            .join(", ")
      );
    }
    if (FILTER.drive.size) {
      const driveLabels = Array.from(
        new Set(
          Array.from(FILTER.drive).map((k) => {
            if (!CURRENT_ROUTE_CTX.driveException) {
              if (k === "FWD" || k === "RWD") return "2WD";
              if (k === "2WD") return "2WD";
            }
            return k;
          })
        )
      );
      parts.push("aandrijving: " + driveLabels.join(", "));
    }
    if (FILTER.rear.size) {
      const map = { srw: "enkel", drw: "dubbel" };
      parts.push(
        "achterwielen: " +
          Array.from(FILTER.rear)
            .map((k) => map[k] || k)
            .join(", ")
      );
    }
    if (FILTER.pos.size) {
      const map = {
        front: "vooras",
        rear: "achteras",
        both: "voor & achter",
      };
      parts.push(
        "locatie: " +
          Array.from(FILTER.pos)
          .map((k) => map[k] || k)
          .join(", ")
      );
    }
    const notice = YEAR_FILTER_NOTICE ? ` — ${YEAR_FILTER_NOTICE}` : "";
    const el = document.getElementById("filter-summary");
    if (el) el.textContent = parts.join(" | ") + notice;
  }

  /* ================== Lead-modal (lichte versie) ================== */

  function ensureLeadModal() {
    if (document.getElementById("lead-modal")) return;

    const style = document.createElement("style");
    style.textContent = `
      .hv-modal{position:fixed;inset:0;z-index:1000;display:none;align-items:center;justify-content:center;}
      .hv-modal.on{display:flex;}
      .hv-modal-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.55);}
      .hv-modal-dialog{position:relative;z-index:1;background:#111216;color:#e6e8f0;border-radius:16px;padding:16px;max-width:520px;width:calc(100% - 24px);box-shadow:0 18px 45px rgba(0,0,0,.6);font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial;}
      .hv-modal-dialog h3{margin:0 0 10px;font-size:18px;}
      .hv-modal-close{position:absolute;top:10px;right:10px;background:transparent;border:1px solid rgba(255,255,255,.18);color:inherit;border-radius:999px;padding:4px 10px;cursor:pointer;}
      .hv-modal-summary{font-size:14px;background:#0d0f14;border-radius:10px;border:1px solid rgba(255,255,255,.08);padding:8px 10px;margin-bottom:10px;}
      .hv-modal-summary div{margin:2px 0;}
      .hv-modal-summary b{font-weight:600;}
      .hv-form-row{display:flex;flex-direction:column;gap:4px;margin-bottom:8px;font-size:14px;}
      .hv-form-row label{color:#aab1c3;}
      .hv-form-row input,.hv-form-row textarea{border-radius:10px;border:1px solid rgba(255,255,255,.18);background:#0b0c10;color:#e6e8f0;padding:8px 10px;font:14px system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial;}
      .hv-form-row small{color:#aab1c3;font-size:12px;}
      .hv-btn-row{display:flex;justify-content:flex-end;gap:8px;margin-top:8px;}
      .hv-btn{display:inline-flex;align-items:center;justify-content:center;padding:8px 12px;border-radius:12px;border:0;cursor:pointer;font-weight:600;font-size:14px;}
      .hv-btn.ghost{background:transparent;border:1px solid rgba(255,255,255,.18);color:#e6e8f0;}
      .hv-btn.primary{background:#FAB819;color:#1a1a1a;}
      .hv-msg{display:none;font-size:13px;margin-top:6px;border-radius:10px;padding:6px 8px;}
      .hv-msg.ok{border:1px solid #3ad29f;background:rgba(58,210,159,.14);color:#baf5e2;}
      .hv-msg.err{border:1px solid #ff6b6b;background:rgba(255,107,107,.14);color:#ffd6d6;}
      @media (max-width:600px){
        .hv-modal-dialog{padding:14px;}
      }
    `;
    document.head.appendChild(style);

    const div = document.createElement("div");
    div.id = "lead-modal";
    div.className = "hv-modal";
    div.innerHTML = `
      <div class="hv-modal-backdrop" data-lead-close></div>
      <div class="hv-modal-dialog">
        <button type="button" class="hv-modal-close" data-lead-close>&times;</button>
        <h3>Interesse in deze set</h3>
        <div class="hv-modal-summary">
          <div><b>Set:</b> <span id="lead-sku"></span></div>
          <div><b>Auto:</b> <span id="lead-auto"></span></div>
          <div><b>Platform:</b> <span id="lead-platform"></span></div>
          <div><b>Bouwjaren:</b> <span id="lead-years"></span></div>
        </div>
        <form id="lead-form">
          <div class="hv-form-row">
            <label for="lead-name">Naam</label>
            <input id="lead-name" name="name" type="text" required placeholder="Voor- en achternaam">
          </div>
          <div class="hv-form-row">
            <label for="lead-email">E-mail</label>
            <input id="lead-email" name="email" type="email" required placeholder="naam@voorbeeld.nl">
          </div>
          <div class="hv-form-row">
            <label for="lead-phone">Telefoon</label>
            <input id="lead-phone" name="phone" type="tel" required placeholder="06-…">
          </div>
          <div class="hv-form-row">
            <label for="lead-plate">Kenteken</label>
            <input id="lead-plate" name="plate" type="text" required placeholder="AB-12-CD">
            <small>We gebruiken dit alleen om te controleren of de set past.</small>
          </div>
          <div class="hv-form-row">
            <label for="lead-note">Opmerking (optioneel)</label>
            <textarea id="lead-note" name="note" rows="4" placeholder="Bijv. gewenste datum/tijd, vaste belading, trekhaak, vragen…"></textarea>
          </div>
          <input type="hidden" id="lead-sku-hidden">
          <input type="hidden" id="lead-auto-hidden">
          <input type="hidden" id="lead-platform-hidden">
          <input type="hidden" id="lead-years-hidden">
          <div id="lead-ok" class="hv-msg ok">Bedankt! We hebben je aanvraag klaargezet in je e-mailprogramma.</div>
          <div id="lead-err" class="hv-msg err">Vul alle verplichte velden in.</div>
          <div class="hv-btn-row">
            <button type="button" class="hv-btn ghost" data-lead-close>Annuleren</button>
            <button type="submit" class="hv-btn primary">Versturen</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(div);

    const modal = div;
    const form = modal.querySelector("#lead-form");
    const okMsg = modal.querySelector("#lead-ok");
    const errMsg = modal.querySelector("#lead-err");

    function close() {
      modal.classList.remove("on");
    }

    modal.addEventListener("click", (e) => {
      const t = e.target;
      if (t && t.hasAttribute("data-lead-close")) {
        e.preventDefault();
        close();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.classList.contains("on")) {
        close();
      }
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      okMsg.style.display = "none";
      errMsg.style.display = "none";

      const name = form.querySelector("#lead-name").value.trim();
      const email = form.querySelector("#lead-email").value.trim();
      const phone = form.querySelector("#lead-phone").value.trim();
      const plate = form
        .querySelector("#lead-plate")
        .value.toUpperCase()
        .replace(/\s+/g, "")
        .replace(/[^A-Z0-9-]/g, "");
      const note = form.querySelector("#lead-note").value.trim();

      const sku = form.querySelector("#lead-sku-hidden").value;
      const auto = form.querySelector("#lead-auto-hidden").value;
      const platform = form.querySelector("#lead-platform-hidden").value;
      const years = form.querySelector("#lead-years-hidden").value;

      if (!name || !email || !phone || !plate) {
        errMsg.style.display = "block";
        return;
      }

      const to =
        (window.LEAD_FORM_MAILTO &&
          String(window.LEAD_FORM_MAILTO).trim()) ||
        "info@auto-parts-roosendaal.nl";

      const subj = `Aanvraag MAD hulpveren — ${sku} (${auto})`;
      const body =
        `Beste,\n\n` +
        `Ik heb interesse in MAD hulpveren.\n\n` +
        `Set: ${sku}\n` +
        `Auto: ${auto}\n` +
        `Platform: ${platform || "-"}\n` +
        `Bouwjaren: ${years || "-"}\n\n` +
        `Naam: ${name}\n` +
        `E-mail: ${email}\n` +
        `Telefoon: ${phone}\n` +
        `Kenteken: ${plate}\n\n` +
        `Opmerking:\n${note || "-"}\n\n` +
        `Pagina: ${location.href}\n`;

      const href =
        "mailto:" +
        encodeURIComponent(to) +
        "?subject=" +
        encodeURIComponent(subj) +
        "&body=" +
        encodeURIComponent(body);

      try {
        window.location.href = href.replace(/#.*$/, "");
        okMsg.style.display = "block";
        setTimeout(close, 900);
      } catch (_) {
        okMsg.style.display = "block";
      }
    });
  }

  function openLeadModal(payload) {
    ensureLeadModal();
    const modal = document.getElementById("lead-modal");
    if (!modal) return;

    modal.querySelector("#lead-sku").textContent = payload.sku || "";
    modal.querySelector("#lead-auto").textContent = payload.auto || "";
    modal.querySelector("#lead-platform").textContent = payload.platform || "";
    modal.querySelector("#lead-years").textContent = payload.years || "";

    modal.querySelector("#lead-sku-hidden").value = payload.sku || "";
    modal.querySelector("#lead-auto-hidden").value = payload.auto || "";
    modal.querySelector("#lead-platform-hidden").value =
      payload.platform || "";
    modal.querySelector("#lead-years-hidden").value = payload.years || "";

    modal.querySelector("#lead-ok").style.display = "none";
    modal.querySelector("#lead-err").style.display = "none";

    modal.classList.add("on");

    const nameInput = modal.querySelector("#lead-name");
    if (nameInput) {
      setTimeout(() => nameInput.focus(), 50);
    }
  }

  /* ================== Render: merken ================== */

  function renderBrands(makes) {
    if (!hasApp || !app) return;
    CURRENT_ROUTE_CTX = {
      makeSlug: null,
      modelSlug: null,
      driveException: false,
      plate: null,
      vehicleYM: null,
      vehicleRange: null,
      platformCodes: [],
      caddyGeneration: null,
      isCaddy: false,
    };
    setTitle("Hulpveren per merk | MAD Sets met montage");

    const rows = Array.from(makes.entries())
      .sort((a, b) => a[1].label.localeCompare(b[1].label))
      .map(
        ([makeSlug, v]) => `
        <a class="card" href="${BASE}/${esc(makeSlug)}">
          <div class="t">${esc(v.label)}</div>
          <div class="s">${v.models.size} modellen</div>
        </a>
      `
      )
      .join("");

    app.innerHTML = wrap(`
      <h1>Hulpveren per merk</h1>
      ${grid(rows || `<p>Geen data.</p>`)}
    `);
  }

  /* ================== Render: modellen per merk ================== */

  function renderMake(makes, makeSlug) {
    if (!hasApp || !app) return;
    suppressHomeSectionsForApp();
    CURRENT_ROUTE_CTX = {
      makeSlug,
      modelSlug: null,
      driveException: false,
      plate: null,
      vehicleYM: null,
      vehicleRange: null,
      platformCodes: [],
      caddyGeneration: null,
      isCaddy: false,
    };
    const entry = makes.get(makeSlug);
    if (!entry) return renderBrands(makes);

    setTitle(`Hulpveren - ${entry.label} | MAD Sets met montage`);
    updateHero(entry.label);
    const activeCtx = getActivePlateContext();
    const vehicleActive = Boolean(activeCtx && activeCtx.plate);
    if ((!entry.models || entry.models.size === 0) && vehicleActive) {
      window.location.href = `${BASE}/`;
      return;
    }

    const rows = Array.from(entry.models.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(
        ([modelSlug, modelLabel]) => `
        <a class="card" href="${BASE}/${esc(makeSlug)}/${esc(modelSlug)}">
          <div class="t">${esc(modelLabel)}</div>
          <div class="s">Bekijk sets</div>
        </a>
      `
      )
      .join("");

    app.innerHTML = wrap(`
      <div class="crumbs"><a href="${BASE}">Hulpveren</a> > ${esc(entry.label)}</div>
      <h1>${esc(entry.label)} hulpveren</h1>
      ${grid(rows || `<p>Geen modellen gevonden.</p>`)}
    `);

    hvSeoRenderBrand({ makeLabel: entry.label }, app);
  }

  function buildModelCard(pair, idx, options) {
    const { k, f } = pair;
    const {
      makeLabel,
      modelLabel,
      makeSlug,
      modelSlug,
      showDriveMeta,
      showRearMeta,
    } = options;
    const sku = k?.sku || "";
    const skuSlug = (sku || "").toLowerCase();
    const price = k?.pricing_nl?.total_inc_vat_from_eur;
    const badgeText = priceLabel(price);
    const badge =
      price != null && price !== "" && badgeText !== "Prijs op aanvraag"
        ? badgeText
        : "";

    const chips = [];
    chips.push(
      `<span class="chip small support">${esc(supportLabel(k, f))}</span>`
    );
    splitTags(f?.remark).forEach((txt) =>
      chips.push(
        `<span class="chip small ${chipClass(txt)}">${esc(txt)}</span>`
      )
    );
    splitTags(f?.notes)
      .filter((t) => /excl|niet/i.test(t))
      .forEach((txt) =>
        chips.push(`<span class="chip small danger">${esc(txt)}</span>`)
      );

    const engines =
      Array.isArray(k.powertrains_allowed) && k.powertrains_allowed.length
        ? k.powertrains_allowed
        : enginesFromKitAndNotes(k, f);

    const imgId = `kitimg_${idx}`;
    const autoType = `${makeLabel} ${modelLabel}`.trim();
    const platformText = platformNL(f);
    const yearsText = yearsNL(f);
    const approvalText = approvalClean(k?.approval);
    const supportText = nlSupportFromFit(f, k);
    const fitmentRangeLabel = formatAldocRangeLabel(
      parseAldocDateValue(f?.year_from),
      parseAldocDateValue(f?.year_to)
    );
    const fitmentMake = f?.make || makeLabel;
    const fitmentModel = f?.model || modelLabel;

    const dPol = drivePolicyFromFit(f, k);
    const driveText = driveLabelsForDisplay(
      dPol.allowLabels || [],
      makeSlug,
      modelSlug
    ).join(", ");

    const rwPol = rearWheelsPolicyFrom(f, k, false);
    let rearText = "";
    const hasSRWlocal = rwPol.allow.has("srw");
    const hasDRWlocal = rwPol.allow.has("drw");
    if (hasSRWlocal && hasDRWlocal) rearText = "Enkel of dubbel lucht";
    else if (hasSRWlocal) rearText = "Enkel lucht";
    else if (hasDRWlocal) rearText = "Dubbel lucht";

    const metaRows = [
      buildMetaRow("Soort", k?.family_label || "Hulpveren"),
      buildMetaRow("As", positionNL(positionKey(k))),
      buildMetaRow("Ondersteuning", supportText),
      buildMetaRow("Platform", platformText),
      buildMetaRow("Bouwjaren", yearsText),
      showDriveMeta ? buildMetaRow("Aandrijving", driveText || "-") : "",
      showRearMeta ? buildMetaRow("Achterwielen", rearText || "-") : "",
      buildMetaRow("Goedkeuring", approvalText),
    ]
      .filter(Boolean)
      .join("");

    const enginesHtml = engines.length
      ? `<div class="enginebox">
              <b>Motoren:</b>
              <div class="lst">
                ${engines.map((x) => `<div>${esc(x)}</div>`).join("")}
              </div>
            </div>`
      : `<div class="enginebox"><b>Motoren:</b> <span>Allemaal</span></div>`;

    return `
        <article class="card product" data-sku="${esc(
          sku
        )}" data-fitment-range="${esc(
      fitmentRangeLabel || ""
    )}" data-fitment-make="${esc(fitmentMake || "")}" data-fitment-model="${esc(
      fitmentModel || ""
    )}">
          <div class="img" id="${esc(imgId)}_wrap">
            <img id="${esc(imgId)}" alt="${esc(sku)}" loading="lazy" decoding="async">
            ${badge ? `<div class="badge">${badge}</div>` : ``}
          </div>

          <div class="body">
            <div class="sku">${esc(sku)}</div>

            <div class="meta">
              ${metaRows}
            </div>

            <div class="chips">${chips.join("")}</div>

            ${enginesHtml}

            <div class="pillrow">
              ${approvalText ? `<span class="pill">${esc(approvalText)}</span>` : ``}
              <span class="pill">Prijs: incl. montage &amp; btw</span>
            </div>

            <div class="cta-row">
              <a class="btn ghost" href="/hulpveren/${esc(skuSlug)}/">Bekijk set</a>

              <button
                class="btn"
                type="button"
                data-lead="1"
                data-sku="${esc(sku)}"
                data-auto="${esc(autoType)}"
                data-platform="${esc(platformText)}"
                data-years="${esc(yearsText)}"
              >
                Meer info / afspraak
              </button>
            </div>
          </div>
        </article>
      `;
  }

  function buildNrCard(pair, idx, options) {
    const { k, f } = pair;
    const { makeLabel, modelLabel, makeSlug, modelSlug } = options;
    const y1 = yearToNum(f.year_from);
    const y2 = yearToNum(f.year_to);
    const pos = positionKey(k);
    const approvalText = approvalClean(k?.approval);
    const engine = enginesText(k, f);
    const yearLabel = yearsNL(f);
    const posText = positionNL(pos);
    const usage = nlSupportFromFit(f, k);
    const platformText = platformNL(f);
    const price = priceLabel(k?.pricing_nl?.total_inc_vat_from_eur);
    const imgSrc =
      imageCandidatesForSku(k?.sku)?.[0] || sdFallbackForKit(k) || "/assets/img/HV-kits/HV-0.jpg";
    const sku = k?.sku || "";
    const skuLower = sku.toLowerCase();
    const fitmentRangeLabel = formatAldocRangeLabel(
      parseAldocDateValue(f?.year_from),
      parseAldocDateValue(f?.year_to)
    );
    const fitmentMake = f?.make || makeLabel;
    const fitmentModel = f?.model || modelLabel;
    const contactSubject = makeSlug && modelSlug
      ? `nr-${makeSlug}-${modelSlug}`
      : `nr-${makeSlug || skuLower || "set"}`;

    const metaRows = [
      buildMetaRow("Bouwjaren", yearLabel),
      buildMetaRow("As", posText),
      buildMetaRow("Gebruik", usage),
      buildMetaRow("Platform", platformText),
      buildMetaRow("Motor", engine),
      buildMetaRow("Goedkeuring", approvalText),
    ]
      .filter(Boolean)
      .join("");

    return `
        <article class="card product" data-year-from="${y1 ?? ""}" data-year-to="${
      y2 ?? ""
    }" data-pos="${esc(pos || "")}" data-approval="${esc(
      (approvalText || "").toLowerCase()
    )}" data-engine="${esc(
      (engine || "").toLowerCase()
    )}" data-fitment-range="${esc(
      fitmentRangeLabel || ""
    )}" data-fitment-make="${esc(fitmentMake || "")}" data-fitment-model="${esc(
      fitmentModel || ""
    )}">
          <div class="img">
            <img src="${esc(imgSrc)}" alt="Luchtvering ${esc(
      makeLabel
    )} ${esc(modelLabel)}" loading="lazy" decoding="async" />
            <div class="badge">Inclusief montage</div>
          </div>
          <div class="body">
            <div class="sku">${esc(sku)}</div>
            <div class="meta">
              ${metaRows}
            </div>
            <div class="chips">
              <span class="chip support">Montage &amp; afstelling</span>
              <span class="chip">${esc(price)}</span>
            </div>
            <div class="cta-row">
              <a class="btn btn-ghost" href="/luchtvering/${esc(
                skuLower
              )}/">Bekijk set</a>
              <a class="btn" href="/contact?onderwerp=${esc(
                contactSubject
              )}">Plan mijn set</a>
            </div>
          </div>
        </article>`;
  }

  function buildLsCard(pair, idx, options) {
    const { k, f } = pair;
    const { makeLabel, modelLabel, makeSlug, modelSlug } = options;
    const posKey = positionKey(k);
    const posText = positionNL(posKey);
    const yearLabel = yearsNL(f);
    const approvalText = approvalClean(k?.approval) || "Op aanvraag";
    const price = priceLabel(k?.pricing_nl?.total_inc_vat_from_eur);
    const sku = k?.sku || "";
    const skuLower = sku.toLowerCase();
    const dropFront = k?.suspension_delta_mm?.front_mm;
    const dropRear = k?.suspension_delta_mm?.rear_mm;
    let dropLabel = "-";
    if (dropFront && dropRear) {
      dropLabel = `Voor: ${dropFront} mm &middot; Achter: ${dropRear} mm`;
    } else if (dropFront) {
      dropLabel = `Voor: ${dropFront} mm`;
    } else if (dropRear) {
      dropLabel = `Achter: ${dropRear} mm`;
    }
    const setLabel =
      posKey === "both" ? "4 veren (voor+achter)" : "2 veren";
    const engineLabel =
      f?.engine_raw ||
      (Array.isArray(f?.engines) ? f.engines.filter(Boolean).join(", ") : "") ||
      enginesFromKitAndNotes(k, f).filter((x) => x && x !== "-").join(", ") ||
      "-";
    const imgSrc = "/assets/img/HV-kits/LS-4.jpg";
    const contactSubject = makeSlug && modelSlug
      ? `ls-${makeSlug}-${modelSlug}`
      : `ls-${makeSlug || skuLower || "set"}`;
    const fitmentRangeLabel = formatAldocRangeLabel(
      parseAldocDateValue(f?.year_from),
      parseAldocDateValue(f?.year_to)
    );
    const fitmentMake = f?.make || makeLabel;
    const fitmentModel = f?.model || modelLabel;

    const metaRows = [
      buildMetaRow("Bouwjaren", yearLabel),
      buildMetaRow("Verlaging", dropLabel),
      buildMetaRow("Positie", posText),
      buildMetaRow("Set", setLabel),
      buildMetaRow("Motor", engineLabel),
      buildMetaRow("Goedkeuring", approvalText),
    ]
      .filter(Boolean)
      .join("");

    return `
        <article class="card product" data-fitment-range="${esc(
          fitmentRangeLabel || ""
        )}" data-fitment-make="${esc(fitmentMake || "")}" data-fitment-model="${esc(
          fitmentModel || ""
        )}">
          <div class="img">
            <img src="${esc(imgSrc)}" alt="Verlagingsveren ${esc(
      makeLabel
    )} ${esc(modelLabel)}" loading="lazy" decoding="async" />
            <div class="badge">Inclusief montage</div>
          </div>
          <div class="body">
            <div class="sku">${esc(sku)}</div>
            <div class="meta">
              ${metaRows}
            </div>
            <div class="chips">
              <span class="chip support">Montage &amp; uitlijning</span>
              <span class="chip">${esc(price)}</span>
            </div>
            <div class="cta-row">
              <a class="btn btn-ghost" href="/verlagingsveren/${esc(
                skuLower
              )}/">Bekijk set</a>
              <a class="btn" href="/contact?onderwerp=${esc(
                contactSubject
              )}">Plan mijn set</a>
            </div>
          </div>
        </article>`;
  }

  function buildGenericSkuCard({ sku, familyLabel, makeLabel, modelLabel }) {
    const autoLabel = [makeLabel, modelLabel].filter(Boolean).join(" ").trim();
    const title = sku ? `MAD set ${sku}` : `MAD ${familyLabel}`;
    const metaRows = [
      buildMetaRow("Product", `MAD ${familyLabel}`),
      autoLabel ? buildMetaRow("Auto", autoLabel) : "",
    ]
      .filter(Boolean)
      .join("");

    return `
        <article class="card product">
          <div class="body">
            <div class="sku">${esc(title)}</div>
            <div class="meta">
              ${metaRows}
            </div>
            <p class="note">Setnummer gevonden via kenteken. Neem contact op voor juiste uitvoering/prijs.</p>
            <div class="cta-row">
              <a class="btn" href="${esc(MONTAGE_URL)}">Plan montage</a>
              <a class="btn btn-ghost" href="${esc(
                WHATSAPP_URL
              )}" target="_blank" rel="noopener noreferrer">WhatsApp</a>
              <a class="btn btn-ghost" href="${esc(CONTACT_PHONE)}">Bel</a>
            </div>
          </div>
        </article>`;
  }

  function initImagesForGrid(gridId = "model-grid") {
    const gridEl = document.getElementById(gridId);
    if (!gridEl) return;
    const cards = gridEl.querySelectorAll(".card.product");
    cards.forEach((card, idx) => {
      const sku = card.getAttribute("data-sku") || "";
      const imgId = `kitimg_${idx}`;
      const img = document.getElementById(imgId);
      const wrapEl = document.getElementById(`${imgId}_wrap`);
      if (!img || !wrapEl) return;

      const urls = imageCandidatesForSku(sku);
      if (!urls.length) return;

      let currentIndex = null;
      let nextIndex = 0;

      function tryNext() {
        if (nextIndex >= urls.length) {
          wrapEl.classList.add("error");
          return;
        }
        const i = nextIndex;
        nextIndex += 1;
        currentIndex = i;
        img.src = urls[i];
      }

      img.onerror = () => {
        tryNext();
      };

      tryNext();

      wrapEl.addEventListener("click", () => {
        if (!urls.length) return;
        if (currentIndex == null) return;
        const i = (currentIndex + 1) % urls.length;
        currentIndex = i;
        nextIndex = (i + 1) % urls.length;
        img.src = urls[i];
      });
    });
  }

  function bindLeadButtons(gridId = "model-grid") {
    ensureLeadModal();
    const gridEl = document.getElementById(gridId);
    if (!gridEl || gridEl.__leadBound) return;
    gridEl.__leadBound = true;

    gridEl.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-lead='1']");
      if (!btn) return;
      e.preventDefault();
      openLeadModal({
        sku: btn.getAttribute("data-sku") || "",
        auto: btn.getAttribute("data-auto") || "",
        platform: btn.getAttribute("data-platform") || "",
        years: btn.getAttribute("data-years") || "",
      });
    });
  }

  function pickPlateCandidate(candidates, makeSlug, modelSlug) {
    if (!Array.isArray(candidates) || !candidates.length) return null;
    if (candidates.length === 1) return candidates[0];
    const targetMake = String(makeSlug || "").toLowerCase();
    const targetModel = String(modelSlug || "").toLowerCase();

    const exact = candidates.find((candidate) => {
      const make = slugify(candidate.make || candidate.makename || "");
      const model = slugify(candidate.model || candidate.modelname || "");
      if (targetMake && make !== targetMake) return false;
      if (targetModel && model !== targetModel) return false;
      return true;
    });
    if (exact) return exact;

    if (targetMake) {
      const makeMatch = candidates.find(
        (candidate) =>
          slugify(candidate.make || candidate.makename || "") === targetMake
      );
      if (makeMatch) return makeMatch;
    }
    return candidates[0];
  }

  function resolveModelSlugFromKits(makeEntry, ...slugs) {
    if (!makeEntry || !makeEntry.models) return "";
    const candidates = Array.from(makeEntry.models.keys());
    if (!candidates.length) return "";
    let best = "";
    slugs.filter(Boolean).forEach((rawSlug) => {
      const resolved = pickBestModelSlug(rawSlug, candidates);
      if (resolved && candidates.includes(resolved)) {
        if (!best || resolved.length > best.length) best = resolved;
      }
    });
    return best;
  }

  function getVehicleYear(vehicle) {
    if (!vehicle) return null;
    const raw =
      vehicle.year ??
      vehicle.year_from ??
      vehicle.yearTo ??
      vehicle.year_to ??
      vehicle.typeFrom ??
      vehicle.type_from ??
      vehicle.firstRegistrationDate ??
      vehicle.first_registration_date ??
      null;
    const ym = parseYearMonth(raw, 1);
    return ym ? ym.year : null;
  }

  function getVehicleYearMonth(vehicle, plateContext) {
    if (!vehicle) return null;
    const direct =
      vehicle.firstRegistrationDate ??
      vehicle.first_registration_date ??
      vehicle.datum_eerste_toelating ??
      vehicle.registrationDate ??
      vehicle.registration_date ??
      vehicle.typeFrom ??
      vehicle.type_from ??
      vehicle.year_from ??
      vehicle.yearFrom ??
      vehicle.year ??
      null;
    const directYm = parseYearMonth(direct, 1);
    if (directYm) return directYm;

    const range = plateContext && plateContext.yearRange;
    if (range && (range.from != null || range.to != null)) {
      const rangeYm = parseYearMonth(range.from ?? range.to, 1);
      if (rangeYm) return rangeYm;
    }

    const params = new URLSearchParams(location.search || "");
    const yearParam =
      params.get("year") || params.get("bouwjaar") || params.get("jaar") || null;
    return parseYearMonth(yearParam, 1);
  }

  function getVehicleRange(vehicle, plateContext) {
    if (!vehicle && !plateContext) return null;
    const yearMin =
      vehicle?.yearMin ??
      vehicle?.estimatedYearMin ??
      vehicle?.year_min ??
      vehicle?.year_from ??
      null;
    const yearMax =
      vehicle?.yearMax ??
      vehicle?.estimatedYearMax ??
      vehicle?.year_max ??
      vehicle?.year_to ??
      null;
    let range = parseRange({ from: yearMin, to: yearMax });
    if (range) return range;
    const textRange =
      vehicle?.modelRangeText ??
      vehicle?.modelRangeLabel ??
      vehicle?.model_range_text ??
      vehicle?.model_range ??
      vehicle?.modelRange ??
      vehicle?.yearRange ??
      vehicle?.year_range ??
      null;
    range = parseRange(textRange);
    if (!range) {
      range = parseRange({
        start:
          vehicle?.typeFrom ??
          vehicle?.type_from ??
          vehicle?.year_from ??
          vehicle?.yearFrom ??
          vehicle?.from ??
          null,
        end:
          vehicle?.typeTill ??
          vehicle?.type_till ??
          vehicle?.year_to ??
          vehicle?.yearTo ??
          vehicle?.till ??
          null,
      });
    }
    if (!range && plateContext?.yearRange) {
      range = parseRange(plateContext.yearRange);
    }
    if (!range) {
      const direct =
        vehicle?.firstRegistrationDate ??
        vehicle?.first_registration_date ??
        vehicle?.datum_eerste_toelating ??
        vehicle?.registrationDate ??
        vehicle?.registration_date ??
        null;
      const ym = parseYearMonth(direct, 1);
      if (ym) range = { start: ym, end: ym };
    }
    if (!range) {
      const params = new URLSearchParams(location.search || "");
      const yearParam =
        params.get("year") || params.get("bouwjaar") || params.get("jaar") || null;
      range = parseRange(yearParam);
    }
    return range;
  }

  function normalizePlatformCodes(value) {
    if (!value) return [];
    const list = Array.isArray(value) ? value : [value];
    const codes = new Set();
    list.forEach((entry) => {
      const raw = String(entry || "").toUpperCase();
      raw
        .split(/[^A-Z0-9]+/)
        .filter(Boolean)
        .forEach((token) => {
          if (/^2K[A-Z0-9]{0,2}$/.test(token)) codes.add(token);
        });
      const matches = raw.match(/2K[A-Z0-9]{0,2}/g);
      if (matches) matches.forEach((token) => codes.add(token));
    });
    return Array.from(codes);
  }

  function extractPlatformCodes(vehicle) {
    if (!vehicle) return [];
    const sources = [
      vehicle.platformCodes,
      vehicle.platform_codes,
      vehicle.modelCodes,
      vehicle.model_codes,
      vehicle.modelRemark,
      vehicle.model_remark,
      vehicle.type,
      vehicle.typename,
    ];
    const codes = new Set();
    sources.forEach((source) => {
      normalizePlatformCodes(source).forEach((code) => codes.add(code));
    });
    return Array.from(codes);
  }

  function isCaddyContext(makeSlug, modelSlug) {
    const make = String(makeSlug || "");
    const model = String(modelSlug || "");
    const isVw = make.includes("volkswagen") || make === "vw";
    return isVw && model.includes("caddy");
  }

  function detectCaddyGeneration(vehicle, makeSlug, modelSlug) {
    if (!vehicle || !isCaddyContext(makeSlug, modelSlug)) return null;
    const modelToken = String(modelSlug || "").toLowerCase();
    if (modelToken.includes("caddy-iii") || modelToken.includes("caddy-3")) {
      return 3;
    }
    if (modelToken.includes("caddy-iv") || modelToken.includes("caddy-4")) {
      return 4;
    }
    const label = [
      vehicle.modelLabel,
      vehicle.model,
      vehicle.modelname,
      vehicle.modelRemark,
      vehicle.model_remark,
      vehicle.type,
      vehicle.typename,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (/(caddy\s*iii|caddy\s*3)/.test(label) || /caddy-iii/.test(label)) {
      return 3;
    }
    if (/(caddy\s*iv|caddy\s*4)/.test(label) || /caddy-iv/.test(label)) {
      return 4;
    }

    const codes = extractPlatformCodes(vehicle);
    const gen3 = new Set(["2KA", "2KH", "2CA", "2CH"]);
    const gen4 = new Set([
      // TODO: aanvullen met Caddy IV platformcodes zodra beschikbaar.
    ]);
    if (codes.some((code) => gen3.has(code))) return 3;
    if (codes.some((code) => gen4.has(code))) return 4;
    return null;
  }

  function findModelSlugCandidates(makeEntry, ...slugs) {
    if (!makeEntry || !makeEntry.models) return [];
    const candidates = Array.from(makeEntry.models.keys());
    if (!candidates.length) return [];
    const rawSlugs = slugs.filter(Boolean);
    if (!rawSlugs.length) return [];
    const matches = candidates.filter((slug) =>
      rawSlugs.some((raw) => slug.includes(raw) || raw.includes(slug))
    );
    return Array.from(new Set(matches));
  }

  function filterModelCandidatesByYear(kits, makeSlug, candidates, year) {
    if (!year || !Array.isArray(candidates) || !candidates.length) return candidates;
    const targetYear = Number.parseInt(year, 10);
    if (!Number.isFinite(targetYear)) return candidates;
    const want = new Set(candidates);
    const matches = new Set();
    for (const kit of kits || []) {
      for (const f of kit.fitments || []) {
        if (slugify(f.make) !== makeSlug) continue;
        const modelSlug = slugify(f.model);
        if (!want.has(modelSlug)) continue;
        const y1 = +String(f.year_from || "").slice(-4) || 1990;
        const y2 = +String(f.year_to || "").slice(-4) || new Date().getFullYear();
        if (targetYear >= y1 && targetYear <= y2) {
          matches.add(modelSlug);
        }
      }
    }
    return matches.size ? Array.from(matches) : candidates;
  }

  function buildPlateGenerationOptions(makeEntry, makeSlug, plateValue, candidates) {
    const platePart = plateSlug(plateValue);
    return (candidates || [])
      .map((modelSlug) => {
        const label = makeEntry?.models?.get(modelSlug) || modelSlug;
        return `<a class="btn btn-ghost" href="${BASE}/${esc(
          makeSlug
        )}/${esc(modelSlug)}/${PLATE_PREFIX}${platePart}">${esc(label)}</a>`;
      })
      .join("");
  }

  function buildPlateContextFromVehicle(vehicle, plateValue) {
    if (!vehicle) return null;
    const yearRange = buildPlateYearRange(vehicle);
    const autoLabel = buildPlateAutoLabel(vehicle);
    const type = String(vehicle.type || vehicle.typename || "");
    const typeRemark = String(vehicle.typeRemark || vehicle.type_remark || "");
    const powerText = formatPower(vehicle.kw || vehicle.kwCat || vehicle.kw_cat);
    const rangeLabel = yearRange ? yearRange.label : "";
    let uitvoering = [type, typeRemark].filter(Boolean).join(" ").trim();
    if (rangeLabel) {
      uitvoering = uitvoering ? `${uitvoering} (${rangeLabel})` : rangeLabel;
    }
    if (powerText) {
      uitvoering = uitvoering ? `${uitvoering}, ${powerText}` : powerText;
    }
    const motorCode = extractEngineCodes(vehicle);

    return {
      plateSlug: plateSlug(plateValue),
      plateMasked: "",
      plate: (vehicle && vehicle.plate) || String(plateValue || "").toUpperCase(),
      vehicle,
      yearRange,
      autoLabel,
      uitvoering,
      motorCode,
    };
  }

  function buildPlateSummary(vehicle, yearRange) {
    const label = buildPlateAutoLabel(vehicle);
    if (!label) return "";
    if (yearRange && yearRange.label) {
      return `${label} (${yearRange.label})`;
    }
    return label;
  }

  function applyPlateMeta({ title, description, robots }) {
    if (title) document.title = title;

    const head = document.head || document.querySelector("head");
    if (!head) return;

    const setMeta = (selector, attrs) => {
      let el = document.querySelector(selector);
      if (!el) {
        el = document.createElement("meta");
        Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
        head.appendChild(el);
      }
      return el;
    };

    const setLink = (selector, attrs) => {
      let el = document.querySelector(selector);
      if (!el) {
        el = document.createElement("link");
        Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
        head.appendChild(el);
      }
      return el;
    };

    if (description) {
      setMeta('meta[name="description"]', { name: "description" }).setAttribute(
        "content",
        description
      );
      setMeta('meta[property="og:description"]', {
        property: "og:description",
      }).setAttribute("content", description);
    }
    if (title) {
      setMeta('meta[property="og:title"]', { property: "og:title" }).setAttribute(
        "content",
        title
      );
    }

    if (robots) {
      setMeta('meta[name="robots"]', { name: "robots" }).setAttribute(
        "content",
        robots
      );
    }

    const cleanPath = normalizeForRoute(location.pathname);
    const canonicalPath =
      cleanPath === "/" ? "/" : cleanPath.replace(/\/+$/, "") || "/";
    const canonicalUrl = `${location.origin}${canonicalPath}`;
    setLink('link[rel="canonical"]', { rel: "canonical" }).setAttribute(
      "href",
      canonicalUrl
    );
  setMeta('meta[property="og:url"]', { property: "og:url" }).setAttribute(
    "content",
    canonicalUrl
  );
  }

  function applyPlateLayout() {
    if (document.body) document.body.classList.add("plate-route");
    const hero = document.querySelector(".hero");
    if (hero) hero.setAttribute("data-plate-hidden", "1");
  }

  function isPlateRoutePath(pathname) {
    const clean = normalizeForRoute(pathname).toLowerCase();
    if (clean.includes("/kt_")) return true;
    const parts = clean.split("/").filter(Boolean);
    if (!parts.length) return false;
    if ((parts[0] === "kenteken" || parts[0] === "kt") && parts.length > 1)
      return true;
    return false;
  }

  function suppressHomeSectionsOnPlate() {
    const main = document.querySelector("main");
    if (!main) return;
    main.querySelectorAll("section").forEach((section) => {
      if (section.querySelector("#app") || section.querySelector(".app")) return;
      section.setAttribute("data-plate-hidden", "1");
      section.style.display = "none";
    });
  }

  function suppressHomeSectionsForApp() {
    const main = document.querySelector("main");
    if (!main) return;
    main.querySelectorAll("section").forEach((section) => {
      if (section.querySelector("#app") || section.querySelector(".app")) return;
      section.setAttribute("data-app-hidden", "1");
      section.style.display = "none";
    });
  }

  function formatYearRangeLabel(range) {
    if (!range) return "";
    const from = range.from ?? range.to;
    const to = range.to ?? range.from;
    if (from != null && to != null) {
      if (from === to) return String(from);
      return `${from}-${to}`;
    }
    if (from != null && to == null) return `${from}-nu`;
    if (from == null && to != null) return `tot ${to}`;
    return "";
  }

  /* ================== Render: sets per model (met filters) ================== */

  function resolveModelSlugVariant(modelsMap, targetSlug) {
    if (!modelsMap || !modelsMap.size || !targetSlug) return targetSlug;
    if (modelsMap.has(targetSlug)) return targetSlug;
    let best = "";
    const candidates = Array.from(modelsMap.keys());
    candidates.forEach((c) => {
      if ((targetSlug.startsWith(c) || c.startsWith(targetSlug)) && c.length > best.length) {
        best = c;
      }
    });
    if (!best) {
      const parts = targetSlug.split("-");
      while (parts.length > 1) {
        parts.pop();
        const shorter = parts.join("-");
        if (modelsMap.has(shorter)) {
          best = shorter;
          break;
        }
      }
    }
    return best || targetSlug;
  }

  function renderModel(kits, makes, makeSlug, modelSlug) {
    if (!hasApp || !app) return;
    suppressHomeSectionsForApp();
    const entry = makes.get(makeSlug);
    if (!entry) return renderMake(makes, makeSlug);

    const resolvedModelSlug = resolveModelSlugVariant(entry.models, modelSlug);
    if (!entry.models.has(resolvedModelSlug)) return renderMake(makes, makeSlug);

    debugLog("render:model", { make: makeSlug, model: resolvedModelSlug });

    CURRENT_ROUTE_CTX = {
      makeSlug,
      modelSlug: resolvedModelSlug,
      driveException: isDriveException(makeSlug, resolvedModelSlug),
      plate: null,
      vehicleYM: null,
      vehicleRange: null,
      platformCodes: [],
      caddyGeneration: null,
      isCaddy: false,
    };

    const makeLabel = entry.label;
    const modelLabel = entry.models.get(resolvedModelSlug);
    const plateContext = buildPlateContext({ base: BASE, makeSlug, modelSlug: resolvedModelSlug });
    const plateInfoHtml = buildPlateInfoHtml(plateContext);
    const activeCtx = getActivePlateContext();
    const vehicleActive = Boolean(activeCtx && activeCtx.plate);
    setTitle(`Hulpveren - ${makeLabel} ${modelLabel} | MAD Sets met montage`);
    updateHero(makeLabel, modelLabel);

    const allPairs = [];
    for (const k of kits || []) {
      for (const f of k.fitments || []) {
        if (slugify(f.make) !== makeSlug) continue;
        if (slugify(f.model) !== resolvedModelSlug) continue;
        allPairs.push({ k, f });
      }
    }
    if (!allPairs.length) {
      if (vehicleActive) {
        window.location.href = `${BASE}/${makeSlug}/`;
        return;
      }
      console.warn("kits:model_empty", {
        makeSlug,
        modelSlug,
        totalKits: Array.isArray(kits) ? kits.length : 0,
      });
      app.innerHTML = wrap(`
        <div class="crumbs">
          <a href="${BASE}">Hulpveren</a> >
          <a href="${BASE}/${esc(makeSlug)}">${esc(makeLabel)}</a> >
          ${esc(modelLabel)}
        </div>
        <h1>${esc(makeLabel)} ${esc(modelLabel)} hulpveren</h1>
        ${plateInfoHtml}
        <p class="note">Geen sets gevonden voor dit model.</p>
      `);
      return;
    }

    const { min: yearMin, max: yearMax } = getYearRange(allPairs);
    const showFilters = allPairs.length > 2;

    let hasLeeg = false,
      hasCont = false;
    const driveAvail = new Set();
    let hasSRW = false,
      hasDRW = false;
    const posAvail = new Set();

    for (const { k, f } of allPairs) {
      const mKey = supportKeyOf(f, k);
      if (mKey === "leeg") hasLeeg = true;
      if (mKey === "continue") hasCont = true;

      const dPol = drivePolicyFromFit(f, k);
      (dPol.allowLabels || []).forEach((lbl) => driveAvail.add(lbl));

      const pStrict = rearWheelsPolicyFrom(f, k, true);
      if (pStrict.allow.has("drw")) hasDRW = true;
      const pLax = rearWheelsPolicyFrom(f, k, false);
      if (pLax.allow.has("srw")) hasSRW = true;

      posAvail.add(positionKey(k));
    }

    const yearGroup = showFilters
      ? `
        <div class="grp range" id="grp-year">
          <span class="muted">Bouwjaar</span>
          <div class="range-row">
            <input type="range" id="flt-year" min="${yearMin}" max="${yearMax}" value="${yearMin}">
            <span id="flt-year-label" class="pill">Alle</span>
          </div>
          <div class="range-row" style="gap:8px; align-items:center; margin-top:6px;">
            <input type="number" id="flt-year-from" placeholder="van" style="width:90px;padding:6px 8px;">
            <input type="number" id="flt-year-to" placeholder="tot" style="width:90px;padding:6px 8px;">
          </div>
        </div>
      `
      : "";

    let modeGroup = "";
    if (showFilters && hasLeeg && hasCont) {
      modeGroup = `
        <div class="grp toolbar" id="grp-mode">
          <span class="muted">Gebruik:</span>
          <div class="chips" id="mode-chips">
            <span class="chip small" data-key="leeg" data-on="0"><span class="dot"></span>Leeg &amp; beladen</span>
            <span class="chip small" data-key="continue" data-on="0"><span class="dot"></span>Continue beladen</span>
          </div>
        </div>
      `;
    }

    let driveGroup = "";
    const driveItems = driveChipItems(driveAvail, makeSlug, modelSlug);
    if (showFilters && driveItems.length > 1) {
      driveGroup = `
        <div class="grp toolbar" id="grp-drive">
          <span class="muted">Aandrijving:</span>
          <div class="chips" id="drive-chips">
            ${driveItems
              .map(
                (item) =>
                  `<span class="chip small" data-key="${item.key}" data-on="0"><span class="dot"></span>${item.label}</span>`
              )
              .join("")}
          </div>
        </div>
      `;
    }

    let rearGroup = "";
    if (showFilters && hasSRW && hasDRW) {
      const chips = [];
      if (hasSRW)
        chips.push(
          `<span class="chip small" data-key="srw" data-on="0"><span class="dot"></span>Enkel lucht</span>`
        );
      if (hasDRW)
        chips.push(
          `<span class="chip small" data-key="drw" data-on="0"><span class="dot"></span>Dubbel lucht</span>`
        );
      rearGroup = `
        <div class="grp toolbar" id="grp-rear">
          <span class="muted">Achterwielen:</span>
          <div class="chips" id="rear-chips">
            ${chips.join("")}
          </div>
        </div>
      `;
    }

    let posGroup = "";
    const posList = Array.from(posAvail).filter(Boolean);
    if (showFilters && posList.length > 1) {
      const posOrder = ["rear", "front", "both"];
      const chips = posList.sort(
        (a, b) => posOrder.indexOf(a) - posOrder.indexOf(b)
      );
      posGroup = `
        <div class="grp toolbar" id="grp-pos">
          <span class="muted">As:</span>
          <div class="chips" id="pos-chips">
            ${chips
              .map(
                (key) =>
                  `<span class="chip small" data-key="${key}" data-on="0"><span class="dot"></span>${positionNL(
                    key
                  )}</span>`
              )
              .join("")}
          </div>
        </div>
      `;
    }

    FILTER.year = null;
    const yr =
      (plateContext && plateContext.yearRange) ||
      (activeCtx && activeCtx.yearRange) ||
      null;
    const label = yr && yr.label ? yr.label : formatYearRangeLabel(yr);
    FILTER.yearRange = yr
      ? { ...yr, label: label || undefined, source: "plate" }
      : null;
    FILTER.support.clear();
    FILTER.drive.clear();
    FILTER.rear.clear();
    FILTER.pos.clear();
    const driveKey = driveFilterKeyFromVehicle(
      (plateContext && plateContext.vehicle) || (activeCtx && activeCtx.vehicle),
      CURRENT_ROUTE_CTX.driveException
    );
    const driveKeys = new Set(driveItems.map((item) => item.key));
    if (driveKey && driveKeys.has(driveKey)) {
      FILTER.drive.add(driveKey);
    }

    const filtersMarkup = [
      yearGroup,
      modeGroup,
      driveGroup,
      rearGroup,
      posGroup,
    ]
      .filter(Boolean)
      .join("");
    const filtersBlock = filtersMarkup
      ? `<div class="filters" id="hv-filters">${filtersMarkup}</div>`
      : "";

    const seoHtml = hvSeoRenderModel(allPairs, {
      makeLabel,
      modelLabel,
      makeSlug,
      modelSlug,
    });

    app.innerHTML = wrap(`
      <div class="crumbs">
        <a href="${BASE}">Hulpveren</a> >
        <a href="${BASE}/${esc(makeSlug)}">${esc(makeLabel)}</a> >
        ${esc(modelLabel)}
      </div>

      <h1>${esc(makeLabel)} ${esc(modelLabel)} hulpveren</h1>

      <div class="set-meta">
        <span><span id="kit-count">0</span> sets</span>
        <span id="filter-summary" class="muted"></span>
      </div>

        ${plateInfoHtml}

        ${seoHtml || ""}

        ${filtersBlock}

        <div id="model-grid" class="grid" data-set-list></div>
      `);
    const yearLabelEl = document.getElementById("flt-year-label");
    if (yearLabelEl && FILTER.yearRange) {
      yearLabelEl.textContent =
        FILTER.yearRange.label || formatYearRangeLabel(FILTER.yearRange) || "Alle";
    }
      if (plateContext && plateContext.yearRange && plateContext.yearRange.label) {
        const yearLabel = document.getElementById("flt-year-label");
        if (yearLabel) yearLabel.textContent = plateContext.yearRange.label;
      }
    if (FILTER.drive.size) {
      const driveWrap = document.getElementById("drive-chips");
      if (driveWrap) {
        driveWrap.querySelectorAll(".chip").forEach((chip) => {
          const key = chip.getAttribute("data-key");
          if (FILTER.drive.has(key)) {
            chip.setAttribute("data-on", "1");
          }
        });
      }
    }

    const showDriveMeta = driveItems.length > 1;
    const showRearMeta = hasSRW && hasDRW;
    const cardOptions = {
      makeLabel,
      modelLabel,
      makeSlug,
      modelSlug,
      showDriveMeta,
      showRearMeta,
    };

    let initialRender = true;
    function renderCards() {
  const filtered = filterPairs(allPairs).sort((a, b) => {
    const pa = a.k?.pricing_nl?.total_inc_vat_from_eur;
    const pb = b.k?.pricing_nl?.total_inc_vat_from_eur;
    const na = Number.isFinite(+pa) ? +pa : 1e12;
    const nb = Number.isFinite(+pb) ? +pb : 1e12;
    if (na !== nb) return na - nb;
    return String(a.k?.sku || "").localeCompare(String(b.k?.sku || ""));
  });

  const gridEl = document.getElementById("model-grid");
  const countEl = document.getElementById("kit-count");
  if (countEl) countEl.textContent = String(filtered.length);

  if (!gridEl) return;

  if (initialRender) {
    initialRender = false;
  }

  if (!filtered.length) {
    const plateContext = getActivePlateContext && getActivePlateContext();
    const plateLabel =
      (plateContext && plateContext.plate) || (plateContext && plateContext.plateSlug) || "";
    const msg = plateLabel
      ? `Geen sets beschikbaar voor ${esc(makeLabel)} ${esc(
          modelLabel
        )} (kenteken ${esc(plateLabel)}).`
      : `Geen sets beschikbaar voor ${esc(makeLabel)} ${esc(modelLabel)}.`;
    gridEl.innerHTML = `<p class="note">${msg}</p>`;
  } else {
    gridEl.innerHTML = filtered
      .map((pair, idx) => buildModelCard(pair, idx, cardOptions))
      .join("");

    /* Fallback: herleid oudere hash-links (#HV-...) naar SKU-URL
    const links = gridEl.querySelectorAll("a.btn.ghost");
    links.forEach((a) => {
      const href = a.getAttribute("href") || "";
      const m = href.match(/#((HV|SD|NR)-[A-Za-z0-9-]+)/i);
      if (m) {
        a.href = `${HV_BASE}/${m[1].toLowerCase()}/`;
      }
    });
    */
  }

  updateFilterSummary();
  initImagesForGrid();
  bindLeadButtons();
}


    (function bindFilterEvents() {
      const yearInput = document.getElementById("flt-year");
      const yearLabel = document.getElementById("flt-year-label");
        if (yearInput && yearLabel) {
          yearInput.addEventListener("input", (e) => {
            const v = +e.target.value || yearMin;
            FILTER.year = v;
            yearLabel.textContent = String(v);
            renderCards();
          });
          yearLabel.addEventListener("click", () => {
            FILTER.year = null;
            yearLabel.textContent =
              FILTER.yearRange && FILTER.yearRange.label
                ? FILTER.yearRange.label
                : "Alle";
            yearInput.value = String(yearMin);
            renderCards();
          });
        }

      const modeWrap = document.getElementById("mode-chips");
      if (modeWrap) {
        modeWrap.addEventListener("click", (e) => {
          const chip = e.target.closest(".chip");
          if (!chip) return;
          const key = chip.getAttribute("data-key");
          const on = chip.getAttribute("data-on") === "1";
          chip.setAttribute("data-on", on ? "0" : "1");
          if (on) FILTER.support.delete(key);
          else FILTER.support.add(key);
          renderCards();
        });
      }

      const driveWrap = document.getElementById("drive-chips");
      if (driveWrap) {
        driveWrap.addEventListener("click", (e) => {
          const chip = e.target.closest(".chip");
          if (!chip) return;
          const key = chip.getAttribute("data-key");
          const on = chip.getAttribute("data-on") === "1";
          chip.setAttribute("data-on", on ? "0" : "1");
          if (on) FILTER.drive.delete(key);
          else FILTER.drive.add(key);
          renderCards();
        });
      }

      const rearWrap = document.getElementById("rear-chips");
      if (rearWrap) {
        rearWrap.addEventListener("click", (e) => {
          const chip = e.target.closest(".chip");
          if (!chip) return;
          const key = chip.getAttribute("data-key");
          const on = chip.getAttribute("data-on") === "1";
          chip.setAttribute("data-on", on ? "0" : "1");
          if (on) FILTER.rear.delete(key);
          else FILTER.rear.add(key);
          renderCards();
        });
      }
      const posWrap = document.getElementById("pos-chips");
      if (posWrap) {
        posWrap.addEventListener("click", (e) => {
          const chip = e.target.closest(".chip");
          if (!chip) return;
          const key = chip.getAttribute("data-key");
          const on = chip.getAttribute("data-on") === "1";
          chip.setAttribute("data-on", on ? "0" : "1");
          if (on) FILTER.pos.delete(key);
          else FILTER.pos.add(key);
          renderCards();
        });
      }
    })();

    renderCards();
  }

  function renderPlateRouteError(message) {
    const target = ensureAppContainer();
    if (!target) return;
    applyPlateLayout();
    const note = message || "Kentekenroute is ongeldig of incompleet.";
    target.innerHTML = wrap(`
      <div class="crumbs">
        <a href="${BASE}">Hulpveren</a> >
        Kenteken
      </div>
      <h1>Kenteken controleren</h1>
      <p class="note">${esc(note)}</p>
      <div class="cta-row">
        <a class="btn" href="/kenteken">Opnieuw zoeken</a>
        <a class="btn btn-ghost" href="/hulpveren">Kies merk en model</a>
      </div>
    `);
  }

  async function renderPlateModel(kits, makes, route) {
    if (!hasApp || !app) return;
    applyPlateLayout();

    const plateRaw = (route && route.plate) || "";
    const plateNormalized = normalizePlateInput(plateRaw);
    const plateDisplay = plateNormalized || plateRaw.toUpperCase() || "";
    const routeMakeSlug = String(route?.make || "").toLowerCase();
    const routeModelSlug = String(route?.model || "").toLowerCase();

    debugLog("render:plate", {
      path: location.pathname,
      plate: plateNormalized,
      make: routeMakeSlug,
      model: routeModelSlug,
      variant: route?.variant || "",
    });

    app.innerHTML = wrap(`
      <div class="crumbs">
        <a href="${BASE}">Hulpveren</a> >
        Kenteken
      </div>
      <h1>Hulpveren op kenteken: ${esc(plateDisplay)}</h1>
      <p class="lead">Kenteken wordt gecontroleerd...</p>
      <div class="loading">Resultaten laden...</div>
      <div id="model-grid" class="grid" data-set-list></div>
    `);

    // Kenteken-pagina's standaard noindex; pas aan indien gewenst.
    applyPlateMeta({
      title: `Hulpveren op kenteken: ${plateDisplay} | Hulpveren.shop`,
      description: `Hulpveren op kenteken ${plateDisplay}. Controleer passende sets voor jouw voertuig.`,
      robots: "noindex, nofollow",
    });

    let data;
    try {
      data = await fetchPlateData(plateNormalized);
    } catch (err) {
      const isNotFound = err?.status === 404;
      const isServiceError =
        err?.code === "timeout" || !err?.status || Number(err?.status) >= 500;
      debugLog("plate:fetch_error", {
        plate: plateNormalized,
        message: err?.message || String(err),
        status: err?.status || null,
      });
      app.innerHTML = wrap(`
        <div class="crumbs">
          <a href="${BASE}">Hulpveren</a> >
          Kenteken
        </div>
        <h1>Hulpveren op kenteken: ${esc(plateDisplay)}</h1>
        <p class="note">${
          isNotFound
            ? "Kenteken niet gevonden. Kies handmatig je model of probeer opnieuw."
            : err?.code === "timeout"
              ? "Kentekenservice reageert niet. Probeer opnieuw of kies handmatig."
              : "We kunnen het kenteken nu niet ophalen. Probeer het later opnieuw of neem contact op."
        }</p>
        <div class="cta-row">
          ${
            isNotFound
              ? `<a class="btn" href="/hulpveren">Kies merk en model</a>`
              : `<a class="btn" href="/kenteken">Opnieuw proberen</a>`
          }
          <a class="btn btn-ghost" href="${
            isNotFound ? "/kenteken" : "https://wa.me/311651320219"
          }" ${
            isNotFound ? "" : 'target="_blank" rel="noopener noreferrer"'
          }>${isNotFound ? "Opnieuw zoeken" : "WhatsApp"}</a>
        </div>
        ${
          isServiceError
            ? `
        <div class="cta-row">
          <a class="btn btn-ghost" href="/hulpveren">Hulpveren</a>
          <a class="btn btn-ghost" href="/luchtvering">Luchtvering</a>
          <a class="btn btn-ghost" href="/verlagingsveren">Verlagingsveren</a>
        </div>`
            : ""
        }
      `);
      return;
    }

    const source = data?.source || "proxyv7";
    const isRdwBasic = source === "rdw" && data?.confidence === "basic";
    const rdwVehicle = isRdwBasic ? data?.vehicle : null;
    const candidates = isRdwBasic
      ? rdwVehicle
        ? [rdwVehicle]
        : []
      : Array.isArray(data?.vehicleCandidates)
        ? data.vehicleCandidates
        : Array.isArray(data?.candidates)
          ? data.candidates
          : [];
    debugLog("plate:candidates", { count: candidates.length, source });
    if (!candidates.length) {
      debugLog("plate:empty_candidates", { plate: plateNormalized, source });
      app.innerHTML = wrap(`
        <div class="crumbs">
          <a href="${BASE}">Hulpveren</a> >
          Kenteken
        </div>
        <h1>Hulpveren op kenteken: ${esc(plateDisplay)}</h1>
        <p class="note">${
          isRdwBasic
            ? "Geen RDW-voertuigdata gevonden voor dit kenteken. Kies handmatig je model."
            : "Geen voertuig gevonden voor dit kenteken. Controleer het kenteken of kies handmatig je model."
        }</p>
        <div class="cta-row">
          <a class="btn" href="/kenteken">Opnieuw zoeken</a>
          <a class="btn btn-ghost" href="/hulpveren">Kies merk en model</a>
        </div>
      `);
      return;
    }

    const vehicle = isRdwBasic
      ? rdwVehicle
      : pickPlateCandidate(candidates, routeMakeSlug, routeModelSlug);
    debugLog("plate:vehicle_pick", {
      matched: !!vehicle,
      make: routeMakeSlug,
      model: routeModelSlug,
    });
    if (!vehicle) {
      app.innerHTML = wrap(`
        <div class="crumbs">
          <a href="${BASE}">Hulpveren</a> >
          Kenteken
        </div>
        <h1>Hulpveren op kenteken: ${esc(plateDisplay)}</h1>
        <p class="note">Geen voertuig gevonden voor dit kenteken. Controleer het kenteken of kies handmatig je model.</p>
        <div class="cta-row">
          <a class="btn" href="/kenteken">Opnieuw zoeken</a>
          <a class="btn btn-ghost" href="/hulpveren">Kies merk en model</a>
        </div>
      `);
      return;
    }

    const vehicleMakeLabel = vehicle.make || vehicle.makename || "";
    const vehicleModelLabel = vehicle.model || vehicle.modelname || "";
    const vehicleMakeSlug = slugify(vehicleMakeLabel) || routeMakeSlug;
    const vehicleModelSlug = slugify(vehicleModelLabel) || routeModelSlug;
    const makeSlug = vehicleMakeSlug || routeMakeSlug;
    const makeEntry = makes.get(makeSlug);
    const vehicleYear = getVehicleYear(vehicle);
    let modelCandidates = [];
    if (isRdwBasic) {
      if (!makeEntry || !makeSlug || !vehicleModelSlug) {
        if (
          window.HVPlateContext &&
          typeof window.HVPlateContext.setPlateContextFromVehicle === "function"
        ) {
          window.HVPlateContext.setPlateContextFromVehicle(plateNormalized, vehicle, {
            range: getVehicleRange(vehicle, null),
          });
        }
        app.innerHTML = wrap(`
          <div class="crumbs">
            <a href="${BASE}">Hulpveren</a> >
            Kenteken
          </div>
          <h1>Hulpveren op kenteken: ${esc(plateDisplay)}</h1>
          <p class="note">We hebben alleen basisgegevens gevonden. Kies handmatig je merk en model.</p>
          <div class="cta-row">
            <a class="btn" href="/hulpveren">Kies merk en model</a>
            <a class="btn btn-ghost" href="/kenteken">Opnieuw zoeken</a>
          </div>
        `);
        renderPlateDebug({
          container: app,
          vehicle,
          allPairs: [],
          filtered: [],
          meta: {
            plate: plateNormalized,
            makeSlug,
            modelSlug: null,
            source,
            vehicleYM: getVehicleYearMonth(vehicle, null),
            vehicleRange: getVehicleRange(vehicle, null),
            platformCodes: extractPlatformCodes(vehicle),
            caddyGeneration: detectCaddyGeneration(
              vehicle,
              makeSlug,
              vehicleModelSlug || routeModelSlug
            ),
          },
        });
        return;
      }

      modelCandidates = findModelSlugCandidates(
        makeEntry,
        vehicleModelSlug,
        routeModelSlug
      );
      modelCandidates = filterModelCandidatesByYear(
        kits,
        makeSlug,
        modelCandidates,
        vehicleYear
      );

      if (modelCandidates.length > 1) {
        const plateContext = buildPlateContextFromVehicle(vehicle, plateNormalized);
        const plateInfoHtml = buildPlateInfoHtml(plateContext);
        const summary = buildPlateSummary(vehicle, plateContext?.yearRange);
        const summaryLine = summary ? `<p class="lead">${esc(summary)}</p>` : "";
        if (
          window.HVPlateContext &&
          typeof window.HVPlateContext.setPlateContextFromVehicle === "function"
        ) {
          window.HVPlateContext.setPlateContextFromVehicle(plateNormalized, vehicle, {
            range: getVehicleRange(vehicle, plateContext),
            yearRange: plateContext?.yearRange,
          });
        }
        const options = buildPlateGenerationOptions(
          makeEntry,
          makeSlug,
          plateNormalized,
          modelCandidates
        );
        app.innerHTML = wrap(`
          <div class="crumbs">
            <a href="${BASE}">Hulpveren</a> >
            <a href="${BASE}/${esc(makeSlug)}">${esc(
          makeEntry?.label || vehicleMakeLabel || makeSlug
        )}</a> >
            Kenteken
          </div>
          <h1>Hulpveren op kenteken: ${esc(plateDisplay)}</h1>
          ${summaryLine}
          <p class="note">Meerdere generaties passen bij dit kenteken. Kies de juiste generatie.</p>
          ${plateInfoHtml}
          <div class="cta-row">${options}</div>
          <div class="cta-row">
            <a class="btn btn-ghost" href="/hulpveren">Kies handmatig</a>
          </div>
        `);
        renderPlateDebug({
          container: app,
          vehicle,
          allPairs: [],
          filtered: [],
          meta: {
            plate: plateNormalized,
            makeSlug,
            modelSlug: null,
            source,
            vehicleYM: getVehicleYearMonth(vehicle, plateContext),
            vehicleRange: getVehicleRange(vehicle, plateContext),
            platformCodes: extractPlatformCodes(vehicle),
            caddyGeneration: detectCaddyGeneration(
              vehicle,
              makeSlug,
              vehicleModelSlug || routeModelSlug
            ),
          },
        });
        return;
      }
    }

    const resolvedModelSlug =
      isRdwBasic && modelCandidates.length === 1
        ? modelCandidates[0]
        : resolveModelSlugFromKits(makeEntry, vehicleModelSlug, routeModelSlug);
    const makeLabel = makeEntry?.label || vehicleMakeLabel || routeMakeSlug;
    const modelLabel =
      resolvedModelSlug && makeEntry?.models
        ? makeEntry.models.get(resolvedModelSlug) ||
          vehicleModelLabel ||
          routeModelSlug
        : vehicleModelLabel || routeModelSlug;

    const plateContext = buildPlateContextFromVehicle(vehicle, plateNormalized);
    const plateInfoHtml = buildPlateInfoHtml(plateContext);
    const summary = buildPlateSummary(vehicle, plateContext?.yearRange);
    const summaryLine = summary ? `<p class="lead">${esc(summary)}</p>` : "";
    const modelSlugForContext = resolvedModelSlug || vehicleModelSlug || routeModelSlug;
    const vehicleYM = getVehicleYearMonth(vehicle, plateContext);
    const vehicleRange = getVehicleRange(vehicle, plateContext);
    const platformCodes = extractPlatformCodes(vehicle);
    const caddyGeneration = detectCaddyGeneration(
      vehicle,
      makeSlug,
      modelSlugForContext
    );
    const isCaddy = isCaddyContext(makeSlug, modelSlugForContext);
    const driveException = modelSlugForContext
      ? isDriveException(makeSlug, modelSlugForContext)
      : false;
    CURRENT_ROUTE_CTX = {
      makeSlug,
      modelSlug: modelSlugForContext || null,
      driveException,
      plate: plateNormalized,
      vehicleYM,
      vehicleRange,
      platformCodes,
      caddyGeneration,
      isCaddy,
    };
    if (
      window.HVPlateContext &&
      typeof window.HVPlateContext.setPlateContextFromVehicle === "function"
    ) {
      window.HVPlateContext.setPlateContextFromVehicle(plateNormalized, vehicle, {
        range: vehicleRange,
        yearRange: plateContext?.yearRange,
        route: { makeSlug, modelSlug: modelSlugForContext || "" },
      });
    }

    applyPlateMeta({
      title: `Hulpveren op kenteken: ${plateDisplay} | Hulpveren.shop`,
      description: summary
        ? `Hulpveren op kenteken ${plateDisplay}. ${summary}.`
        : `Hulpveren op kenteken ${plateDisplay}.`,
      robots: "noindex, nofollow",
    });

    const aldocSets = extractAldocSets(data);
    debugLog("plate:aldoc_sets", {
      totalItems: aldocSets.totalItems,
      matchedItems: aldocSets.matchedItems,
      hv: aldocSets.hvSkus.length,
      nr: aldocSets.nrSkus.length,
      ls: aldocSets.lsSkus.length,
    });
    if (typeof window.hvSetBaseFromAldoc === "function") {
      const v = (data && data.vehicle) || vehicle || {};
      const base = {
        make: v.make || v.merk || v.brand,
        model: v.model || v.type || v.modelnaam || v.modelname,
        makeSlug: v.makeSlug || v.merkSlug || v.brandSlug,
        modelSlug: v.modelSlug || v.typeSlug,
        kt: v.kt || data?.kt || null,
        rangeLabel: v.rangeLabel || null,
      };
      window.hvSetBaseFromAldoc(base, data || v);
    }
    const hasAldocSets =
      aldocSets.hvSkus.length ||
      aldocSets.nrSkus.length ||
      aldocSets.lsSkus.length;

    if (hasAldocSets) {
      const modelSlugForCards = resolvedModelSlug || vehicleModelSlug || routeModelSlug;
      const makeSlugForCards = makeSlug || routeMakeSlug;

      const buildPairsFromSkus = (skus, kitMap) => {
        const pairs = [];
        const missing = [];
        skus.forEach((sku) => {
          const kit = kitMap.get(sku);
          if (!kit) {
            missing.push(sku);
            return;
          }
          const fitment = pickFitmentForKit(kit, makeSlugForCards, modelSlugForCards);
          pairs.push({ k: kit, f: fitment });
        });
        return { pairs, missing };
      };

      const sortPairsByPrice = (pairs) =>
        pairs.slice().sort((a, b) => {
          const pa = a.k?.pricing_nl?.total_inc_vat_from_eur;
          const pb = b.k?.pricing_nl?.total_inc_vat_from_eur;
          const na = Number.isFinite(+pa) ? +pa : 1e12;
          const nb = Number.isFinite(+pb) ? +pb : 1e12;
          if (na !== nb) return na - nb;
          return String(a.k?.sku || "").localeCompare(String(b.k?.sku || ""));
        });

      const hvKitMap = buildKitMap(kits || []);
      const hvPairs = buildPairsFromSkus(aldocSets.hvSkus, hvKitMap);
      const hvPairsFiltered = hvPairs.pairs.filter((pair) =>
        pairMatchesVehicleContext(pair, CURRENT_ROUTE_CTX)
      );
      if (hvPairs.pairs.length && hvPairsFiltered.length === 0) {
        logRangeEmpty(CURRENT_ROUTE_CTX, hvPairs.pairs, "aldoc-hv");
      }

      let nrPairs = { pairs: [], missing: [] };
      if (aldocSets.nrSkus.length) {
        const nrKits = await fetchNrKits();
        const nrKitMap = buildKitMap(nrKits);
        nrPairs = buildPairsFromSkus(aldocSets.nrSkus, nrKitMap);
      }

      let lsPairs = { pairs: [], missing: [] };
      if (aldocSets.lsSkus.length) {
        const lsKits = await fetchLsKits();
        const lsKitMap = buildKitMap(lsKits);
        lsPairs = buildPairsFromSkus(aldocSets.lsSkus, lsKitMap);
      }

      const nrPairsFiltered = nrPairs.pairs.filter((pair) =>
        pairMatchesVehicleContext(pair, CURRENT_ROUTE_CTX)
      );
      const lsPairsFiltered = lsPairs.pairs.filter((pair) =>
        pairMatchesVehicleContext(pair, CURRENT_ROUTE_CTX)
      );
      if (nrPairs.pairs.length && nrPairsFiltered.length === 0) {
        logRangeEmpty(CURRENT_ROUTE_CTX, nrPairs.pairs, "aldoc-nr");
      }
      if (lsPairs.pairs.length && lsPairsFiltered.length === 0) {
        logRangeEmpty(CURRENT_ROUTE_CTX, lsPairs.pairs, "aldoc-ls");
      }

      const fallbackFiltered = (pairs, filtered, label) => {
        if (pairs.length && filtered.length === 0) {
          console.warn("plate:range_fallback", {
            plate: plateNormalized,
            label,
            count: pairs.length,
          });
          return pairs;
        }
        return filtered;
      };

      const hvPairsSorted = sortPairsByPrice(
        fallbackFiltered(hvPairs.pairs, hvPairsFiltered, "hv")
      );
      const nrPairsSorted = sortPairsByPrice(
        fallbackFiltered(nrPairs.pairs, nrPairsFiltered, "nr")
      );
      const lsPairsSorted = sortPairsByPrice(
        fallbackFiltered(lsPairs.pairs, lsPairsFiltered, "ls")
      );

      const driveAvail = new Set();
      let hasSRW = false;
      let hasDRW = false;
      hvPairsSorted.forEach(({ k, f }) => {
        const dPol = drivePolicyFromFit(f, k);
        (dPol.allowLabels || []).forEach((lbl) => driveAvail.add(lbl));
        const pStrict = rearWheelsPolicyFrom(f, k, true);
        if (pStrict.allow.has("drw")) hasDRW = true;
        const pLax = rearWheelsPolicyFrom(f, k, false);
        if (pLax.allow.has("srw")) hasSRW = true;
      });
      const driveItems = driveChipItems(
        driveAvail,
        makeSlugForCards,
        modelSlugForCards
      );
      const cardOptions = {
        makeLabel,
        modelLabel,
        makeSlug: makeSlugForCards,
        modelSlug: modelSlugForCards,
        showDriveMeta: driveItems.length > 1,
        showRearMeta: hasSRW && hasDRW,
      };

      const crumbsParts = [`<a href="${BASE}">Hulpveren</a>`];
      if (makeSlugForCards) {
        crumbsParts.push(
          `<a href="${BASE}/${esc(makeSlugForCards)}">${esc(makeLabel)}</a>`
        );
      }
      if (modelSlugForCards) {
        crumbsParts.push(
          `<a href="${BASE}/${esc(makeSlugForCards)}/${esc(
            modelSlugForCards
          )}">${esc(modelLabel)}</a>`
        );
      }
      crumbsParts.push("Kenteken");

      const tabCounts = {
        hv: hvPairsSorted.length + hvPairs.missing.length,
        nr: nrPairsSorted.length + nrPairs.missing.length,
        ls: lsPairsSorted.length + lsPairs.missing.length,
      };

      debugLog("plate:tab_counts", tabCounts);

      const tabLabel = (key, label) =>
        `${label} (${tabCounts[key] || 0})`;

      app.innerHTML = wrap(`
        <div class="crumbs">${crumbsParts.join(" > ")}</div>
        <h1>Hulpveren op kenteken: ${esc(plateDisplay)}</h1>
        ${summaryLine}
        <div class="set-meta">
          <span><span id="kit-count">0</span> sets</span>
          <span id="filter-summary" class="muted"></span>
        </div>
        ${plateInfoHtml}
        <div class="chips" id="plate-tabs">
          <span class="chip small" data-tab="hv" data-on="1">${esc(
            tabLabel("hv", "Hulpveren")
          )}</span>
          <span class="chip small" data-tab="nr" data-on="0">${esc(
            tabLabel("nr", "Luchtvering")
          )}</span>
          <span class="chip small" data-tab="ls" data-on="0">${esc(
            tabLabel("ls", "Verlagingsveren")
          )}</span>
        </div>
        <div id="model-grid" class="grid" data-set-list></div>
      `);

      const gridEl = document.getElementById("model-grid");
      const countEl = document.getElementById("kit-count");
      const summaryEl = document.getElementById("filter-summary");
      const tabsEl = document.getElementById("plate-tabs");

      const renderEmpty = () => {
        if (gridEl) {
          gridEl.innerHTML =
            `<p class="note">Geen sets gevonden voor dit kenteken in Aldoc.</p>`;
        }
      };

      const renderTab = (key) => {
        if (!gridEl) return;
        let html = "";
        let count = 0;
        if (key === "hv") {
          const blocks = [
            ...hvPairsSorted.map((pair, idx) =>
              buildModelCard(pair, idx, cardOptions)
            ),
            ...hvPairs.missing.map((sku) =>
              buildGenericSkuCard({
                sku,
                familyLabel: "hulpveren",
                makeLabel,
                modelLabel,
              })
            ),
          ];
          count = blocks.length;
          html = blocks.join("");
        } else if (key === "nr") {
          const blocks = [
            ...nrPairsSorted.map((pair, idx) =>
              buildNrCard(pair, idx, {
                makeLabel,
                modelLabel,
                makeSlug: makeSlugForCards,
                modelSlug: modelSlugForCards,
              })
            ),
            ...nrPairs.missing.map((sku) =>
              buildGenericSkuCard({
                sku,
                familyLabel: "luchtvering",
                makeLabel,
                modelLabel,
              })
            ),
          ];
          count = blocks.length;
          html = blocks.join("");
        } else {
          const blocks = [
            ...lsPairsSorted.map((pair, idx) =>
              buildLsCard(pair, idx, {
                makeLabel,
                modelLabel,
                makeSlug: makeSlugForCards,
                modelSlug: modelSlugForCards,
              })
            ),
            ...lsPairs.missing.map((sku) =>
              buildGenericSkuCard({
                sku,
                familyLabel: "verlagingsveren",
                makeLabel,
                modelLabel,
              })
            ),
          ];
          count = blocks.length;
          html = blocks.join("");
        }

        if (countEl) countEl.textContent = String(count);
        if (summaryEl) summaryEl.textContent = `gevonden: ${count} sets`;

        if (!count) {
          renderEmpty();
          return;
        }
        gridEl.innerHTML = html;
        if (key === "hv") {
          initImagesForGrid();
          bindLeadButtons();
        }
      };

      const setActiveTab = (key) => {
        if (tabsEl) {
          tabsEl.querySelectorAll(".chip").forEach((chip) => {
            chip.setAttribute(
              "data-on",
              chip.getAttribute("data-tab") === key ? "1" : "0"
            );
          });
        }
        renderTab(key);
      };

      if (tabsEl) {
        tabsEl.addEventListener("click", (event) => {
          const chip = event.target.closest(".chip");
          if (!chip) return;
          const key = chip.getAttribute("data-tab") || "hv";
          if (!["hv", "nr", "ls"].includes(key)) return;
          setActiveTab(key);
        });
      }

      setActiveTab("hv");
      renderPlateDebug({
        container: app,
        vehicle,
        allPairs: [],
        filtered: [],
        meta: {
          makeSlug: makeSlugForCards,
          modelSlug: modelSlugForCards,
          source,
          vehicleYM,
          vehicleRange,
          platformCodes,
          caddyGeneration,
          plate: plateNormalized,
        },
      });
      return;
    }

    console.warn("Aldoc: geen MAD-setnummers gevonden voor kenteken", {
      plate: plateNormalized,
      totalItems: aldocSets.totalItems,
      matchedItems: aldocSets.matchedItems,
    });

    let allPairs = [];
    if (makeSlug) {
      for (const k of kits || []) {
        for (const f of k.fitments || []) {
          if (slugify(f.make) !== makeSlug) continue;
          if (resolvedModelSlug && slugify(f.model) !== resolvedModelSlug) continue;
          allPairs.push({ k, f });
        }
      }
    }

    let modelFallback = false;
    if (!allPairs.length && isRdwBasic) {
      app.innerHTML = wrap(`
        <div class="crumbs">
          <a href="${BASE}">Hulpveren</a> >
          Kenteken
        </div>
        <h1>Hulpveren op kenteken: ${esc(plateDisplay)}</h1>
        <p class="note">Geen passende sets gevonden op basis van RDW-gegevens. Kies handmatig je model.</p>
        <div class="cta-row">
          <a class="btn" href="/hulpveren">Kies merk en model</a>
          <a class="btn btn-ghost" href="/kenteken">Opnieuw zoeken</a>
        </div>
      `);
      renderPlateDebug({
        container: app,
        vehicle,
        allPairs: [],
        filtered: [],
        meta: {
          makeSlug,
          modelSlug: resolvedModelSlug || null,
          source,
          vehicleYM,
          vehicleRange,
          platformCodes,
          caddyGeneration,
          plate: plateNormalized,
        },
      });
      return;
    }
    if (!allPairs.length && makeSlug && !isRdwBasic) {
      const makeOnlyPairs = [];
      for (const k of kits || []) {
        for (const f of k.fitments || []) {
          if (slugify(f.make) !== makeSlug) continue;
          makeOnlyPairs.push({ k, f });
        }
      }
      if (makeOnlyPairs.length) {
        allPairs = makeOnlyPairs;
        modelFallback = true;
      }
    }
    const effectiveModelSlug = modelFallback ? "" : resolvedModelSlug;

    debugLog("plate:fallback_pairs", {
      count: allPairs.length,
      modelFallback,
      makeSlug,
      modelSlug: effectiveModelSlug || "",
    });

    if (!allPairs.length) {
      app.innerHTML = wrap(`
        <div class="crumbs">
          <a href="${BASE}">Hulpveren</a> >
          Kenteken
        </div>
        <h1>Hulpveren op kenteken: ${esc(plateDisplay)}</h1>
        <p class="note">Geen passende sets gevonden voor dit kenteken. Neem contact op voor controle.</p>
        <div class="cta-row">
          <a class="btn" href="/hulpveren">Kies merk en model</a>
          <a class="btn btn-ghost" href="https://wa.me/311651320219" target="_blank" rel="noopener noreferrer">WhatsApp</a>
        </div>
      `);
      return;
    }
    const fallbackNote = modelFallback
      ? `<p class="note">Gevonden sets voor ${esc(
          makeLabel
        )}. Controleer het model/uitvoering.</p>`
      : "";

    const contextModelSlug = effectiveModelSlug || modelSlugForContext || routeModelSlug;
    CURRENT_ROUTE_CTX = {
      makeSlug,
      modelSlug: contextModelSlug || null,
      driveException: contextModelSlug ? isDriveException(makeSlug, contextModelSlug) : false,
      plate: plateNormalized,
      vehicleYM,
      vehicleRange,
      platformCodes,
      caddyGeneration,
      isCaddy,
    };

    const { min: yearMin, max: yearMax } = getYearRange(allPairs);
    const showFilters = allPairs.length > 2;

    let hasLeeg = false,
      hasCont = false;
    const driveAvail = new Set();
    let hasSRW = false,
      hasDRW = false;
    const posAvail = new Set();

    for (const { k, f } of allPairs) {
      const mKey = supportKeyOf(f, k);
      if (mKey === "leeg") hasLeeg = true;
      if (mKey === "continue") hasCont = true;

      const dPol = drivePolicyFromFit(f, k);
      (dPol.allowLabels || []).forEach((lbl) => driveAvail.add(lbl));

      const pStrict = rearWheelsPolicyFrom(f, k, true);
      if (pStrict.allow.has("drw")) hasDRW = true;
      const pLax = rearWheelsPolicyFrom(f, k, false);
      if (pLax.allow.has("srw")) hasSRW = true;

      posAvail.add(positionKey(k));
    }

    const yearGroup = showFilters
      ? `
        <div class="grp range" id="grp-year">
          <span class="muted">Bouwjaar</span>
          <div class="range-row">
            <input type="range" id="flt-year" min="${yearMin}" max="${yearMax}" value="${yearMin}">
            <span id="flt-year-label" class="pill">Alle</span>
          </div>
        </div>
      `
      : "";

    let modeGroup = "";
    if (showFilters && hasLeeg && hasCont) {
      modeGroup = `
        <div class="grp toolbar" id="grp-mode">
          <span class="muted">Gebruik:</span>
          <div class="chips" id="mode-chips">
            <span class="chip small" data-key="leeg" data-on="0"><span class="dot"></span>Leeg &amp; beladen</span>
            <span class="chip small" data-key="continue" data-on="0"><span class="dot"></span>Continue beladen</span>
          </div>
        </div>
      `;
    }

    let driveGroup = "";
    const driveItems = driveChipItems(driveAvail, makeSlug, effectiveModelSlug);
    if (showFilters && driveItems.length > 1) {
      driveGroup = `
        <div class="grp toolbar" id="grp-drive">
          <span class="muted">Aandrijving:</span>
          <div class="chips" id="drive-chips">
            ${driveItems
              .map(
                (item) =>
                  `<span class="chip small" data-key="${item.key}" data-on="0"><span class="dot"></span>${item.label}</span>`
              )
              .join("")}
          </div>
        </div>
      `;
    }

    let rearGroup = "";
    if (showFilters && hasSRW && hasDRW) {
      const chips = [];
      if (hasSRW)
        chips.push(
          `<span class="chip small" data-key="srw" data-on="0"><span class="dot"></span>Enkel lucht</span>`
        );
      if (hasDRW)
        chips.push(
          `<span class="chip small" data-key="drw" data-on="0"><span class="dot"></span>Dubbel lucht</span>`
        );
      rearGroup = `
        <div class="grp toolbar" id="grp-rear">
          <span class="muted">Achterwielen:</span>
          <div class="chips" id="rear-chips">
            ${chips.join("")}
          </div>
        </div>
      `;
    }

    let posGroup = "";
    const posList = Array.from(posAvail).filter(Boolean);
    if (showFilters && posList.length > 1) {
      const posOrder = ["rear", "front", "both"];
      const chips = posList.sort(
        (a, b) => posOrder.indexOf(a) - posOrder.indexOf(b)
      );
      posGroup = `
        <div class="grp toolbar" id="grp-pos">
          <span class="muted">As:</span>
          <div class="chips" id="pos-chips">
            ${chips
              .map(
                (key) =>
                  `<span class="chip small" data-key="${key}" data-on="0"><span class="dot"></span>${positionNL(
                    key
                  )}</span>`
              )
              .join("")}
          </div>
        </div>
      `;
    }

    FILTER.year = null;
    const plateYR =
      (plateContext && plateContext.yearRange) ||
      (activeCtx && activeCtx.yearRange) ||
      null;
    const labelPlate = plateYR && plateYR.label ? plateYR.label : formatYearRangeLabel(plateYR);
    FILTER.yearRange = plateYR ? { ...plateYR, label: labelPlate || undefined, source: "plate" } : null;
    FILTER.support.clear();
    FILTER.drive.clear();
    FILTER.rear.clear();
    FILTER.pos.clear();
    const plateDriveKey = driveFilterKeyFromVehicle(
      plateContext && plateContext.vehicle,
      CURRENT_ROUTE_CTX.driveException
    );
    const plateDriveKeys = new Set(driveItems.map((item) => item.key));
    if (plateDriveKey && plateDriveKeys.has(plateDriveKey)) {
      FILTER.drive.add(plateDriveKey);
    }

    const filtersMarkup = [
      yearGroup,
      modeGroup,
      driveGroup,
      rearGroup,
      posGroup,
    ]
      .filter(Boolean)
      .join("");
    const filtersBlock = filtersMarkup
      ? `<div class="filters">${filtersMarkup}</div>`
      : "";

    const crumbsParts = [`<a href="${BASE}">Hulpveren</a>`];
    if (makeSlug) {
      crumbsParts.push(
        `<a href="${BASE}/${esc(makeSlug)}">${esc(makeLabel)}</a>`
      );
    }
    if (effectiveModelSlug) {
      crumbsParts.push(
        `<a href="${BASE}/${esc(makeSlug)}/${esc(effectiveModelSlug)}">${esc(
          modelLabel
        )}</a>`
      );
    }
    crumbsParts.push("Kenteken");

    app.innerHTML = wrap(`
      <div class="crumbs">${crumbsParts.join(" > ")}</div>
      <h1>Hulpveren op kenteken: ${esc(plateDisplay)}</h1>
      ${summaryLine}
      ${fallbackNote}
      <div class="set-meta">
        <span><span id="kit-count">0</span> sets</span>
        <span id="filter-summary" class="muted"></span>
      </div>
      ${plateInfoHtml}
      ${filtersBlock}
      <div id="model-grid" class="grid" data-set-list></div>
    `);

    if (plateContext && plateContext.yearRange && plateContext.yearRange.label) {
      const yearLabel = document.getElementById("flt-year-label");
      if (yearLabel) yearLabel.textContent = plateContext.yearRange.label;
    }
    if (FILTER.drive.size) {
      const driveWrap = document.getElementById("drive-chips");
      if (driveWrap) {
        driveWrap.querySelectorAll(".chip").forEach((chip) => {
          const key = chip.getAttribute("data-key");
          if (FILTER.drive.has(key)) {
            chip.setAttribute("data-on", "1");
          }
        });
      }
    }

    const showDriveMeta = driveItems.length > 1;
    const showRearMeta = hasSRW && hasDRW;
    const cardOptions = {
      makeLabel,
      modelLabel,
      makeSlug,
      modelSlug: effectiveModelSlug,
      showDriveMeta,
      showRearMeta,
    };

    function renderCards() {
      const filtered = filterPairs(allPairs).sort((a, b) => {
        const pa = a.k?.pricing_nl?.total_inc_vat_from_eur;
        const pb = b.k?.pricing_nl?.total_inc_vat_from_eur;
        const na = Number.isFinite(+pa) ? +pa : 1e12;
        const nb = Number.isFinite(+pb) ? +pb : 1e12;
        if (na !== nb) return na - nb;
        return String(a.k?.sku || "").localeCompare(String(b.k?.sku || ""));
      });

      const gridEl = document.getElementById("model-grid");
      const countEl = document.getElementById("kit-count");
      if (countEl) countEl.textContent = String(filtered.length);

      if (!gridEl) return;

      if (!filtered.length) {
        gridEl.innerHTML = `<p class="note">Geen resultaten met deze filters.</p>`;
      } else {
        gridEl.innerHTML = filtered
          .map((pair, idx) => buildModelCard(pair, idx, cardOptions))
          .join("");
      }

      updateFilterSummary();
      initImagesForGrid();
      bindLeadButtons();
      renderPlateDebug({
        container: app,
        vehicle,
        allPairs,
        filtered,
        meta: {
          makeSlug,
          modelSlug: effectiveModelSlug || null,
          source,
          vehicleYM,
          vehicleRange,
          platformCodes,
          caddyGeneration,
          plate: plateNormalized,
        },
      });
    }

    (function bindFilterEvents() {
    const yearInput = document.getElementById("flt-year");
    const yearLabel = document.getElementById("flt-year-label");
    const yearFromInput = document.getElementById("flt-year-from");
    const yearToInput = document.getElementById("flt-year-to");
    if (yearInput && yearLabel) {
      if (FILTER.yearRange) {
        yearLabel.textContent =
          FILTER.yearRange.label || formatYearRangeLabel(FILTER.yearRange) || "Alle";
        if (yearFromInput && FILTER.yearRange.from != null) {
          yearFromInput.value = String(FILTER.yearRange.from);
        }
        if (yearToInput && FILTER.yearRange.to != null) {
          yearToInput.value = String(FILTER.yearRange.to);
        }
        if (yearInput && FILTER.yearRange.from != null) {
          yearInput.value = String(FILTER.yearRange.from);
        }
      }
        yearInput.addEventListener("input", (e) => {
          const v = +e.target.value || yearMin;
          FILTER.year = v;
          FILTER.yearRange = null;
          if (yearFromInput) yearFromInput.value = "";
          if (yearToInput) yearToInput.value = "";
          yearLabel.textContent = String(v);
          renderCards();
        });
        yearLabel.addEventListener("click", () => {
          FILTER.year = null;
          yearLabel.textContent =
            FILTER.yearRange && FILTER.yearRange.label
              ? FILTER.yearRange.label
              : "Alle";
          if (yearFromInput) yearFromInput.value = FILTER.yearRange?.from ?? "";
          if (yearToInput) yearToInput.value = FILTER.yearRange?.to ?? "";
          yearInput.value = String(yearMin);
          renderCards();
        });
      }
      if (yearFromInput || yearToInput) {
        const updateRange = () => {
          const from = yearFromInput && yearFromInput.value ? parseInt(yearFromInput.value, 10) : null;
          const to = yearToInput && yearToInput.value ? parseInt(yearToInput.value, 10) : null;
          FILTER.year = null;
          const nextRange =
            from != null || to != null
              ? { from: Number.isFinite(from) ? from : null, to: Number.isFinite(to) ? to : null, label: null, source: "manual" }
              : FILTER.yearRange && FILTER.yearRange.source === "plate"
              ? FILTER.yearRange
              : null;
          if (nextRange) {
            nextRange.label = nextRange.label || formatYearRangeLabel(nextRange);
          }
          FILTER.yearRange = nextRange;
          if (yearLabel) {
            yearLabel.textContent =
              (FILTER.yearRange && FILTER.yearRange.label) || formatYearRangeLabel(FILTER.yearRange) || "Alle";
          }
          renderCards();
        };
        if (yearFromInput) yearFromInput.addEventListener("input", updateRange);
        if (yearToInput) yearToInput.addEventListener("input", updateRange);
      }

      const modeWrap = document.getElementById("mode-chips");
      if (modeWrap) {
        modeWrap.addEventListener("click", (e) => {
          const chip = e.target.closest(".chip");
          if (!chip) return;
          const key = chip.getAttribute("data-key");
          const on = chip.getAttribute("data-on") === "1";
          chip.setAttribute("data-on", on ? "0" : "1");
          if (on) FILTER.support.delete(key);
          else FILTER.support.add(key);
          renderCards();
        });
      }

      const driveWrap = document.getElementById("drive-chips");
      if (driveWrap) {
        driveWrap.addEventListener("click", (e) => {
          const chip = e.target.closest(".chip");
          if (!chip) return;
          const key = chip.getAttribute("data-key");
          const on = chip.getAttribute("data-on") === "1";
          chip.setAttribute("data-on", on ? "0" : "1");
          if (on) FILTER.drive.delete(key);
          else FILTER.drive.add(key);
          renderCards();
        });
      }

      const rearWrap = document.getElementById("rear-chips");
      if (rearWrap) {
        rearWrap.addEventListener("click", (e) => {
          const chip = e.target.closest(".chip");
          if (!chip) return;
          const key = chip.getAttribute("data-key");
          const on = chip.getAttribute("data-on") === "1";
          chip.setAttribute("data-on", on ? "0" : "1");
          if (on) FILTER.rear.delete(key);
          else FILTER.rear.add(key);
          renderCards();
        });
      }
      const posWrap = document.getElementById("pos-chips");
      if (posWrap) {
        posWrap.addEventListener("click", (e) => {
          const chip = e.target.closest(".chip");
          if (!chip) return;
          const key = chip.getAttribute("data-key");
          const on = chip.getAttribute("data-on") === "1";
          chip.setAttribute("data-on", on ? "0" : "1");
          if (on) FILTER.pos.delete(key);
          else FILTER.pos.add(key);
          renderCards();
        });
      }
    })();

    renderCards();

  }

  /* ================== Data ophalen & app starten ================== */

  async function fetchJson(url, fallback = []) {
    try {
      const res = await fetch(url, { cache: "force-cache" });
      if (!res.ok) return fallback;
      return await res.json();
    } catch {
      return fallback;
    }
  }

  function buildMakesFromBrandModel(brands, models) {
    const out = new Map();
    const modelByMake = new Map();

    (models || []).forEach((m) => {
      const makeSlug = slugify(m.MAKE_SLUG || m.MAKE || "");
      const modelSlug = slugify(m.MODEL_SLUG || m.MODEL || m.MODEL_NAME || "");
      const modelLabel = m.MODEL || m.MODEL_NAME || m.MODEL_SLUG || modelSlug;
      if (!makeSlug || !modelSlug) return;
      if (!modelByMake.has(makeSlug)) modelByMake.set(makeSlug, []);
      modelByMake.get(makeSlug).push({ slug: modelSlug, label: modelLabel });
    });

    (brands || []).forEach((b) => {
      const makeSlug = slugify(b.MAKE_SLUG || b.MAKE_RAW || b.MAKE || "");
      if (!makeSlug) return;
      const label = b.MAKE || b.MAKE_RAW || b.MAKE_SLUG || makeSlug;
      const modelMap = new Map();
      (modelByMake.get(makeSlug) || []).forEach(({ slug, label: ml }) => {
        if (!slug) return;
        if (!modelMap.has(slug) || ml.length > (modelMap.get(slug) || "").length) {
          modelMap.set(slug, ml);
        }
      });
      out.set(makeSlug, { label, models: modelMap });
    });

    return out;
  }

  async function fetchNrLsMakes(brandUrl, modelUrl) {
    const brands = await fetchJson(brandUrl, []);
    const models = await fetchJson(modelUrl, []);
    return buildMakesFromBrandModel(brands, models);
  }

  async function fetchKits(url, allowedFamilies) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        console.warn("kits:fetch_failed", { url, status: res.status });
        return [];
      }
      const data = await res.json();
      const kits = Array.isArray(data) ? data : data.kits || [];
      const filtered = kits.filter((k) => {
        const fc = String(k.family_code || "").toUpperCase();
        return allowedFamilies.has(fc);
      });
      if (!filtered.length && kits.length) {
        console.warn("kits:family_empty", {
          url,
          families: Array.from(allowedFamilies),
          total: kits.length,
        });
      }
      return filtered;
    } catch (err) {
      console.warn("kits:fetch_error", { url, error: err?.message || String(err) });
      return [];
    }
  }

  const fetchHvKits = () =>
    fetchKits(DATA_URL, new Set(["HV", "SD", "LV"]));
  const fetchNrKits = () => fetchKits("/data/nr-kits.json", new Set(["NR"]));
  const fetchLsKits = () => fetchKits("/data/ls-kits.json", new Set(["LS"]));

  function yearToNum(v) {
    const m = String(v || "").match(/\d{4}/);
    if (!m) return null;
    const n = parseInt(m[0], 10);
    return Number.isFinite(n) ? n : null;
  }

  function enginesText(kit, fitment) {
    const arr = enginesFromKitAndNotes(kit, fitment);
    return (arr || []).filter(Boolean).join(", ");
  }

  function priceLabel(val) {
    if (val == null || val === "") return "Prijs op aanvraag";
    const num = Number(val);
    if (!Number.isFinite(num)) return "Prijs op aanvraag";
    return `&euro; ${Math.round(num)}`;
  }

  function approvalClean(val) {
    const t = approvalNL(val);
    if (!t || t === "-") return "";
    return t;
  }

  function buildMetaRow(label, value) {
    const val =
      value === undefined || value === null || String(value).trim() === ""
        ? "—"
        : String(value);
    return `<div class="k">${esc(label)}</div><div class="v">${esc(val)}</div>`;
  }

  function renderNrModel(kits, makes, makeSlug, modelSlug) {
    if (!hasApp) return;
    suppressHomeSectionsForApp();
      const plateContext = buildPlateContext({ base: NR_BASE, makeSlug, modelSlug });
      const activeCtx = getActivePlateContext();
      const resolvedMake =
        makeSlug ||
        plateContext?.route?.makeSlug ||
        activeCtx?.route?.makeSlug ||
        plateContext?.vehicle?.makeSlug ||
        activeCtx?.vehicle?.makeSlug ||
        "";
      const resolvedModel =
        modelSlug ||
        plateContext?.route?.modelSlug ||
        activeCtx?.route?.modelSlug ||
        plateContext?.vehicle?.modelSlug ||
        activeCtx?.vehicle?.modelSlug ||
        "";
      const entry = makes.get(resolvedMake);
      const makeLabel = entry?.label || resolvedMake;
      const modelLabel =
        (entry?.models && entry.models.get(resolvedModel)) || resolvedModel;
      const useMake = resolvedMake || makeSlug;
      const useModel = resolvedModel || modelSlug;
      const plateInfoHtml = buildPlateInfoHtml(plateContext);
      const plateYearRange =
        (plateContext && plateContext.yearRange) ||
        (activeCtx && activeCtx.yearRange) ||
        null;
      const vehicleActive = Boolean(activeCtx && activeCtx.plate);

    FILTER.year = null;
    const plateLabel =
      plateYearRange && plateYearRange.label
        ? plateYearRange.label
        : formatYearRangeLabel(plateYearRange);
    FILTER.yearRange = plateYearRange
      ? { ...plateYearRange, label: plateLabel || undefined, source: "plate" }
      : null;

    const pairs = [];
    for (const k of kits || []) {
      for (const f of k.fitments || []) {
        if (slugify(f.make) !== useMake) continue;
        if (useModel && slugify(f.model) !== useModel) continue;
        pairs.push({ k, f });
      }
    }

    if (!pairs.length) {
      console.warn("kits:nr_model_empty", {
        makeSlug,
        modelSlug,
        totalKits: Array.isArray(kits) ? kits.length : 0,
      });
      const plateLabel =
        (activeCtx && (activeCtx.plate || activeCtx.plateSlug)) ||
        (plateContext && (plateContext.plate || plateContext.plateSlug)) ||
        "";
      const msg = plateLabel
        ? `Geen sets beschikbaar voor ${esc(makeLabel)} ${esc(
            modelLabel
          )} (kenteken ${esc(plateLabel)}).`
        : `Geen sets beschikbaar voor ${esc(makeLabel)} ${esc(modelLabel)}.`;
      app.innerHTML = wrap(`
        <div class="crumbs">
          <a href="${NR_BASE}">Luchtvering</a> > ${esc(makeLabel)} > ${esc(
        modelLabel
      )}
        </div>
        <p class="note">${msg}</p>
      `);
      return;
    }

    const years = [];
    const posSet = new Set();
    const apprSet = new Set();
    let hasEngine = false;

    pairs.forEach(({ k, f }) => {
      const y1 = yearToNum(f.year_from);
      const y2 = yearToNum(f.year_to);
      if (y1 !== null) years.push(y1);
      if (y2 !== null) years.push(y2);
      const pos = positionKey(k);
      if (pos) posSet.add(pos);
      const appr = approvalClean(k.approval);
      if (appr) apprSet.add(appr);
      const engine = enginesText(k, f);
      if (engine) hasEngine = true;
    });

    const cardsBlock = pairs
      .map((pair, idx) => buildNrCard(pair, idx, { makeLabel, modelLabel, makeSlug, modelSlug }))
      .join("\n");

    const yearsAvail = years.filter((n) => Number.isFinite(n));
    const yearMin = yearsAvail.length ? Math.min(...yearsAvail) : 1990;
    const yearMax = yearsAvail.length
      ? Math.max(...yearsAvail)
      : new Date().getFullYear();
    const showYear = yearsAvail.length > 0 && yearMin <= yearMax;
    const showPos = posSet.size > 1;
    const showAppr = apprSet.size > 1;
    const showEngine = hasEngine;

    const filters = [];
    if (showYear) {
      filters.push(`
        <div class="grp" style="display:flex;gap:10px;align-items:center;border:1px solid #e4e7ec;padding:8px 10px;border-radius:10px;">
          <span class="muted">Bouwjaar</span>
          <input type="range" id="nr-year-slider" min="${yearMin}" max="${yearMax}" value="0" style="width:180px;">
          <span class="muted" id="nr-year-label">Alle</span>
          <input type="number" id="nr-year-from" placeholder="van" style="width:90px;padding:6px 8px;">
          <input type="number" id="nr-year-to" placeholder="tot" style="width:90px;padding:6px 8px;">
        </div>`);
    }
    if (showPos) {
      const posOptions = ["front", "rear", "both"];
      filters.push(`
        <div class="grp" style="display:flex;gap:6px;align-items:center;border:1px solid #e4e7ec;padding:8px 10px;border-radius:10px;flex-wrap:wrap;">
          <span class="muted">As</span>
          ${posOptions
            .filter((p) => posSet.has(p))
            .map(
              (p) =>
                `<label><input type="checkbox" class="nr-pos" value="${p}"> ${positionNL(
                  p
                )}</label>`
            )
            .join("")}
        </div>`);
    }
    if (showAppr) {
      filters.push(`
        <div class="grp" style="display:flex;gap:6px;align-items:center;border:1px solid #e4e7ec;padding:8px 10px;border-radius:10px;flex-wrap:wrap;">
          <span class="muted">Goedkeuring</span>
          ${Array.from(apprSet)
            .map(
              (a) =>
                `<label><input type="checkbox" class="nr-appr" value="${esc(
                  a.toLowerCase()
                )}"> ${esc(a)}</label>`
            )
            .join("")}
        </div>`);
    }
    if (showEngine) {
      filters.push(`
        <div class="grp" style="display:flex;gap:6px;align-items:center;border:1px solid #e4e7ec;padding:8px 10px;border-radius:10px;">
          <span class="muted">Motor</span>
          <input type="text" id="nr-engine" placeholder="bijv. diesel, hybrid, 2.0" style="width:180px;padding:6px 8px;">
        </div>`);
    }
    if (filters.length) {
      filters.push(`
        <div class="grp" style="display:flex;gap:6px;align-items:center;border:1px solid #e4e7ec;padding:8px 10px;border-radius:10px;">
          <button id="nr-apply" class="btn" type="button" style="padding:8px 10px;">Filter</button>
          <button id="nr-reset" class="btn btn-ghost" type="button" style="padding:8px 10px;">Reset</button>
          <span class="muted">Resultaten: <span id="nr-count"></span></span>
        </div>`);
    }

    const filtersBlock = filters.length
      ? `<div class="filters" id="nr-filters" style="display:flex;flex-wrap:wrap;gap:10px;margin:0 0 16px 0;">${filters.join(
          ""
        )}</div>`
      : "";

    const seoHtml = hvSeoRenderModel(pairs, { makeLabel, modelLabel, makeSlug, modelSlug });

      app.innerHTML = wrap(`
        <div class="crumbs">
          <a href="${NR_BASE}">Luchtvering</a> >
          <a href="${NR_BASE}/${esc(makeSlug)}">${esc(makeLabel)}</a> >
          ${esc(modelLabel)}
      </div>
      <h1>${esc(makeLabel)} ${esc(modelLabel)} luchtvering</h1>
      ${plateInfoHtml}
      ${seoHtml || ""}
      ${filtersBlock}
      <div class="grid" id="nr-grid">
        ${cardsBlock}
      </div>
    `);

    const grid = document.getElementById("nr-grid");
    const cards = Array.prototype.slice.call(
      grid ? grid.querySelectorAll(".card.product") : []
    );
    const yearSlider = document.getElementById("nr-year-slider");
    const yearLabel = document.getElementById("nr-year-label");
    const yearFrom = document.getElementById("nr-year-from");
    const yearTo = document.getElementById("nr-year-to");
    const engineInput = document.getElementById("nr-engine");
    const posBoxes = Array.prototype.slice.call(
      document.querySelectorAll(".nr-pos")
    );
    const apprBoxes = Array.prototype.slice.call(
      document.querySelectorAll(".nr-appr")
    );
    const countEl = document.getElementById("nr-count");

    if (yearLabel && FILTER.yearRange) {
      yearLabel.textContent =
        FILTER.yearRange.label || formatYearRangeLabel(FILTER.yearRange) || "Alle";
    }

    if (plateYearRange) {
      const from = plateYearRange.from ?? plateYearRange.to;
      const to = plateYearRange.to ?? plateYearRange.from;
      if (yearFrom && from != null) yearFrom.value = String(from);
      if (yearTo && to != null) yearTo.value = String(to);
      if (yearSlider) yearSlider.value = 0;
    }

    if (yearSlider && yearsAvail.length) {
      yearSlider.min = yearMin;
      yearSlider.max = yearMax;
      yearSlider.value = 0;
      if (yearLabel) yearLabel.textContent = "Alle";
      yearSlider.addEventListener("input", () => {
        const v = parseInt(yearSlider.value, 10);
        if (!Number.isFinite(v) || v === 0) {
          if (yearLabel) yearLabel.textContent = "Alle";
        } else if (yearLabel) yearLabel.textContent = String(v);
      });
    }

    if (plateYearRange && yearLabel && plateYearRange.label) {
      yearLabel.textContent = plateYearRange.label;
    }

    function num(v) {
      const n = parseInt(v, 10);
      return Number.isFinite(n) ? n : null;
    }

    function match(card) {
      const yf = num(yearFrom && yearFrom.value);
      const yt = num(yearTo && yearTo.value);
      let ys = num(yearSlider && yearSlider.value);
      if (ys === 0) ys = null;
      const eng = (engineInput && engineInput.value || "").toLowerCase().trim();
      const cy1 = num(card.dataset.yearFrom);
      const cy2 = num(card.dataset.yearTo);
      const cardPos = (card.dataset.pos || "").toLowerCase();
      const cardAppr = (card.dataset.approval || "").toLowerCase();
      const cardEngine = (card.dataset.engine || "").toLowerCase();
      const posSel = posBoxes
        .filter((b) => b.checked)
        .map((b) => b.value.toLowerCase());
      const apprSel = apprBoxes
        .filter((b) => b.checked)
        .map((b) => b.value.toLowerCase());

      if (yf !== null && cy2 !== null && yf > cy2) return false;
      if (yt !== null && cy1 !== null && yt < cy1) return false;
      if (ys !== null) {
        if (cy1 !== null && ys < cy1) return false;
        if (cy2 !== null && ys > cy2) return false;
      }
      if (eng) {
        if (!cardEngine || cardEngine.indexOf(eng) === -1) return false;
      }
      if (posSel.length && posSel.indexOf(cardPos) === -1) return false;
      if (apprSel.length && apprSel.indexOf(cardAppr) === -1) return false;
      return true;
    }

    let initialApply = true;
    function apply() {
      let visible = 0;
      cards.forEach((c) => {
        const ok = match(c);
        c.style.display = ok ? "" : "none";
        if (ok) visible += 1;
      });
      if (countEl) countEl.textContent = String(visible);
      if (initialApply) {
        initialApply = false;
        if (!visible && vehicleActive) {
          window.location.href = `${NR_BASE}/${makeSlug}/`;
        }
      }
    }

    const applyBtn = document.getElementById("nr-apply");
    const resetBtn = document.getElementById("nr-reset");
    if (applyBtn) applyBtn.addEventListener("click", apply);
  if (resetBtn)
    resetBtn.addEventListener("click", () => {
      if (yearSlider && yearsAvail.length) {
        yearSlider.value = 0;
        if (yearLabel) yearLabel.textContent = "Alle";
        }
        if (yearFrom) yearFrom.value = "";
        if (yearTo) yearTo.value = "";
        if (engineInput) engineInput.value = "";
        posBoxes.forEach((b) => (b.checked = false));
        apprBoxes.forEach((b) => (b.checked = false));
        apply();
      });

    apply();
  }


  // Build range injection + sync + filter trigger
  (function () {
    function parseCompactRange(s) {
      s = String(s || "").trim();
      if (!s) return { from: "", to: "" };
      s = s.replace("—", "/").replace("-", "-");
      const parts = s.split("/");
      if (parts.length < 2) return { from: "", to: "" };
      const a = parts[0].trim();
      const b = parts[1].trim();
      function toYM(mmYYYY) {
        const m = mmYYYY.match(/^(\d{2})-(\d{4})$/);
        if (!m) return "";
        return `${m[2]}-${m[1]}`;
      }
      return { from: toYM(a), to: toYM(b) };
    }

    function ctx() {
      return (
        window.hv_plate_context || (window.hv_plate_context = { plate: "", vehicle: {} })
      );
    }

    function triggerFilterRefresh() {
      if (typeof window.applyHvFilters === "function") window.applyHvFilters();
      else if (typeof window.applyFilters === "function") window.applyFilters();
      else window.dispatchEvent(new Event("hv:filtersChanged"));
    }

    function ensureBuildRangeInputs() {
      const host =
        document.querySelector("[data-build-range]") ||
        document.querySelector("#build-range") ||
        document.querySelector(".build-range");

      if (!host) return;
      if (host.querySelector("[data-build-from]")) return;

      const compactText = host.getAttribute("data-range") || host.textContent || "";
      const parsed = parseCompactRange(compactText);

      const v = ctx().vehicle || (ctx().vehicle = {});
      const fromInit = v.buildFrom || v.build_from || parsed.from || "";
      const toInit = v.buildTo || v.build_to || parsed.to || "";

      v.buildFrom = fromInit;
      v.buildTo = toInit;

      const y0 = fromInit ? Number(String(fromInit).slice(0, 4)) : null;
      const y1 = toInit ? Number(String(toInit).slice(0, 4)) : null;
      if (y0) v.yearMin = y0;
      if (y1) v.yearMax = y1;

      host.innerHTML = `
        <div class="build-range-fields">
          <label class="br-label">Van</label>
          <input class="br-input" type="month" data-build-from />
          <label class="br-label">Tot</label>
          <input class="br-input" type="month" data-build-to />
        </div>
      `;

      const inpFrom = host.querySelector("[data-build-from]");
      const inpTo = host.querySelector("[data-build-to]");
      inpFrom.value = fromInit;
      inpTo.value = toInit;

      function onChange() {
        const v2 = ctx().vehicle || (ctx().vehicle = {});
        v2.buildFrom = inpFrom.value || "";
        v2.buildTo = inpTo.value || "";

        const yy0 = v2.buildFrom ? Number(String(v2.buildFrom).slice(0, 4)) : null;
        const yy1 = v2.buildTo ? Number(String(v2.buildTo).slice(0, 4)) : null;
        v2.yearMin = yy0 || undefined;
        v2.yearMax = yy1 || undefined;

        triggerFilterRefresh();
      }

      inpFrom.addEventListener("change", onChange);
      inpTo.addEventListener("change", onChange);

      triggerFilterRefresh();
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", ensureBuildRangeInputs);
    } else {
      ensureBuildRangeInputs();
    }
  })();


  async function run() {
    let kits = [];
    let makes = new Map();
    let family = CURRENT_FAMILY;
    let base = CURRENT_BASE;

    if (family === "nr") {
      const nrMakes = await fetchNrLsMakes("/data/nr-brand-pages.json", "/data/nr-model-pages.json");
      kits = await fetchNrKits();
      makes = nrMakes.size ? nrMakes : buildIndex(kits);
      base = NR_BASE;
    } else if (family === "ls") {
      const lsMakes = await fetchNrLsMakes("/data/ls-brand-pages.json", "/data/ls-model-pages.json");
      kits = await fetchLsKits();
      makes = lsMakes.size ? lsMakes : buildIndex(kits);
      base = LS_BASE;
    } else {
      kits = await fetchHvKits();
      makes = buildIndex(kits);
      family = "hv";
      base = HV_BASE;
    }

    const route = parseRoute(location.pathname, base);
    const plateToken = hasPlateToken(location.pathname, base);
    const isPlatePath = plateToken || isPlateRoutePath(location.pathname);

    debugLog("route:match", {
      path: location.pathname,
      base,
      family,
      isAppRoute,
      hasApp,
      plateToken,
      route,
    });

    if (isPlatePath) {
      applyPlateLayout();
      suppressHomeSectionsOnPlate();
    }

    // Footer mag altijd
    initFooter(makes, route, base, family);
    applyFooterFallback(base, family);
    insertGemonteerdGallery({ route, makes, kits });
    insertExperienceGallery({ makes, kits });

    // Alleen renderen als er een app-container is
    if (!hasApp) return;

    if (family === "hv") {
      if (plateToken && route.kind !== "plate") {
        renderPlateRouteError("Kentekenroute wordt niet herkend.");
        return;
      }
      if (route.kind === "brands") return renderBrands(makes);
      if (route.kind === "make") return renderMake(makes, route.make);
      if (route.kind === "model") return renderModel(kits, makes, route.make, route.model);
      if (route.kind === "plate") return renderPlateModel(kits, makes, route);
      return;
    }

    if (family === "nr") {
      if (route.kind === "model" || route.kind === "plate") {
        renderNrModel(kits, makes, route.make, route.model);
      }
      return;
    }

    if (family === "ls") {
      if (route.kind === "model" || route.kind === "plate") {
        renderNrModel(kits, makes, route.make, route.model);
      }
      return;
    }
  }

  run().catch((err) => {
    console.error(err);
    if (hasApp && app) {
      app.innerHTML = wrap(`
        <h1>Fout</h1>
        <pre>${esc(err?.message || String(err))}</pre>
        <p>Test: <a href="${DATA_URL}">${DATA_URL}</a></p>
      `);
    }
  });
})();
