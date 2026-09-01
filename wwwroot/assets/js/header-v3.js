(() => {
  "use strict";

  const header = document.querySelector('header[data-hv-header="v3"]');
  if (!header) return;

  const html = document.documentElement;
  const mqMobile = window.matchMedia("(max-width: 1023px)");

  const menuToggle = header.querySelector("[data-hv3-toggle]");
  const overlay = header.querySelector("[data-hv3-overlay]");
  const drawer = header.querySelector("[data-hv3-drawer]");

  const setMenuOpen = (open) => {
    const allow = mqMobile.matches;
    const next = allow && open;
    html.classList.toggle("menu-open", next);
    if (menuToggle) menuToggle.setAttribute("aria-expanded", next ? "true" : "false");
    if (drawer) drawer.setAttribute("aria-hidden", next ? "false" : "true");
    if (overlay) overlay.setAttribute("aria-hidden", next ? "false" : "true");
  };

  const closeMenu = () => setMenuOpen(false);

  const closeMegaItems = (scope) => {
    const root = scope || header;
    root.querySelectorAll(".hv3-nav-item--mega.is-open").forEach((item) => {
      item.classList.remove("is-open");
      const btn = item.querySelector("[data-hv3-mega-toggle]");
      if (btn) btn.setAttribute("aria-expanded", "false");
    });
  };

  const toggleMega = (btn) => {
    const item = btn.closest(".hv3-nav-item--mega");
    if (!item) return;
    const nav = item.closest(".hv3-nav") || header;
    const isOpen = item.classList.contains("is-open");

    if (isOpen) {
      item.classList.remove("is-open");
      btn.setAttribute("aria-expanded", "false");
      return;
    }

    closeMegaItems(nav);
    item.classList.add("is-open");
    btn.setAttribute("aria-expanded", "true");
  };

  header.addEventListener("click", (event) => {
    const target = event.target;

    const toggleBtn = target.closest("[data-hv3-toggle]");
    if (toggleBtn) {
      event.preventDefault();
      if (!mqMobile.matches) return;
      setMenuOpen(!html.classList.contains("menu-open"));
      return;
    }

    const closeBtn = target.closest("[data-hv3-close]");
    if (closeBtn) {
      event.preventDefault();
      closeMenu();
      return;
    }

    const overlayBtn = target.closest("[data-hv3-overlay]");
    if (overlayBtn) {
      event.preventDefault();
      closeMenu();
      return;
    }

    const megaBtn = target.closest("[data-hv3-mega-toggle]");
    if (megaBtn) {
      event.preventDefault();
      toggleMega(megaBtn);
    }
  });

  header.addEventListener("focusin", (event) => {
    const item = event.target.closest(".hv3-nav--desktop .hv3-nav-item--mega");
    if (!item) return;
    const btn = item.querySelector("[data-hv3-mega-toggle]");
    if (btn) btn.setAttribute("aria-expanded", "true");
    item.classList.add("is-open");
  });

  header.addEventListener("focusout", (event) => {
    const item = event.target.closest(".hv3-nav--desktop .hv3-nav-item--mega");
    if (!item) return;
    if (item.contains(event.relatedTarget)) return;
    const btn = item.querySelector("[data-hv3-mega-toggle]");
    if (btn) btn.setAttribute("aria-expanded", "false");
    item.classList.remove("is-open");
  });

  document.addEventListener("click", (event) => {
    if (header.contains(event.target)) return;
    closeMegaItems(header);
    closeMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    closeMenu();
    closeMegaItems(header);
  });

  const onBreakpointChange = () => {
    if (!mqMobile.matches) {
      closeMenu();
      closeMegaItems(header);
    }
  };

  if (mqMobile.addEventListener) {
    mqMobile.addEventListener("change", onBreakpointChange);
  } else if (mqMobile.addListener) {
    mqMobile.addListener(onBreakpointChange);
  }

  const slugify = (value) =>
    String(value || "")
      .toLowerCase()
      .trim()
      .replace(/&/g, "en")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

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
      listEl.innerHTML =
        '<li class="hv3-mega-item"><span class="hv3-mega-link">Geen merken gevonden</span></li>';
      return;
    }

    const frag = document.createDocumentFragment();
    makes.forEach((m) => {
      const li = document.createElement("li");
      li.className = "hv3-mega-item";
      const a = document.createElement("a");
      a.className = "hv3-mega-link";
      a.href = `${routePrefix}${m.slug}/`;
      a.textContent = m.name;
      li.appendChild(a);
      frag.appendChild(li);
    });

    listEl.innerHTML = "";
    listEl.appendChild(frag);
    listEl.classList.add("is-ready");
  };

  const loadMakes = (() => {
    const MAKES_URL = "/data/makes.json";
    let pending = null;

    return async () => {
      if (pending) return pending;
      pending = (async () => {
        const url = `${MAKES_URL}?ts=${Date.now()}`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          pending = null;
          return null;
        }
        const data = await res.json();
        return { url, data };
      })();
      return pending;
    };
  })();

  const mountMakes = async () => {
    const targets = [
      { sel: "[data-hv-brands-list]", route: "/hulpveren/" },
      { sel: "[data-hv-air-list]", route: "/luchtvering/" },
      { sel: "[data-hv-lowering-list]", route: "/verlagingsveren/" },
    ];

    const lists = targets.flatMap((cfg) =>
      Array.from(document.querySelectorAll(cfg.sel)).map((el) => ({ el, route: cfg.route }))
    );

    if (!lists.length) return;

    const result = await loadMakes();
    if (!result) return;

    const makes = normalizeMakes(result.data).sort((a, b) =>
      a.name.localeCompare(b.name, "nl", { sensitivity: "base" })
    );

    lists.forEach((entry) => renderMakes(entry.el, makes, entry.route));
  };

  mountMakes();

  const initRecentVehiclesHeader = () => {
    if (window.HVRecentVehiclesHeader && typeof window.HVRecentVehiclesHeader.init === "function") {
      window.HVRecentVehiclesHeader.init();
      return;
    }
    const src = "/assets/js/recentVehiclesHeader.js?v=20260901-1";
    if (document.querySelector('script[data-src="' + src + '"], script[src*="/assets/js/recentVehiclesHeader.js"]')) return;
    const script = document.createElement("script");
    script.src = src;
    script.defer = true;
    script.setAttribute("data-src", src);
    document.head.appendChild(script);
  };

  initRecentVehiclesHeader();
})();
