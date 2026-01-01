(() => {
  "use strict";

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
