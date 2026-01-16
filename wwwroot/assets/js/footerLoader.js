(() => {
  "use strict";
  const normalizePath = (value) => {
    const path = String(value || location.pathname || "/");
    const trimmed = path.replace(/\/+$/, "/");
    return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
  };

  const isLegacyRoute = () => {
    const p = normalizePath(location.pathname);
    return (
      p.startsWith("/hulpveren/") ||
      p.startsWith("/luchtvering/") ||
      p.startsWith("/verlagingsveren/")
    );
  };

  if (window.__SPA_DISABLED__ || isLegacyRoute()) {
    window.__SPA_DISABLED__ = true;
    return;
  }

  const target = document.getElementById("site-footer");
  if (!target) return;

  const loadFooter = async () => {
    try {
      const res = await fetch("/partials/footer-hulpveren.html", { cache: "no-store" });
      if (res.ok) {
        const html = await res.text();
        target.innerHTML = html;
      }
    } catch (err) {
      if (window && window.console && typeof window.console.warn === "function") {
        window.console.warn("Footer load failed:", err);
      }
    }
  };

  loadFooter();
})();
