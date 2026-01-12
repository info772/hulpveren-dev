// /assets/js/header.js
(() => {
  "use strict";
  if (document.querySelector("script[src*=\"/partials/header.js\"]")) return;

  // JS hooks (markup must align):
  // - Burger toggle: [data-hv2-toggle], overlay: [data-hv2-overlay], drawer: [data-hv2-drawer], state class on .hv2-header = "hv2-open"
  // - Mobile close: any link in .hv2-nav, body gets .nav-open when drawer open
  // - Mega menu: items use .nav-item-mega/.hv-nav-item-mega, trigger .nav-toggle-cta/.hv-nav-toggle, panel .mega-panel/.hv-mega-panel, open class "is-open"

  if (window.__HV_HEADER_V2_LOADED__) return;
  window.__HV_HEADER_V2_LOADED__ = true;

  const PARTIAL_URL = "/partials/header-v2.html";
  const BUILD_ID_URL = "/assets/build-id.txt";

  const sanitizeBuildId = (value) =>
    String(value || "")
      .trim()
      .replace(/[^a-zA-Z0-9._-]/g, "");

  const updateAssetUrl = (url, buildId) => {
    if (!url) return url;
    try {
      const parsed = new URL(url, window.location.origin);
      if (!parsed.pathname.startsWith("/assets/")) return url;
      parsed.searchParams.set("v", buildId);
      return parsed.pathname + parsed.search + parsed.hash;
    } catch {
      return url;
    }
  };

  const applyBuildId = (buildId) => {
    const cleaned = sanitizeBuildId(buildId);
    if (!cleaned) return;

    document.documentElement.dataset.buildId = cleaned;

    const currentScript = document.currentScript;
    const updateAttr = (el, attr) => {
      const raw = el.getAttribute(attr);
      const next = updateAssetUrl(raw, cleaned);
      if (next && raw !== next) {
        el.setAttribute(attr, next);
      }
    };

    document
      .querySelectorAll('link[rel="stylesheet"][href]')
      .forEach((link) => updateAttr(link, "href"));

    document.querySelectorAll("script[src]").forEach((script) => {
      if (script === currentScript) return;
      updateAttr(script, "src");
    });

    if (currentScript) {
      const raw = currentScript.getAttribute("src") || "";
      if (raw && raw.indexOf("v=") === -1) {
        const warmed = updateAssetUrl(raw, cleaned);
        if (warmed && warmed !== raw) {
          const warmScript = document.createElement("script");
          warmScript.src = warmed;
          warmScript.defer = true;
          warmScript.dataset.hvBuildWarm = "1";
          document.head.appendChild(warmScript);
        }
      }
    }
  };

  const fallbackBuildId = () => {
    applyBuildId(String(Date.now()));
  };

  const ensureBuildId = async () => {
    try {
      const res = await fetch(BUILD_ID_URL, { cache: "no-store" });
      if (!res.ok) {
        fallbackBuildId();
        return;
      }
      const text = await res.text();
      if (!String(text || "").trim()) {
        fallbackBuildId();
        return;
      }
      applyBuildId(text);
    } catch {
      fallbackBuildId();
    }
  };

  const getMountTarget = () => {
    const existing = document.getElementById("site-header");
    if (existing) return { mountEl: existing };

    const legacy = document.querySelector("header.site-header");
    if (legacy) return { legacy };

    return {};
  };

  const createMountEl = (fallbackTarget) => {
    const mountEl = document.createElement("div");
    mountEl.id = "site-header";

    if (fallbackTarget && fallbackTarget.parentNode) {
      fallbackTarget.parentNode.replaceChild(mountEl, fallbackTarget);
      return mountEl;
    }

    const body = document.body || document.documentElement;
    if (body.firstChild) {
      body.insertBefore(mountEl, body.firstChild);
    } else {
      body.appendChild(mountEl);
    }

    return mountEl;
  };

  const isMobileNav = () =>
    window.matchMedia("(max-width: 1023px)").matches;

  const setNavState = (header, toggle, overlay, drawer, open) => {
    const mobile = isMobileNav();
    header.classList.toggle("hv2-open", open);
    document.body.classList.toggle("nav-open", mobile && open);
    document.documentElement.classList.toggle("menu-open", mobile && open);
    if (toggle) toggle.setAttribute("aria-expanded", open ? "true" : "false");
    if (overlay) overlay.setAttribute("aria-hidden", mobile && open ? "false" : "true");
    if (drawer) drawer.setAttribute("aria-hidden", mobile ? (open ? "false" : "true") : "false");
  };

  const ensureDrawerClosedOnMount = (mountEl) => {
    const root = mountEl || document;
    const header = root.querySelector(".hv2-header");
    if (!header) return;
    const toggle = root.querySelector("[data-hv2-toggle]");
    const overlay = root.querySelector("[data-hv2-overlay]");
    const drawer = root.querySelector("[data-hv2-drawer]");
    setNavState(header, toggle, overlay, drawer, false);
    document.body.classList.remove("nav-open");
    document.documentElement.classList.remove("menu-open");
    header.classList.remove("hv2-open");
    root.querySelectorAll(".hv-mega-panel, .mega-panel").forEach((panel) => {
      panel.hidden = true;
      panel.classList.remove("is-open");
    });
    root.querySelectorAll(".hv-nav-toggle, .nav-toggle-cta").forEach((trig) => trig.setAttribute("aria-expanded", "false"));
  };

  const slugify = (s) =>
    String(s)
      .toLowerCase()
      .trim()
      .replace(/&/g, "en")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const normalizePlate = (value) =>
    String(value || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");

  const plateGroupUrl = (group, plate) => {
    const p = normalizePlate(plate);
    if (!p) return "/";
    const slug = `kt_${p.toLowerCase()}`;
    switch (group) {
      case "hv":
        return `/hulpveren/${slug}/`;
      case "air":
        return `/luchtvering/${slug}/`;
      case "ls":
        return `/verlagingsveren/${slug}/`;
      default:
        return `/hulpveren/${slug}/`;
    }
  };

  const openPlateGroupOverlay = (plate) => {
    const p = normalizePlate(plate);
    if (!p) return;
    const overlay = document.getElementById("plate-group-overlay");
    if (!overlay) return;
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    const plateEl = document.getElementById("pgo-plate");
    if (plateEl) plateEl.textContent = p;
    overlay.dataset.plate = p;
    document.documentElement.classList.add("menu-open");
  };

  const closePlateGroupOverlay = () => {
    const overlay = document.getElementById("plate-group-overlay");
    if (!overlay) return;
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    delete overlay.dataset.plate;
    const navOpen =
      document.body.classList.contains("nav-open") ||
      document.querySelector(".hv2-header")?.classList.contains("hv2-open");
    if (!navOpen) {
      document.documentElement.classList.remove("menu-open");
    }
  };

  const initPlateGroupOverlay = () => {
    const overlay = document.getElementById("plate-group-overlay");
    if (!overlay || overlay.dataset.pgoBound === "1") return;
    overlay.dataset.pgoBound = "1";
    overlay.addEventListener("click", (event) => {
      const target = event.target;
      if (target && target.matches("[data-pgo-close]")) {
        event.preventDefault();
        closePlateGroupOverlay();
        return;
      }
      const btn = target && target.closest && target.closest("[data-pgo-go]");
      if (!btn) return;
      event.preventDefault();
      const plate = overlay.dataset.plate || "";
      const group = btn.getAttribute("data-pgo-go") || "";
      window.location.href = plateGroupUrl(group, plate);
    });
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closePlateGroupOverlay();
    });
  };

  window.openPlateGroupOverlay = openPlateGroupOverlay;
  window.closePlateGroupOverlay = closePlateGroupOverlay;

  const MAKES_URL = "/data/makes.json";
  let makesPromise = null;

  const loadMakesJson = async () => {
    try {
      const url = `${MAKES_URL}?ts=${Date.now()}`;
      document.documentElement.dataset.hvMakesLoader = "1";
      console.log("[header][makes] start", url);
      const res = await fetch(url, { cache: "no-store" });
      console.log("[header][makes] status", res.status, res.ok);
      if (!res.ok) {
        console.error("[header][makes] fail status", res.status);
        document.documentElement.dataset.hvMakesErr = "1";
        return null;
      }
      const data = await res.json();
      return { url, data };
    } catch (e) {
      console.error("[header][makes] fail", e);
      document.documentElement.dataset.hvMakesErr = "1";
      return null;
    }
  };

  const getMakes = () => {
    if (!makesPromise) {
      makesPromise = loadMakesJson();
    }
    return makesPromise.then((result) => {
      if (!result) {
        makesPromise = null;
      }
      return result;
    });
  };

  const normalizeMakes = (data) => {
    const pick = (obj, path) =>
      path.split(".").reduce((o, k) => (o && o[k] != null ? o[k] : null), obj);

    const raw =
      (Array.isArray(data) && data) ||
      pick(data, "makes") ||
      pick(data, "brands") ||
      pick(data, "data.makes") ||
      pick(data, "data.brands") ||
      pick(data, "items") ||
      pick(data, "data.items") ||
      pick(data, "result.makes") ||
      pick(data, "result.brands") ||
      [];

    const arr = Array.isArray(raw) ? raw : [];

    return arr
      .map((b) => {
        if (typeof b === "string") return { name: b, slug: slugify(b) };

        const name = b.name || b.make || b.label || b.merk || b.brand || b.title || "";
        const slug = b.slug || b.handle || b.code || slugify(name);

        return { name, slug };
      })
      .filter((x) => x.name && x.slug);
  };

  const renderMakes = (listEl, makes, routePrefix) => {
    if (!makes.length) {
      console.warn("[header][makes] empty");
      listEl.innerHTML = `<li class="mega-item"><span class="mega-link">Geen merken gevonden</span></li>`;
      return;
    }

    const frag = document.createDocumentFragment();
    makes.forEach((m) => {
      const li = document.createElement("li");
      li.className = "mega-item";
      const a = document.createElement("a");
      a.className = "mega-link";
      a.href = `${routePrefix}${m.slug}/`;
      a.textContent = m.name;
      li.appendChild(a);
      frag.appendChild(li);
    });

    listEl.innerHTML = "";
    listEl.appendChild(frag);
    listEl.classList.add("is-ready");
  };

  const mountMakesInto = async (selector, routePrefix, flagKey) => {
    const listEl = document.querySelector(selector);
    console.log("[header][makes] list", selector, !!listEl);
    if (!listEl) return;
    if (listEl.dataset[flagKey] === "1") return;

    const result = await getMakes();
    if (!result) {
      console.warn("[header][makes] no data for", selector);
      return;
    }

    const makes = normalizeMakes(result.data).sort((a, b) =>
      a.name.localeCompare(b.name, "nl", { sensitivity: "base" })
    );

    console.log("[header][makes] loaded from:", result.url, "count:", makes.length, "selector:", selector);
    document.documentElement.dataset.hvMakesOk = "1";
    document.documentElement.dataset.hvMakesCount = String(makes.length);
    renderMakes(listEl, makes, routePrefix);
    listEl.dataset[flagKey] = "1";
  };

  const mountMakesWhenReady = () => {
    const selectors = [
      { sel: "[data-hv-brands-list]", route: "/hulpveren/", flag: "hvBrandsReady" },
      { sel: "[data-hv-air-list]", route: "/luchtvering/", flag: "hvAirReady" },
      { sel: "[data-hv-lowering-list]", route: "/verlagingsveren/", flag: "hvLoweringReady" },
    ];

    const tryMount = () => {
      selectors.forEach((cfg) => mountMakesInto(cfg.sel, cfg.route, cfg.flag));
    };

    const anyPresent = selectors.some((cfg) => document.querySelector(cfg.sel));
    if (anyPresent) {
      tryMount();
      return;
    }

    const host = document.querySelector("#site-header") || document.body;
    const obs = new MutationObserver(() => {
      const found = selectors.some((cfg) => document.querySelector(cfg.sel));
      if (found) {
        obs.disconnect();
        tryMount();
      }
    });
    obs.observe(host, { childList: true, subtree: true });
  };


  const bindNav = (mountEl) => {
    if (mountEl.dataset.hv2Bound === "1") return;
    mountEl.dataset.hv2Bound = "1";

    const header = mountEl.querySelector(".hv2-header");
    if (!header) return;

    const toggle = mountEl.querySelector("[data-hv2-toggle]");
    const overlay = mountEl.querySelector("[data-hv2-overlay]");
    const drawer = mountEl.querySelector("[data-hv2-drawer]");
    const navLinks = mountEl.querySelectorAll(".hv2-nav a");

    const closeBtn = mountEl.querySelector("[data-hv2-close]");

    const isOpen = () => header.classList.contains("hv2-open");
    const toggleMobileMegaPanels = (open) => {
      if (!isMobileNav()) return;
      const items = mountEl.querySelectorAll(".nav-item-mega, .hv-nav-item-mega");
      items.forEach((item) => {
        const trig = item.querySelector(".nav-toggle-cta, .hv-nav-toggle");
        const panel = item.querySelector(".mega-panel, .hv-mega-panel");
        if (panel) {
          panel.hidden = !open;
          panel.classList.toggle("is-open", open);
        }
        item.classList.toggle("is-open", open);
        if (trig) trig.setAttribute("aria-expanded", open ? "true" : "false");
      });
    };

    const closeNav = () => {
      if (!isOpen()) return;
      setNavState(header, toggle, overlay, drawer, false);
      toggleMobileMegaPanels(false);
    };
    const openNav = () => {
      if (isOpen()) return;
      setNavState(header, toggle, overlay, drawer, true);
      toggleMobileMegaPanels(true);
      if (closeBtn) closeBtn.focus();
    };

    setNavState(header, toggle, overlay, drawer, false);

    if (toggle) {
      toggle.addEventListener("click", (evt) => {
        evt.preventDefault();
        if (isOpen()) closeNav();
        else openNav();
      });
    }

    if (overlay) {
      overlay.addEventListener("click", () => closeNav());
    }

    if (closeBtn) {
      closeBtn.addEventListener("click", (evt) => {
        evt.preventDefault();
        closeNav();
      });
    }

    navLinks.forEach((link) => {
      link.addEventListener("click", () => closeNav());
    });

    window.addEventListener("resize", () => {
      setNavState(header, toggle, overlay, drawer, isOpen());
    });

    document.addEventListener("keydown", (evt) => {
      if (evt.key === "Escape") closeNav();
    });

    document.addEventListener("click", (evt) => {
      if (!isOpen()) return;
      if (drawer && drawer.contains(evt.target)) return;
      if (toggle && toggle.contains(evt.target)) return;
      closeNav();
    });
  };

  const bindMegaMenus = (mountEl) => {
    if (!mountEl || mountEl.dataset.hv2MegaBound === "1") return;

    const items = Array.from(
      mountEl.querySelectorAll(".nav-item-mega, .hv-nav-item-mega")
    );
    if (!items.length) return;

    const mqDesktop = window.matchMedia("(min-width: 921px)");
    const pointerFine = window.matchMedia("(hover:hover)").matches;
    const triggerMap = new Map();
    const panelMap = new Map();

    items.forEach((item, idx) => {
      const trigger =
        item.querySelector(".nav-toggle-cta, .hv-nav-toggle") ||
        item.querySelector("a.nav-link");
      const panel = item.querySelector(".mega-panel, .hv-mega-panel");
      if (!trigger || !panel) return;

      if (!panel.id) {
        panel.id = `hv2-mega-${idx + 1}`;
      }
      trigger.setAttribute("aria-controls", panel.id);
      trigger.setAttribute("aria-expanded", "false");

      triggerMap.set(item, trigger);
      panelMap.set(item, panel);
    });

    const getTrigger = (item) => triggerMap.get(item);
    const getPanel = (item) => panelMap.get(item);

    const closeItem = (item) => {
      const trig = getTrigger(item);
      const panel = getPanel(item);
      item.classList.remove("is-open");
      if (trig) trig.setAttribute("aria-expanded", "false");
      if (panel) panel.hidden = true;
    };

    const closeAll = (except) => {
      items.forEach((item) => {
        if (item === except) return;
        if (triggerMap.has(item) && panelMap.has(item)) {
          closeItem(item);
        }
      });
    };

    const openItem = (item) => {
      const trig = getTrigger(item);
      const panel = getPanel(item);
      if (!trig || !panel) return;
      closeAll(item);
      item.classList.add("is-open");
      trig.setAttribute("aria-expanded", "true");
      panel.hidden = false;
    };

    items.forEach((item) => {
      const trig = getTrigger(item);
      const panel = getPanel(item);
      if (!trig || !panel) return;

      closeItem(item);

      let leaveTimer = null;
      const scheduleClose = () => {
        clearTimeout(leaveTimer);
        leaveTimer = setTimeout(() => {
          const hovering =
            item.matches(":hover") ||
            (panel && panel.matches(":hover")) ||
            (trig && trig.matches(":hover"));
          if (!hovering && mqDesktop.matches) {
            closeItem(item);
          }
        }, 400);
      };

      const cancelClose = () => {
        clearTimeout(leaveTimer);
      };

      const onDesktop = () => mqDesktop.matches;

      if (pointerFine) {
        item.addEventListener("mouseenter", () => {
          if (!onDesktop()) return;
          cancelClose();
          openItem(item);
        });
        item.addEventListener("mouseleave", () => {
          if (!onDesktop()) return;
          scheduleClose();
        });
        panel.addEventListener("mouseenter", cancelClose);
        panel.addEventListener("mouseleave", () => {
          if (onDesktop()) scheduleClose();
        });
      }

      trig.addEventListener("click", (evt) => {
        evt.preventDefault();
        if (onDesktop()) {
          if (item.classList.contains("is-open")) {
            closeItem(item);
          } else {
            openItem(item);
          }
          return;
        }

        // mobile accordion
        const isOpen = !panel.hidden;
        closeAll();
        if (!isOpen) {
          panel.hidden = false;
          panel.classList.add("is-open");
          trig.setAttribute("aria-expanded", "true");
          item.classList.add("is-open");
        }
      });

      item.addEventListener("focusin", () => {
        if (onDesktop()) openItem(item);
      });
      item.addEventListener("focusout", (evt) => {
        if (!item.contains(evt.relatedTarget) && onDesktop()) {
          closeItem(item);
        }
      });
    });

    document.addEventListener("click", (evt) => {
      const within = items.some((item) => item.contains(evt.target));
      if (!within && mqDesktop.matches) closeAll();
    });

    document.addEventListener("keydown", (evt) => {
      if (evt.key === "Escape" || evt.key === "Esc") {
        closeAll();
      }
    });

    mountEl.dataset.hv2MegaBound = "1";
  };

  const bindHeaderScroll = (mountEl) => {
    const header =
      (mountEl && mountEl.querySelector(".hv2-header")) ||
      document.querySelector(".hv2-header");
    if (!header) return;
    const syncHeaderHeight = () => {
      const h = header.offsetHeight || 0;
      document.documentElement.style.setProperty("--hv-header-h", `${h}px`);
    };

    let ticking = false;
    let lastState = null;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const scrolled = window.scrollY > 20;
        if (lastState !== scrolled) {
          header.classList.toggle("is-stuck", scrolled);
          syncHeaderHeight();
          lastState = scrolled;
        }
        ticking = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", syncHeaderHeight);
    syncHeaderHeight();
    onScroll();
  };

  const TITLE_MAP = {
    "algemene-voorwaarden": "Algemene voorwaarden",
    blog: "Blog",
    contact: "Contact",
    hulpveren: "Hulpveren",
    luchtvering: "Luchtvering",
    montage: "Montage",
    "onze-ervaring": "Onze ervaring",
    "over-ons": "Over ons",
    privacy: "Privacy",
    verlagingsveren: "Verlagingsveren",
  };

  const toTitleCase = (value) =>
    String(value || "")
      .replace(/[_]+/g, " ")
      .replace(/-+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : ""))
      .join(" ");

  const resolveSegmentLabel = (segment, { isLast, root }) => {
    const raw = String(segment || "");
    const key = raw.toLowerCase();
    if (TITLE_MAP[key]) return TITLE_MAP[key];
    if (/^(hv|nr|ls)-/i.test(raw)) return raw.toUpperCase();

    if (isLast && (root === "blog" || root === "onze-ervaring")) {
      const h1 = document.querySelector("h1");
      const h1Text = h1 ? h1.textContent.trim() : "";
      if (h1Text) return h1Text;
    }

    return toTitleCase(raw);
  };

  const injectBreadcrumbs = (mountEl, attempt = 0) => {
    if (document.querySelector(".site-breadcrumbs")) {
      document.documentElement.classList.add("has-site-breadcrumbs");
      return;
    }

    const path = window.location.pathname || "/";
    if (path === "/" || path === "/index.html") return;

    const segments = path.split("/").filter(Boolean);
    if (!segments.length) return;
    if (segments[segments.length - 1].toLowerCase() === "index.html") {
      segments.pop();
    }
    if (!segments.length) return;

    const navEl = document.createElement("nav");
    navEl.id = "site-breadcrumbs";
    navEl.className = "site-breadcrumbs";
    navEl.setAttribute("aria-label", "Breadcrumb");

    const wrap = document.createElement("div");
    wrap.className = "wrap";
    const list = document.createElement("ol");

    const addItem = (label, href, isLast) => {
      const li = document.createElement("li");
      if (isLast) {
        const span = document.createElement("span");
        span.textContent = label;
        span.setAttribute("aria-current", "page");
        li.appendChild(span);
      } else {
        const a = document.createElement("a");
        a.href = href;
        a.textContent = label;
        li.appendChild(a);
      }
      list.appendChild(li);
    };

    addItem("Home", "/", false);

    const root = segments[0].toLowerCase();
    segments.forEach((seg, idx) => {
      const isLast = idx === segments.length - 1;
      const label = resolveSegmentLabel(seg, { isLast, root });
      const href = `/${segments.slice(0, idx + 1).join("/")}/`;
      addItem(label, href, isLast);
    });

    wrap.appendChild(list);
    navEl.appendChild(wrap);

    const headerEl =
      document.getElementById("site-header") ||
      (mountEl && mountEl.querySelector(".hv2-header")) ||
      document.querySelector(".hv2-header") ||
      document.querySelector("header") ||
      mountEl;

    const anchor = headerEl || document.querySelector("main") || document.body;
    if (!anchor) {
      if (attempt < 6) {
        setTimeout(() => injectBreadcrumbs(mountEl, attempt + 1), 250);
      }
      return;
    }

    const position = headerEl ? "afterend" : "afterbegin";
    anchor.insertAdjacentElement(position, navEl);
    document.documentElement.classList.add("has-site-breadcrumbs");
    document.querySelectorAll(".breadcrumbs, .crumbs").forEach((el) => el.remove());
  };

  const mount = async () => {
    const target = getMountTarget();
    let mountEl = target.mountEl || target.legacy || null;
    let html = null;

    try {
      const res = await fetch(PARTIAL_URL, { cache: "no-cache" });
      if (res.ok) {
        html = await res.text();
      }
    } catch {
      html = null;
    }

    if (html) {
      mountEl = target.mountEl || createMountEl(target.legacy);
      mountEl.innerHTML = html;
      mountEl.dataset.hv2Mounted = "1";

      ensureDrawerClosedOnMount(mountEl);
      bindNav(mountEl);
      bindMegaMenus(mountEl);
      mountMakesWhenReady();
      bindHeaderScroll(mountEl);
      initPlateGroupOverlay();
    }

    injectBreadcrumbs(mountEl);
  };

  const init = () => {
    ensureBuildId();
    mount();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
