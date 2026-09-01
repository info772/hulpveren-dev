(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.HVRecentVehiclesHeader = api;
  }
})(typeof window !== "undefined" ? window : globalThis, function (root) {
  "use strict";

  const RECENT_VEHICLES_SRC = "/assets/js/recentVehicles.js?v=20260831-1";
  let recentVehiclesLoadPromise = null;
  let observer = null;

  function loadScriptOnce(src, key) {
    if (!root || !root.document) return Promise.resolve(null);
    if (key && root[key]) return Promise.resolve(root[key]);
    const document = root.document;
    const existing = document.querySelector(
      `script[data-src="${src}"], script[src*="${src.split("?")[0]}"]`
    );
    if (existing) {
      if (key && root[key]) return Promise.resolve(root[key]);
      return new Promise((resolve) => {
        const done = () => resolve(key ? root[key] || null : null);
        existing.addEventListener?.("load", done, { once: true });
        existing.addEventListener?.("error", () => resolve(null), { once: true });
      });
    }
    const script = document.createElement("script");
    script.src = src;
    script.defer = true;
    script.setAttribute("data-src", src);
    return new Promise((resolve) => {
      script.onload = () => resolve(key ? root[key] || null : null);
      script.onerror = () => resolve(null);
      (document.head || document.documentElement).appendChild(script);
    });
  }

  function ensureRecentVehicles() {
    if (root.HVRecentVehicles) return Promise.resolve(root.HVRecentVehicles);
    if (!recentVehiclesLoadPromise) {
      recentVehiclesLoadPromise = loadScriptOnce(RECENT_VEHICLES_SRC, "HVRecentVehicles")
        .then(() => {
          const recent = root.HVRecentVehicles || null;
          if (!recent) recentVehiclesLoadPromise = null;
          return recent;
        })
        .catch(() => {
          recentVehiclesLoadPromise = null;
          return null;
        });
    }
    return recentVehiclesLoadPromise;
  }

  function normalizePlate(value) {
    if (root.HVRecentVehicles && typeof root.HVRecentVehicles.normalizePlate === "function") {
      return root.HVRecentVehicles.normalizePlate(value);
    }
    return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  }

  function formatPlate(value) {
    const plate = normalizePlate(value);
    let out = "";
    for (let i = 0; i < plate.length; i += 1) {
      const current = plate.charAt(i);
      const previous = i > 0 ? plate.charAt(i - 1) : "";
      const currentIsDigit = /[0-9]/.test(current);
      const previousIsDigit = /[0-9]/.test(previous);
      if (i > 0 && currentIsDigit !== previousIsDigit) out += "-";
      out += current;
    }
    return out;
  }

  function recentVehiclesStorage() {
    try {
      return root.localStorage || null;
    } catch (err) {
      return null;
    }
  }

  function recentVehicleHref(item) {
    const route = item && item.route ? item.route : "/kenteken/";
    try {
      const url = new URL(route, root.location?.origin || "https://www.hulpveren.shop");
      if (item && item.plate) url.searchParams.set("kt", item.plate);
      return url.pathname + url.search;
    } catch (err) {
      return route;
    }
  }

  function recentVehicleLabel(item) {
    const vehicle = [item && item.make, item && item.model].filter(Boolean).join(" ");
    return [
      item && item.plate ? formatPlate(item.plate) : "",
      vehicle,
      item && item.year ? item.year : "",
    ].filter(Boolean).join(" · ");
  }

  function ensureRecentVehiclesHeaderStyles() {
    const document = root.document;
    if (!document || document.getElementById("hv-recent-vehicles-style")) return;
    const style = document.createElement("style");
    style.id = "hv-recent-vehicles-style";
    style.textContent = `
      .hv-recent-vehicles{position:relative}
      .hv-recent-vehicles__button{background:transparent;border:1px solid rgba(255,255,255,.28);border-radius:8px;color:#eef6ff;cursor:pointer;font:inherit;font-weight:700;padding:.58rem .8rem;white-space:nowrap}
      .hv-recent-vehicles__button:hover,.hv-recent-vehicles__button:focus{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.52);color:#fff;outline:none}
      .hv-recent-vehicles__button:focus-visible{box-shadow:0 0 0 3px rgba(56,189,248,.38)}
      .hv-recent-vehicles__panel{background:#111827;border:1px solid rgba(148,163,184,.32);border-radius:8px;box-shadow:0 18px 45px rgba(2,6,23,.36);color:#f8fafc;display:none;min-width:min(320px,calc(100vw - 24px));padding:10px;position:absolute;right:0;top:calc(100% + 8px);z-index:50}
      .hv-recent-vehicles.is-open .hv-recent-vehicles__panel{display:block}
      .hv-recent-vehicles__title{color:#f8fafc;font-weight:800;margin:0 0 8px}
      .hv-recent-vehicles__list{display:grid;gap:4px}
      .hv-recent-vehicles__item{border-radius:8px;color:#f8fafc;display:block;font-weight:700;padding:9px 10px;text-decoration:none}
      .hv-recent-vehicles__item:hover,.hv-recent-vehicles__item:focus{background:rgba(56,189,248,.16);color:#fff;outline:1px solid rgba(125,211,252,.45)}
      .hv-recent-vehicles__clear{background:transparent;border:0;color:#bae6fd;cursor:pointer;font:inherit;margin-top:8px;padding:8px 0;text-decoration:underline}
      .hv-recent-vehicles__clear:hover,.hv-recent-vehicles__clear:focus{color:#fff;outline:1px solid rgba(125,211,252,.45);outline-offset:3px}
      @media (max-width:720px){.hv-recent-vehicles{position:static}.hv-recent-vehicles__panel{left:12px;right:12px;top:auto}}
    `;
    document.head.appendChild(style);
  }

  function init() {
    const document = root.document;
    if (!document) return;
    const actions = document.querySelector(".site-header__actions");
    if (!actions) {
      if (observer || typeof root.MutationObserver !== "function") return;
      const observeRoot = document.documentElement || document.body;
      if (!observeRoot) return;
      observer = new root.MutationObserver(() => {
        if (!document.querySelector(".site-header__actions")) return;
        observer.disconnect();
        observer = null;
        init();
      });
      observer.observe(observeRoot, { childList: true, subtree: true });
      return;
    }
    if (actions.querySelector(".hv-recent-vehicles")) return;
    if (actions.dataset.recentVehiclesBound === "1") return;
    actions.dataset.recentVehiclesBound = "1";

    const wrapper = document.createElement("div");
    wrapper.className = "hv-recent-vehicles";
    wrapper.hidden = true;
    wrapper.style.display = "none";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "hv-recent-vehicles__button";
    button.setAttribute("aria-expanded", "false");
    button.textContent = "Mijn voertuigen";

    const panel = document.createElement("div");
    panel.className = "hv-recent-vehicles__panel";
    panel.setAttribute("role", "menu");
    panel.innerHTML = [
      '<p class="hv-recent-vehicles__title">Mijn voertuigen</p>',
      '<div class="hv-recent-vehicles__list"></div>',
      '<button class="hv-recent-vehicles__clear" type="button">Wis recente voertuigen</button>',
    ].join("");

    wrapper.appendChild(button);
    wrapper.appendChild(panel);
    actions.insertBefore(wrapper, actions.firstChild);

    const list = panel.querySelector(".hv-recent-vehicles__list");
    const clear = panel.querySelector(".hv-recent-vehicles__clear");
    const close = () => {
      wrapper.classList.remove("is-open");
      button.setAttribute("aria-expanded", "false");
    };
    const render = () => {
      ensureRecentVehicles().then((recent) => {
        const storage = recentVehiclesStorage();
        if (!recent || !storage || !list) return;
        let items = [];
        try {
          items = recent.read(storage);
        } catch (err) {
          items = [];
        }
        wrapper.hidden = items.length === 0;
        wrapper.style.display = items.length ? "" : "none";
        close();
        list.innerHTML = "";
        items.forEach((item) => {
          const link = document.createElement("a");
          link.className = "hv-recent-vehicles__item";
          link.href = recentVehicleHref(item);
          link.textContent = recentVehicleLabel(item);
          list.appendChild(link);
        });
      }).catch(() => {});
    };

    button.addEventListener("click", (event) => {
      event.preventDefault();
      if (wrapper.hidden) return;
      const open = !wrapper.classList.contains("is-open");
      wrapper.classList.toggle("is-open", open);
      button.setAttribute("aria-expanded", open ? "true" : "false");
    });
    clear.addEventListener("click", () => {
      ensureRecentVehicles().then((recent) => {
        const storage = recentVehiclesStorage();
        if (recent && storage) recent.clear(storage);
        render();
      }).catch(() => {});
    });
    document.addEventListener("click", (event) => {
      if (!wrapper.contains(event.target)) close();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close();
    });
    root.addEventListener("storage", (event) => {
      if (!event || event.key === "hv_recent_vehicles") render();
    });
    root.addEventListener("hv:recentVehiclesChanged", render);

    ensureRecentVehiclesHeaderStyles();
    render();
  }

  const api = { init };

  if (root.document) {
    if (root.document.readyState === "loading") {
      root.document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
      init();
    }
  }

  return api;
});
