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
    if (toggle) toggle.setAttribute("aria-expanded", open ? "true" : "false");
    if (overlay) overlay.setAttribute("aria-hidden", mobile && open ? "false" : "true");
    if (drawer) drawer.setAttribute("aria-hidden", mobile ? (open ? "false" : "true") : "false");
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

    const isOpen = () => header.classList.contains("hv2-open");
    const closeNav = () => {
      if (!isOpen()) return;
      setNavState(header, toggle, overlay, drawer, false);
    };
    const openNav = () => {
      if (isOpen()) return;
      setNavState(header, toggle, overlay, drawer, true);
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

      if (pointerFine) {
        item.addEventListener("mouseenter", () => openItem(item));
        item.addEventListener("mouseleave", () => closeItem(item));
      }

      trig.addEventListener("click", (evt) => {
        evt.preventDefault();
        if (item.classList.contains("is-open")) {
          closeItem(item);
        } else {
          openItem(item);
        }
      });

      item.addEventListener("focusin", () => openItem(item));
      item.addEventListener("focusout", (evt) => {
        if (!item.contains(evt.relatedTarget)) {
          closeItem(item);
        }
      });
    });

    document.addEventListener("click", (evt) => {
      const within = items.some((item) => item.contains(evt.target));
      if (!within) closeAll();
    });

    document.addEventListener("keydown", (evt) => {
      if (evt.key === "Escape" || evt.key === "Esc") {
        closeAll();
      }
    });

    mountEl.dataset.hv2MegaBound = "1";
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

  const injectBreadcrumbs = (mountEl) => {
    if (document.getElementById("site-breadcrumbs")) return;

    const path = window.location.pathname || "/";
    if (path === "/" || path === "/index.html") return;

    document.querySelectorAll(".breadcrumbs, .crumbs").forEach((el) => el.remove());

    const segments = path.split("/").filter(Boolean);
    if (!segments.length) return;
    if (segments[segments.length - 1].toLowerCase() === "index.html") {
      segments.pop();
    }
    if (!segments.length) return;

    const navEl = document.createElement("nav");
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
      (mountEl && mountEl.querySelector(".hv2-header")) ||
      document.querySelector(".hv2-header") ||
      document.querySelector("header");

    if (headerEl) {
      headerEl.insertAdjacentElement("afterend", navEl);
    }
  };

  const mount = async () => {
    const target = getMountTarget();
    const res = await fetch(PARTIAL_URL, { cache: "no-cache" });
    if (!res.ok) return;

    const html = await res.text();
    const mountEl = target.mountEl || createMountEl(target.legacy);
    mountEl.innerHTML = html;
    mountEl.dataset.hv2Mounted = "1";

    bindNav(mountEl);
    bindMegaMenus(mountEl);
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
