// /assets/js/header.js
(() => {
  "use strict";

  const header = document.querySelector(".site-header");
  if (!header) return;
  if (header.dataset.hvMenuBound === "1") return;
  header.dataset.hvMenuBound = "1";

  const menuToggle = header.querySelector("[data-nav-toggle]");
  const nav = header.querySelector(".nav");

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

  const MEGA_CACHE = Object.create(null);
  const MEGA_PROMISE = Object.create(null);

  const MEGA_CFG = {
    hv: { base: "/hulpveren", url: "/data/hv-kits.json" },
    nr: { base: "/luchtvering", url: "/data/nr-kits.json" },
    ls: { base: "/verlagingsveren", url: "/data/ls-kits.json" },
  };

  function emptyResult(base) {
    return { brands: [], base };
  }

  async function loadKits(url, base) {
    try {
      const res = await fetch(url, { cache: "force-cache" });
      if (!res.ok) return emptyResult(base);

      const data = await res.json();
      const kits = Array.isArray(data) ? data : (data?.kits || []);

      const brandMap = new Map();
      for (const k of kits) {
        const fitments = Array.isArray(k?.fitments) ? k.fitments : [];
        for (const f of fitments) {
          const makeLabel = String(f?.make || "").trim();
          const modelLabel = String(f?.model || "").trim();
          const make = slugify(makeLabel);
          if (!make || !modelLabel) continue;

          const curMakeLabel = brandMap.get(make);
          if (!curMakeLabel || makeLabel.length > curMakeLabel.length) {
            brandMap.set(make, makeLabel);
          }

        }
      }

      const brands = Array.from(brandMap.entries())
        .map(([slug, label]) => ({ slug, label }))
        .sort((a, b) => a.label.localeCompare(b.label, "nl"));
      return { brands, base };
    } catch {
      return emptyResult(base);
    }
  }

  function ensureMegaData(family) {
    if (MEGA_CACHE[family]) return Promise.resolve(MEGA_CACHE[family]);
    if (MEGA_PROMISE[family]) return MEGA_PROMISE[family];

    const cfg = MEGA_CFG[family];
    if (!cfg) return Promise.resolve(emptyResult("/"));

    MEGA_PROMISE[family] = loadKits(cfg.url, cfg.base).then((data) => {
      MEGA_CACHE[family] = data;
      return data;
    });

    return MEGA_PROMISE[family];
  }

  function renderMegaMenu(family) {
    const cache = MEGA_CACHE[family];
    if (!cache) return;

    const base = cache.base || MEGA_CFG[family]?.base || "/";
    const brandsEl = header.querySelector(`#hv-mega-brands-${family}`);
    if (!brandsEl) return;

    const brands = cache.brands || [];

    brandsEl.innerHTML = brands
      .map((b) => `<li><a href="${base}/${b.slug}">${b.label}</a></li>`)
      .join("");
  }

  // mobile toggle
  if (menuToggle && nav) {
    menuToggle.addEventListener("click", () => {
      const open = header.classList.toggle("nav-open");
      menuToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  function closeItem(item) {
    item.classList.remove("is-open");
    const b = item.querySelector(".nav-toggle-cta");
    if (b) b.setAttribute("aria-expanded", "false");
    const panel = item.querySelector(".mega-panel");
    if (panel) {
      panel.setAttribute("aria-hidden", "true");
      panel.setAttribute("hidden", "");
    }
  }

  function openItem(item) {
    header.querySelectorAll(".nav-item-mega").forEach((other) => {
      if (other !== item) closeItem(other);
    });

    item.classList.add("is-open");
    const b = item.querySelector(".nav-toggle-cta");
    if (b) b.setAttribute("aria-expanded", "true");
    const panel = item.querySelector(".mega-panel");
    if (panel) {
      panel.removeAttribute("hidden");
      panel.setAttribute("aria-hidden", "false");
    }

    const fam = item.getAttribute("data-family");
    if (!fam) return;
    ensureMegaData(fam).then(() => renderMegaMenu(fam));
  }

  const focusFirstLink = (item) => {
    const link = item.querySelector(".mega-panel a");
    if (link) link.focus();
  };

  header.querySelectorAll(".nav-item-mega .nav-toggle-cta").forEach((btn) => {
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-haspopup", "true");
    const item = btn.closest(".nav-item-mega");
    if (item) {
      const fam = item.getAttribute("data-family") || "menu";
      const panel = item.querySelector(".mega-panel");
      if (panel) {
        const panelId = panel.id || `mega-menu-${fam}`;
        panel.id = panelId;
        panel.setAttribute("role", "region");
        const labelMap = {
          hv: "Merken hulpveren",
          nr: "Merken luchtvering",
          ls: "Merken verlagingsveren",
        };
        panel.setAttribute("aria-label", labelMap[fam] || "Merken menu");
        panel.setAttribute("aria-hidden", "true");
        panel.setAttribute("hidden", "");
        btn.setAttribute("aria-controls", panelId);
      }
    }

    btn.addEventListener("click", (e) => {
      const item = e.currentTarget.closest(".nav-item-mega");
      if (!item) return;
      if (item.classList.contains("is-open")) closeItem(item);
      else openItem(item);
    });
    btn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const item = e.currentTarget.closest(".nav-item-mega");
        if (!item) return;
        if (item.classList.contains("is-open")) closeItem(item);
        else {
          openItem(item);
          focusFirstLink(item);
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const item = e.currentTarget.closest(".nav-item-mega");
        if (!item) return;
        openItem(item);
        focusFirstLink(item);
      } else if (e.key === "Escape") {
        e.preventDefault();
        const item = e.currentTarget.closest(".nav-item-mega");
        if (item) closeItem(item);
      }
    });
  });

  const closeAllNav = () => {
    header.classList.remove("nav-open");
    header.querySelectorAll(".nav-item-mega").forEach(closeItem);
  };

  header.querySelectorAll(".nav a, .mega-panel a").forEach((link) => {
    link.addEventListener("click", () => closeAllNav());
  });

  document.addEventListener("click", (evt) => {
    if (!header.contains(evt.target)) {
      closeAllNav();
    }
  });

  document.addEventListener("keydown", (evt) => {
    if (evt.key !== "Escape") return;
    closeAllNav();
  });

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

  const injectBreadcrumbs = () => {
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
    header.insertAdjacentElement("afterend", navEl);
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  let shrinkRange = 140;

  const updateShrinkRange = () => {
    shrinkRange = window.matchMedia("(max-width: 960px)").matches ? 90 : 140;
  };

  const applyScrollState = () => {
    const y = window.scrollY || 0;
    const shrink = clamp(y / shrinkRange, 0, 1);
    header.style.setProperty("--header-shrink", shrink.toFixed(3));
    header.classList.toggle("is-scrolled", shrink > 0.02);
  };

  let scrollTicking = false;
  const onScroll = () => {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(() => {
      applyScrollState();
      scrollTicking = false;
    });
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", () => {
    updateShrinkRange();
    onScroll();
  });
  updateShrinkRange();
  injectBreadcrumbs();
  applyScrollState();
})();


