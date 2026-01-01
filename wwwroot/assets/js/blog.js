// /assets/js/blog.js
(() => {
  "use strict";

  const formatDateNL = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("nl-NL", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const escapeHtml = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[c]);

  const slugify = (value) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const normalizeTags = (item) => {
    if (Array.isArray(item.tags)) return item.tags.filter(Boolean);
    if (item.category) return [item.category];
    return [];
  };

  const resolveSlug = () => {
    const params = new URLSearchParams(location.search || "");
    let slug = params.get("slug");
    if (slug) return slug;
    const parts = location.pathname.split("/").filter(Boolean);
    const blogIndex = parts.indexOf("blog");
    if (blogIndex !== -1 && parts.length > blogIndex + 1) {
      const candidate = parts[blogIndex + 1];
      if (candidate && candidate !== "post.html") {
        return candidate;
      }
    }
    return null;
  };

  const resolveBlogHref = (item) => {
    const slug = slugify(item.slug || item.title || "");
    return slug ? `/blog/${slug}/` : "/blog/";
  };

  const sanitizeHtml = (html) => {
    if (!html) return "";
    const parser = new DOMParser();
    const doc = parser.parseFromString(String(html), "text/html");
    doc.querySelectorAll("script, iframe").forEach((el) => el.remove());
    doc.querySelectorAll("*").forEach((el) => {
      Array.from(el.attributes).forEach((attr) => {
        if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
      });
    });
    return doc.body.innerHTML;
  };

  const renderBlogCard = (item) => {
    const href = resolveBlogHref(item);
    const title = escapeHtml(item.title || "Blog");
    const desc = escapeHtml(item.excerpt || item.description || "");
    const date = escapeHtml(formatDateNL(item.date));
    const tags = normalizeTags(item);
    const img = escapeHtml(
      item.hero || item.heroImage || item.heroImagePath || item.image || "/img/blog/_fallback.jpg"
    );

    return `
      <a class="blogcard" href="${href}">
        <img src="${img}" alt="${title}" loading="lazy" decoding="async" />
        <div class="blogcard-body">
          <h3 class="blogcard-title">${title}</h3>
          <p class="blogcard-meta">${date}${
            tags.length ? " | " + escapeHtml(tags.join(" | ")) : ""
          }</p>
          <p class="blogcard-desc">${desc}</p>
        </div>
      </a>
    `;
  };

  const initBlogIndex = async () => {
    const grid = document.getElementById("blogGrid");
    if (!grid) return;
    const empty = document.getElementById("blogEmpty");
    const search = document.getElementById("blogSearch");
    const tagButtons = Array.from(document.querySelectorAll("[data-tag]"));

    if (!window.HVApiClient) return;
    grid.innerHTML = `<div class="bloghome-empty">Blogs laden...</div>`;
    let data;
    try {
      data = await window.HVApiClient.getBlogs();
    } catch {
      grid.innerHTML = "";
      if (empty) {
        empty.hidden = false;
        empty.textContent = "Blogoverzicht tijdelijk niet beschikbaar.";
      }
      return;
    }
    const items = Array.isArray(data?.items) ? data.items : [];
    let all = items.slice();

    const activeTags = new Set();

    const apply = () => {
      const q = (search?.value || "").trim().toLowerCase();
      const hasTags = activeTags.size > 0;
      const filtered = all.filter((it) => {
        const tags = normalizeTags(it).map((t) => String(t).toLowerCase());
        const hay = `${it.title || ""} ${it.excerpt || ""} ${tags.join(" ")}`.toLowerCase();
        const okQuery = !q || hay.includes(q);
        const okTags = !hasTags || [...activeTags].every((t) => tags.includes(t));
        return okQuery && okTags;
      });
      grid.innerHTML = filtered.map(renderBlogCard).join("");
      if (empty) empty.hidden = filtered.length !== 0;
    };

    if (search) {
      search.addEventListener("input", apply);
    }

    tagButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const t = String(btn.getAttribute("data-tag") || "").toLowerCase().trim();
        if (!t) return;
        const pressed = activeTags.has(t);
        if (pressed) activeTags.delete(t);
        else activeTags.add(t);
        btn.setAttribute("aria-pressed", pressed ? "false" : "true");
        apply();
      });
    });

    apply();
  };

  const fetchBlogPost = async (slug) => {
    const res = await fetch(`/api/blog/posts/${encodeURIComponent(slug)}`, { cache: "no-store" });
    if (!res.ok) {
      const err = new Error(`Request failed: ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return await res.json();
  };

  const fetchFallbackPost = async (slug) => {
    const res = await fetch("/blog/posts.json", { cache: "no-store" });
    if (!res.ok) {
      const err = new Error(`Fallback failed: ${res.status}`);
      err.status = res.status;
      throw err;
    }
    const data = await res.json();
    const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
    const found = items.find((item) => slugify(item.slug || item.title || "") === slug);
    return found || null;
  };

  const renderPost = (container, item) => {
    const title = escapeHtml(item.title || "Blog");
    const date = escapeHtml(formatDateNL(item.date));
    const heroImage = item.hero || item.heroImage || item.heroImagePath || item.image || "";
    const content = sanitizeHtml(item.contentHtml || item.content || item.renderedHtml || "");
    const heroBlock = heroImage
      ? `<div class="blogpost-hero"><img src="${escapeHtml(heroImage)}" alt="${title}" loading="lazy" decoding="async" /></div>`
      : "";

    container.innerHTML = `
      <header class="blogpost-head">
        <p class="eyebrow">Blog</p>
        <h1>${title}</h1>
        <p class="blogpost-meta">${date}</p>
      </header>
      ${heroBlock}
      <div class="blogpost-content">${content}</div>
    `;
  };

  const renderPostError = (container, message) => {
    container.innerHTML = `
      <div class="note">${escapeHtml(message)} <a href="/blog/">Terug naar overzicht</a>.</div>
    `;
  };

  const initBlogDetail = async () => {
    const container = document.getElementById("blogPost");
    if (!container) return;

    const rawSlug = resolveSlug();
    const slug = slugify(rawSlug || "");
    if (!slug) {
      renderPostError(container, "Post niet gevonden.");
      return;
    }

    container.innerHTML = `
      <div class="blogpost-skeleton" aria-hidden="true">
        <div class="skeleton-line wide"></div>
        <div class="skeleton-line"></div>
        <div class="skeleton-line"></div>
        <div class="skeleton-block"></div>
      </div>
      <p class="note">Artikel laden...</p>
    `;

    try {
      const data = await fetchBlogPost(slug);
      if (!data || !data.slug) {
        throw new Error("not_found");
      }
      renderPost(container, data);
      return;
    } catch (err) {
      try {
        const fallback = await fetchFallbackPost(slug);
        if (fallback) {
          renderPost(container, fallback);
          return;
        }
      } catch {
        // ignore fallback errors
      }
      if (err && err.status === 404) {
        renderPostError(container, "Post niet gevonden.");
      } else {
        renderPostError(container, "Blog tijdelijk niet beschikbaar.");
      }
    }
  };

  const renderBlogDisabled = () => {
    const grid = document.getElementById("blogGrid");
    const empty = document.getElementById("blogEmpty");
    const post = document.getElementById("blogPost");
    const message =
      '<div class="note">Blog is tijdelijk niet beschikbaar. <a href="/">Terug naar home</a>.</div>';
    if (grid) {
      grid.innerHTML = message;
      if (empty) empty.hidden = true;
    }
    if (post) {
      post.innerHTML = message;
    }
  };

  const init = () => {
    const features = window.HV_SETTINGS?.features || {};
    const blogEnabled =
      features.blogEnabled !== false &&
      features.showBlog !== false &&
      features.blog !== false;
    if (!blogEnabled) {
      renderBlogDisabled();
      return;
    }
    initBlogIndex();
    initBlogDetail();
  };

  window.HVBlog = {
    init,
    initBlogIndex,
    initBlogDetail,
  };
})();
