(() => {
  const grids = Array.from(document.querySelectorAll("[data-related-grid]"));
  if (!grids.length) return;

  const escapeHtml = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));

  const normalizeTags = (tags) => {
    if (!tags) return [];
    const list = Array.isArray(tags) ? tags : String(tags).split(/[;,|]/);
    return list.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean);
  };

  const extractTags = (item) => {
    if (!item) return [];
    const raw = item.tags ?? item.category ?? "";
    return normalizeTags(raw);
  };

  const normalizePath = (value) => {
    if (!value) return "";
    let path = String(value);
    try {
      if (path.startsWith("http://") || path.startsWith("https://")) {
        path = new URL(path, window.location.origin).pathname;
      }
    } catch (err) {
      // Ignore parse errors, treat as relative.
    }
    if (!path.startsWith("/")) path = `/${path}`;
    path = path.replace(/\/+$/, "/");
    return path;
  };

  const formatDateNL = (iso) => {
    if (!iso) return "";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("nl-NL", { year: "numeric", month: "long", day: "numeric" });
  };

  const resolveBlogHref = (slug) =>
    `/blog/post.html?slug=${encodeURIComponent(slug || "")}`;
  const resolveHref = (item) => {
    if (item.url || item.href) return item.url || item.href;
    if (item.slug) return resolveBlogHref(item.slug);
    return "";
  };
  const resolveImg = (item) =>
    item.image || item.img || item.cover || item.heroImage || item.heroImagePath || "/img/blog/_fallback.jpg";
  const resolveAlt = (item) => item.imageAlt || item.alt || item.title || "Blog afbeelding";

  const currentPath = normalizePath(window.location.pathname || "/");
  const currentTagMeta = document.querySelector('meta[name="blog:tags"]');
  const currentTags = normalizeTags(currentTagMeta ? currentTagMeta.getAttribute("content") : "");
  const currentSlug = (() => {
    const params = new URLSearchParams(window.location.search || "");
    const fromQuery = params.get("slug");
    if (fromQuery) return fromQuery;
    const parts = (window.location.pathname || "").split("/").filter(Boolean);
    const blogIndex = parts.indexOf("blog");
    if (blogIndex !== -1 && parts.length > blogIndex + 1) {
      const candidate = parts[blogIndex + 1];
      if (candidate && candidate !== "post.html") return candidate;
    }
    return "";
  })();

  const card = (item) => {
    const href = escapeHtml(resolveHref(item));
    const title = escapeHtml(item.title || "Blog");
    const desc = escapeHtml(item.description || item.excerpt || "");
    const img = escapeHtml(resolveImg(item));
    const imgAlt = escapeHtml(resolveAlt(item));
    const date = formatDateNL(item.date || item.published || item.publishedAt);
    const tags = extractTags(item);
    const metaParts = [];
    if (date) metaParts.push(date);
    if (tags.length) metaParts.push(tags.join(" | "));
    const meta = metaParts.length ? `<div class="related-meta">${escapeHtml(metaParts.join(" | "))}</div>` : "";

    return `
      <a class="related-card" href="${href}">
        <img src="${img}" alt="${imgAlt}" loading="lazy" decoding="async" />
        <div class="related-body">
          <h3>${title}</h3>
          <p>${desc}</p>
          ${meta}
        </div>
      </a>
    `;
  };

  const findEmpty = (grid) => {
    if (!grid) return null;
    const parent = grid.closest("[data-related-section]") || grid.parentElement;
    if (!parent) return null;
    return parent.querySelector("[data-related-empty]");
  };

  const fetchFromApi = async () => {
    if (window.HVApiClient && typeof window.HVApiClient.getBlogs === "function") {
      const data = await window.HVApiClient.getBlogs();
      return Array.isArray(data?.items) ? data.items : [];
    }
    const res = await fetch("/api/blogs", { cache: "no-store" });
    if (!res.ok) throw new Error("api blogs missing");
    const data = await res.json();
    return Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
  };

  const fetchFromJson = async () => {
    const res = await fetch("/blog/blog-index.json", { cache: "no-store" });
    if (!res.ok) throw new Error("blog-index.json missing");
    const data = await res.json();
    return Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : [];
  };

  const loadItems = async () => {
    try {
      return await fetchFromApi();
    } catch (err) {
      return await fetchFromJson();
    }
  };

  loadItems()
    .then((items) => {
      const ranked = items
        .filter((item) => {
          if (item.slug && currentSlug) return item.slug !== currentSlug;
          return normalizePath(resolveHref(item)) !== currentPath;
        })
        .map((item) => {
          const itemTags = extractTags(item);
          const score = currentTags.length
            ? currentTags.reduce((total, tag) => total + (itemTags.includes(tag) ? 1 : 0), 0)
            : 0;
          const dateValue = new Date(item.date || item.published || item.publishedAt || 0).getTime() || 0;
          return { item, score, dateValue };
        })
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return b.dateValue - a.dateValue;
        });

      const ordered = ranked.map((entry) => entry.item);

      grids.forEach((grid) => {
        const limit = Number.parseInt(grid.getAttribute("data-related-limit") || "3", 10);
        const selection = ordered.slice(0, Number.isNaN(limit) ? 3 : Math.max(limit, 0));
        grid.innerHTML = selection.map(card).join("");
        const empty = findEmpty(grid);
        if (empty) empty.hidden = selection.length !== 0;
      });
    })
    .catch(() => {
      grids.forEach((grid) => {
        const empty = findEmpty(grid);
        if (empty) empty.hidden = false;
      });
    });
})();
