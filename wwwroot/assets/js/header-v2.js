(() => {
  "use strict";
  const PARTIAL_URL = "/partials/header-v2.html";

  async function mount() {
    const mountEl = document.getElementById("site-header") || (() => {
      const d = document.createElement("div");
      d.id = "site-header";
      document.body.insertBefore(d, document.body.firstChild);
      return d;
    })();

    if (mountEl.dataset.hv2Mounted === "1") return;
    const res = await fetch(PARTIAL_URL, { cache: "no-cache" });
    if (!res.ok) return;
    mountEl.innerHTML = await res.text();
    mountEl.dataset.hv2Mounted = "1";

    const header = mountEl.querySelector(".hv2-header");
    const toggle = mountEl.querySelector("[data-hv2-toggle]");
    if (header && toggle) {
      toggle.addEventListener("click", (e) => {
        e.preventDefault();
        const open = header.classList.toggle("hv2-open");
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
