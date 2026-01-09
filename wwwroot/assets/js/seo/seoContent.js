console.log("[seo] loaded", location.pathname);

// SEO content helper for Hulpveren.shop
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    const seo = factory();
    root.HVSeo = seo;
    if (!root.SeoContent) root.SeoContent = seo;
  }
})(typeof self !== "undefined" ? self : this, function () {
  const MAD_MAP = {
    "0": { springApplication: "assist", mount: "next_to_original" },
    "1": { springApplication: "full_replacement", mount: "lift_replacement" },
    "3": { springApplication: "assist", mount: "on_shock_absorber" },
    "5": { springApplication: "assist", mount: "in_original_spring" },
    "7": { springApplication: "assist", mount: "in_original_spring" },
    "8": { springApplication: "replacement", mount: "main_replacement" },
  };

  function getMadSuffixDigit(code) {
    const m = String(code || "").match(/(\d)(?!.*\d)/);
    return m ? m[1] : null;
  }

  function getKitDerived(kit) {
    if (kit && kit.derived) return kit.derived;
    const sku = String(kit?.sku || kit?.setCode || "");
    const digit = getMadSuffixDigit(sku);
    const map = digit ? MAD_MAP[digit] : null;
    const fromSuffix = map ? map.springApplication : null;
    const includesFSD = /^sd-/i.test(sku);
    return {
      springApplication: fromSuffix,
      solutionLevel: includesFSD ? "special_duty" : "standard",
      includesFSD: includesFSD || false,
      madSuffix: digit || "",
    };
  }

  function getAxleConfig(kit, fitment, context) {
    const cand =
      kit?.position ||
      kit?.axle ||
      kit?.axleConfig ||
      fitment?.position ||
      fitment?.axle ||
      (context && context.axleConfig) ||
      "";
    const val = String(cand || "").toLowerCase();
    if (["front", "rear", "both"].includes(val)) return val;
    return "rear";
  }

  function introText(springApplication) {
    if (springApplication === "replacement" || springApplication === "full_replacement") {
      return "Onze vervangingsveren vervangen de originele veren, herstellen de rijhoogte en vormen een structurele oplossing bij doorgezakte veren.";
    }
    return "Onze hulpveren ondersteunen de bestaande vering, geven extra draagvermogen bij belading, aanhanger of camperombouw en laten de originele veren zitten.";
  }

  function axleText(axle) {
    if (axle === "front") return "Toepassing op de vooras voor extra stabiliteit en draagvermogen.";
    if (axle === "both") return "Toepassing op voor- en achteras voor een gebalanceerde upgrade.";
    return "Toepassing op de achteras voor betere ondersteuning bij belading of trekhaakgebruik.";
  }

  function sdBlock(info) {
    if (info.solutionLevel !== "special_duty") return "";
    const lines = [
      "Special Duty set voor zwaardere belasting en hogere stabiliteit.",
    ];
    if (info.includesFSD) {
      lines.push("Frequency Selective Damping (FSD): past de demping automatisch aan op rijfrequentie voor comfort én controle.");
    }
    return `<div class="seo-sd"><strong>Special Duty</strong><ul>${lines
      .map((l) => `<li>${l}</li>`)
      .join("")}</ul></div>`;
  }

  function bulletList(info) {
    const bullets =
      info.springApplication === "replacement" || info.springApplication === "full_replacement"
        ? [
            "Vervangt de originele veren en herstelt rijhoogte en veercomfort.",
            "Structurele oplossing bij doorgezakte of vermoeide veren.",
            "Geschikt bij zware of continue belading.",
          ]
        : [
            "Ondersteunt de bestaande vering zonder demontage van de originele veren.",
            "Extra draagvermogen bij belading, aanhanger of camperombouw.",
            "Verbeterde stabiliteit zonder verlies van comfort.",
          ];
    if (info.solutionLevel === "special_duty") {
      bullets.push("Special Duty voor intensief gebruik of hogere last.");
    }
    return `<ul class="seo-bullets">${bullets
      .map((b) => `<li>${b}</li>`)
      .join("")}</ul>`;
  }

  function classifyPair(pair, context) {
    const derived = getKitDerived(pair.k || pair);
    const axle = getAxleConfig(pair.k || pair, pair.f, context);
    return {
      sku: pair.k?.sku || pair.sku || "",
      springApplication: derived.springApplication || "assist",
      solutionLevel: derived.solutionLevel || "standard",
      includesFSD: !!derived.includesFSD,
      axle,
      kit: pair.k || pair,
    };
  }

  function renderSet(info, ctx) {
    const intro = introText(info.springApplication);
    const sd = sdBlock(info);
    const bullets = bulletList(info);
    const axle = axleText(info.axle || (ctx && ctx.axleConfig));
    return `
      <section class="seo-block">
        <h2>${ctx?.title || "Waarom deze set?"}</h2>
        <p class="seo-intro">${intro}</p>
        <p class="seo-axle">${axle}</p>
        ${sd}
        ${bullets}
      </section>
    `;
  }

  function renderModel(infos, ctx) {
    if (!infos.length) return "";
    const byType = infos.reduce((acc, info) => {
      const key = info.springApplication || "assist";
      acc[key] = acc[key] || [];
      acc[key].push(info);
      return acc;
    }, {});
    const blocks = [];
    const makeModel = [ctx?.makeLabel, ctx?.modelLabel].filter(Boolean).join(" ");
    if (Object.keys(byType).length === 1) {
      const key = Object.keys(byType)[0];
      const info = byType[key][0];
      blocks.push(`<section class="seo-block"><h2>${makeModel} sets</h2><p class="seo-intro">${introText(key)}</p>${bulletList(info)}</section>`);
    } else {
      Object.entries(byType).forEach(([key, list]) => {
        const label = key === "replacement" || key === "full_replacement" ? "Vervangingsveren" : "Hulpveren";
        blocks.push(
          `<section class="seo-block">
            <h3>${label} voor ${makeModel}</h3>
            <p class="seo-intro">${introText(key)}</p>
            <div class="seo-kits">${list
              .map(
                (info) =>
                  `<div class="seo-chip">${info.sku} · ${axleText(info.axle)}${info.solutionLevel === "special_duty" ? " · SD" : ""}</div>`
              )
              .join("")}</div>
          </section>`
        );
      });
    }
    return `<div class="seo-content">${blocks.join("")}</div>`;
  }

  function renderBrand(ctx) {
    const label = ctx?.makeLabel || "dit merk";
    const intro = introText("assist");
    return `<section class="seo-block"><h2>${label} hulpveren</h2><p class="seo-intro">${intro}</p></section>`;
  }

  return {
    MAD_MAP,
    getMadSuffixDigit,
    getKitDerived,
    getAxleConfig,
    renderSet,
    renderModel,
    renderBrand,
  };
});
// === Modular SEO blocks (v2) ===
(function (root) {
  "use strict";

  if (!root || root.__HV_SEO_V2_LOADED__) return;
  root.__HV_SEO_V2_LOADED__ = true;

  const HAS_DOM =
    typeof window !== "undefined" && typeof document !== "undefined";
  const SEO_STATE = {
    rendering: false,
    rendered: false,
    lastHtml: "",
    lastPageType: "",
    retries: 0,
    init: false,
  };
  const MAX_RETRIES = 6;

  const TARGETS = {
    generation: { min: 600, max: 900 },
    model: { min: 900, max: 1300 },
    set: { min: 300, max: 500 },
    brand: { min: 450, max: 700 },
  };

  const MAD_MAP = {
    "0": { springApplication: "assist", mount: "next_to_original" },
    "1": { springApplication: "full_replacement", mount: "lift_replacement" },
    "3": { springApplication: "assist", mount: "on_shock_absorber" },
    "5": { springApplication: "assist", mount: "in_original_spring" },
    "7": { springApplication: "assist", mount: "in_original_spring" },
    "8": { springApplication: "replacement", mount: "main_replacement" },
  };

  function getMadSuffixDigit(code) {
    const m = String(code || "").match(/(\d)(?!.*\d)/);
    return m ? m[1] : null;
  }

  function getKitDerived(kit) {
    if (kit && kit.derived) return kit.derived;
    const sku = String(kit?.sku || kit?.setCode || "");
    const digit = getMadSuffixDigit(sku);
    const map = digit ? MAD_MAP[digit] : null;
    const fromSuffix = map ? map.springApplication : null;
    const includesFSD = /^sd-/i.test(sku);
    return {
      springApplication: fromSuffix,
      solutionLevel: includesFSD ? "special_duty" : "standard",
      includesFSD: includesFSD || false,
      madSuffix: digit || "",
    };
  }

  function getAxleConfig(kit, fitment, context) {
    const cand =
      kit?.position ||
      kit?.axle ||
      kit?.axleConfig ||
      fitment?.position ||
      fitment?.axle ||
      (context && context.axleConfig) ||
      "";
    const val = String(cand || "").toLowerCase();
    if (["front", "rear", "both"].includes(val)) return val;
    return "rear";
  }

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function stripTags(value) {
    return String(value || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function wordCount(value) {
    const text = stripTags(value);
    if (!text) return 0;
    return text.split(" ").length;
  }

  function hashString(value) {
    const str = String(value || "");
    let hash = 0;
    for (let i = 0; i < str.length; i += 1) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  function pickVariant(key, options) {
    const seed = HAS_DOM ? location.pathname + location.search : "seo";
    const idx = hashString(`${seed}|${key}`) % options.length;
    const pick = options[idx];
    return typeof pick === "function" ? pick() : pick;
  }

  function sentence(text) {
    const trimmed = String(text || "").trim();
    if (!trimmed) return "";
    return trimmed.endsWith(".") ? trimmed : `${trimmed}.`;
  }

  function paragraph(sentences) {
    const out = sentences.filter(Boolean).map(sentence).join(" ");
    return out ? `<p>${out}</p>` : "";
  }

  function normalizePageType(value) {
    const val = String(value || "").toLowerCase();
    if (val === "model" || val === "generation" || val === "set" || val === "brand") {
      return val;
    }
    return "";
  }

  function normalizeSku(value) {
    const m = String(value || "").match(/\b(?:HV|SD|NR|LS)-\d{3,6}\b/i);
    return m ? m[0].toUpperCase() : "";
  }

  function normalizeType(value) {
    const val = String(value || "").toLowerCase();
    if (val.includes("replacement") || val.includes("vervang")) {
      return "replacement";
    }
    return val ? "helper" : "";
  }

  function normalizeAxle(value) {
    const val = String(value || "").toLowerCase();
    if (
      val.includes("voor- en achter") ||
      val.includes("voor/achter") ||
      val.includes("both")
    ) {
      return "both";
    }
    if (val.includes("vooras") || val.includes("front")) return "front";
    if (val.includes("achteras") || val.includes("rear")) return "rear";
    return "";
  }

  function axleLabel(value) {
    if (value === "front") return "vooras";
    if (value === "rear") return "achteras";
    if (value === "both") return "voor- en achteras";
    return "passende as";
  }

  function typeLabel(value) {
    return value === "replacement" ? "vervangingsveren" : "hulpveren";
  }

  function titleCase(value) {
    return String(value || "")
      .trim()
      .split(/\s+/)
      .map((part) =>
        part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : ""
      )
      .join(" ");
  }

  function slugToLabel(value) {
    const raw = String(value || "").replace(/[-_]+/g, " ").trim();
    return titleCase(raw);
  }

  function yearToNumber(value) {
    const m = String(value || "").match(/\b(19|20)\d{2}\b/);
    return m ? Number(m[0]) : null;
  }

  function extractYearRange(text) {
    const matches = String(text || "").match(/\b(19|20)\d{2}\b/g) || [];
    const years = matches.map((m) => Number(m)).filter((n) => Number.isFinite(n));
    if (!years.length) return {};
    return { yearFrom: Math.min(...years), yearTo: Math.max(...years) };
  }

  function formatYearRange(yearFrom, yearTo) {
    if (!yearFrom && !yearTo) return "";
    if (yearFrom && yearTo && yearFrom !== yearTo) {
      return `${yearFrom} tot ${yearTo}`;
    }
    return `${yearFrom || yearTo}`;
  }

  function readDataAttrs() {
    if (!HAS_DOM) return {};
    const body = document.body;
    const main = document.querySelector("main");
    const host =
      (body && body.dataset && body.dataset.pageType && body) ||
      (main && main.dataset && main.dataset.pageType && main) ||
      body ||
      main;
    const ds = host && host.dataset ? host.dataset : {};
    return {
      pageType: normalizePageType(ds.pageType),
      make: ds.make || ds.brand || "",
      model: ds.model || "",
      generation: ds.generation || ds.platform || "",
      yearFrom: yearToNumber(ds.yearFrom),
      yearTo: yearToNumber(ds.yearTo),
      sku: normalizeSku(ds.sku || ds.set || ""),
    };
  }

  function readPageData() {
    const raw = root && root.__PAGE_DATA__;
    if (!raw || typeof raw !== "object") return {};
    return {
      pageType: normalizePageType(raw.pageType || raw.type),
      make: raw.make || raw.brand || raw.makeLabel || "",
      model: raw.model || raw.modelLabel || "",
      generation: raw.generation || raw.platform || "",
      yearFrom: yearToNumber(raw.yearFrom || raw.year_from || raw.year_start),
      yearTo: yearToNumber(raw.yearTo || raw.year_to || raw.year_end),
      sku: normalizeSku(raw.sku || raw.set || ""),
      sets: normalizeSets(raw.sets || raw.kits || raw.items || []),
      applications: normalizeApplications(raw.applications || raw.fitments || []),
    };
  }

  function parseUrlData() {
    if (!HAS_DOM) return {};
    const out = {};
    const path = location.pathname || "/";
    const segments = path.split("/").filter(Boolean);
    const params = new URLSearchParams(location.search || "");
    const setParam = params.get("set") || params.get("sku") || "";
    if (setParam) out.sku = normalizeSku(setParam);
    const match = path.match(/\b(?:hv|sd|nr|ls)-\d{3,6}\b/i);
    if (match) out.sku = normalizeSku(match[0]);
    const isSetPath = /^\/hulpveren\/hv-\d{6}\/?$/i.test(path);
    if (segments[0] === "hulpveren") {
      if (segments[1] && normalizeSku(segments[1])) {
        out.sku = normalizeSku(segments[1]);
      }
      if (segments[1] && segments[2]) {
        out.makeSlug = segments[1];
        out.modelSlug = segments[2];
        out.make = slugToLabel(segments[1]);
        out.model = slugToLabel(segments[2]);
      }
      if (segments[3]) {
        out.generationSlug = segments[3];
        out.generation = slugToLabel(segments[3]);
      }
      if (
        segments.length === 2 &&
        segments[1] &&
        !out.sku &&
        !isSetPath
      ) {
        out.makeSlug = segments[1];
        out.make = slugToLabel(segments[1]);
        out.pageType = "brand";
      }
    }
    const yearFromSlug = extractYearRange(out.generationSlug || "");
    if (yearFromSlug.yearFrom && !out.yearFrom) out.yearFrom = yearFromSlug.yearFrom;
    if (yearFromSlug.yearTo && !out.yearTo) out.yearTo = yearFromSlug.yearTo;
    if (out.sku) out.pageType = "set";
    else if (out.make && out.model && out.generation) out.pageType = "generation";
    else if (out.make && out.model) out.pageType = "model";
    return out;
  }

  function parseH1Data() {
    if (!HAS_DOM) return {};
    const h1 = document.querySelector("h1");
    if (!h1) return {};
    const text = String(h1.textContent || "").replace(/\s+/g, " ").trim();
    const out = {};
    const skuMatch = text.match(/\b(?:HV|SD|NR|LS)-\d{3,6}\b/i);
    if (skuMatch) out.sku = normalizeSku(skuMatch[0]);
    const year = extractYearRange(text);
    if (year.yearFrom) out.yearFrom = year.yearFrom;
    if (year.yearTo) out.yearTo = year.yearTo;
    let cleaned = text
      .replace(/\b(hulpveren|vervangingsveren|verlagingsveren|luchtvering)\b/gi, "")
      .replace(/\b(voor|set|sets)\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    cleaned = cleaned.replace(/\s{2,}/g, " ").trim();
    if (cleaned) {
      out.makeModel = cleaned;
      const parts = cleaned.split(" ");
      if (parts.length >= 2) {
        out.make = parts[0];
        out.model = parts.slice(1).join(" ");
      } else {
        out.make = cleaned;
      }
    }
    return out;
  }

  function extractSkusFromText(text) {
    const matches =
      String(text || "").match(/\b(?:HV|SD|NR|LS)-\d{3,6}\b/g) || [];
    return Array.from(new Set(matches.map((m) => m.toUpperCase())));
  }

  function inferTypeFromSku(sku) {
    const derived = getKitDerived({ sku });
    const spring = String(derived.springApplication || "").toLowerCase();
    if (spring === "replacement" || spring === "full_replacement") {
      return "replacement";
    }
    return "helper";
  }

  function typeFromText(text) {
    const val = String(text || "").toLowerCase();
    if (val.includes("vervangingsveer") || val.includes("vervangingsveren")) {
      return "replacement";
    }
    return "";
  }

  function axleFromText(text) {
    const val = String(text || "").toLowerCase();
    if (
      val.includes("voor- en achteras") ||
      val.includes("voor/achter")
    ) {
      return "both";
    }
    if (val.includes("vooras")) return "front";
    if (val.includes("achteras")) return "rear";
    return "";
  }

  function normalizeSets(list) {
    if (!Array.isArray(list)) return [];
    const out = [];
    list.forEach((entry) => {
      const sku = normalizeSku(entry?.sku || entry?.SKU || entry?.setCode || entry);
      if (!sku) return;
      const type =
        normalizeType(entry?.type || entry?.springApplication || entry?.kind || "") ||
        inferTypeFromSku(sku);
      const axle = normalizeAxle(
        entry?.axle || entry?.position || entry?.axleConfig || ""
      );
      out.push({ sku, type, axle });
    });
    return out;
  }

  function mergeSets(...lists) {
    const out = [];
    const seen = new Set();
    lists.forEach((list) => {
      (list || []).forEach((item) => {
        const sku = normalizeSku(item?.sku || item);
        if (!sku || seen.has(sku)) return;
        const type =
          normalizeType(item?.type || item?.springApplication || "") ||
          inferTypeFromSku(sku);
        const axle = normalizeAxle(item?.axle || "");
        out.push({ sku, type, axle });
        seen.add(sku);
      });
    });
    return out;
  }

  function applicationKey(app) {
    const make = String(app.make || "").toLowerCase().trim();
    const model = String(app.model || "").toLowerCase().trim();
    const platform = String(app.platform || app.generation || "")
      .toLowerCase()
      .trim();
    const yearFrom = app.yearFrom || "";
    const yearTo = app.yearTo || "";
    return `${make}|${model}|${platform}|${yearFrom}|${yearTo}`;
  }

  function normalizeApplications(list) {
    const out = [];
    const seen = new Set();
    (list || []).forEach((item) => {
      if (!item) return;
      const make = titleCase(item.make || item.brand || item.makeLabel || "");
      const model = titleCase(item.model || item.modelLabel || "");
      if (!make || !model) return;
      const platform = Array.isArray(item.platform_codes)
        ? item.platform_codes.join(", ")
        : item.platform || item.platformCode || item.platform_code || "";
      const generation = item.generation || item.platformLabel || "";
      const yearFrom = yearToNumber(
        item.yearFrom || item.year_from || item.year_start || item.from
      );
      const yearTo = yearToNumber(
        item.yearTo || item.year_to || item.year_end || item.to
      );
      const app = { make, model, platform, generation, yearFrom, yearTo };
      const key = applicationKey(app);
      if (seen.has(key)) return;
      seen.add(key);
      out.push(app);
    });
    return out;
  }

  function mergeApplications(...lists) {
    const out = [];
    const seen = new Set();
    lists.forEach((list) => {
      normalizeApplications(list).forEach((app) => {
        const key = applicationKey(app);
        if (seen.has(key)) return;
        seen.add(key);
        out.push(app);
      });
    });
    return out;
  }

  function splitPlatformFromModel(value) {
    const text = String(value || "").trim();
    const match = text.match(/^(.*)\s*\(([^)]+)\)\s*$/);
    if (!match) return { model: text, platform: "" };
    return { model: match[1].trim(), platform: match[2].trim() };
  }

  function parseApplicationsFromDom() {
    if (!HAS_DOM) return [];
    const apps = [];
    const cards = Array.from(document.querySelectorAll("#sku-fitments .card"));
    if (cards.length) {
      cards.forEach((card) => {
        const make = String(
          card.querySelector(".t")?.textContent || ""
        ).trim();
        if (!make) return;
        const items = Array.from(card.querySelectorAll("ul.fitment-list li"));
        items.forEach((item) => {
          const link = item.querySelector("a");
          const modelText = String(
            link?.textContent || item.childNodes[0]?.textContent || ""
          ).trim();
          if (!modelText) return;
          const split = splitPlatformFromModel(modelText);
          const smallText = String(
            item.querySelector("small")?.textContent || ""
          ).trim();
          const years = extractYearRange(smallText);
          apps.push({
            make,
            model: split.model,
            platform: split.platform,
            yearFrom: years.yearFrom,
            yearTo: years.yearTo,
          });
        });
      });
    }
    if (!apps.length) {
      const items = Array.from(document.querySelectorAll("#sku-fitments li"));
      items.forEach((item) => {
        const raw = String(item.textContent || "").replace(/\s+/g, " ").trim();
        if (!raw) return;
        const years = extractYearRange(raw);
        const cleaned = raw.replace(/\b(19|20)\d{2}\b/g, "").trim();
        const parts = cleaned.split(" ").filter(Boolean);
        if (parts.length < 2) return;
        const make = parts.shift();
        const model = parts.join(" ");
        apps.push({
          make,
          model,
          yearFrom: years.yearFrom,
          yearTo: years.yearTo,
        });
      });
    }
    return normalizeApplications(apps);
  }

  function collectApplications(data) {
    const fromData = mergeApplications(
      data.applications || [],
      data.fitments || []
    );
    const fromDom = parseApplicationsFromDom();
    return mergeApplications(fromData, fromDom);
  }

  function formatApplicationLabel(app) {
    const platform = app.platform || app.generation || "";
    const yearRange = formatYearRange(app.yearFrom, app.yearTo);
    const parts = [esc(app.model || "")];
    if (platform) parts.push(`(${esc(platform)})`);
    if (yearRange) parts.push(`- ${esc(yearRange)}`);
    return parts.join(" ").trim();
  }

  function buildApplicationsList(applications, limit) {
    const list = Array.isArray(applications) ? applications.slice() : [];
    list.sort((a, b) => {
      const makeCmp = String(a.make).localeCompare(String(b.make), "nl");
      if (makeCmp !== 0) return makeCmp;
      return String(a.model).localeCompare(String(b.model), "nl");
    });
    const grouped = new Map();
    list.forEach((app) => {
      if (!app.make) return;
      if (!grouped.has(app.make)) grouped.set(app.make, []);
      grouped.get(app.make).push(app);
    });

    const totalCount = list.length;
    const limitValue = Number.isFinite(limit) ? limit : 30;
    let remaining = limitValue;
    const items = [];
    Array.from(grouped.keys()).forEach((make) => {
      if (remaining <= 0) return;
      const models = grouped.get(make) || [];
      models.sort((a, b) =>
        String(a.model).localeCompare(String(b.model), "nl")
      );
      const slice = models.slice(0, remaining);
      remaining -= slice.length;
      if (!slice.length) return;
      const modelItems = slice
        .map((app) => `<li>${formatApplicationLabel(app)}</li>`)
        .join("");
      items.push(`<li><strong>${esc(make)}</strong><ul>${modelItems}</ul></li>`);
    });

    const shownCount = Math.min(totalCount, limitValue - remaining);
    const note =
      totalCount > shownCount
        ? `<p>En meer toepassingen beschikbaar. Gebruik de filters of zoekfunctie om sneller te vinden.</p>`
        : "";
    const html = items.length
      ? `<ul>${items.join("")}</ul>${note}`
      : `<p>Toepassingen worden ingeladen. Controleer de lijst zodra deze beschikbaar is.</p>`;
    return { html, totalCount, shownCount };
  }

  function collectGenerationLinks(makeSlug, modelSlug) {
    if (!HAS_DOM) return [];
    const links = [];
    const seen = new Set();
    const anchors = Array.from(
      document.querySelectorAll('a[href*="/hulpveren/"]')
    );
    anchors.forEach((a) => {
      const href = a.getAttribute("href") || "";
      const match = href.match(
        /\/hulpveren\/([^/]+)\/([^/]+)\/([^/]+)\//
      );
      if (!match) return;
      const [, make, model, gen] = match;
      if (makeSlug && make !== makeSlug) return;
      if (modelSlug && model !== modelSlug) return;
      const key = `${make}/${model}/${gen}`;
      if (seen.has(key)) return;
      seen.add(key);
      links.push({
        href,
        label: slugToLabel(gen),
      });
    });
    return links;
  }

  function yearRangeFromFitments(fitments) {
    const years = [];
    (fitments || []).forEach((f) => {
      const y1 = yearToNumber(f?.year_from);
      const y2 = yearToNumber(f?.year_to);
      if (y1) years.push(y1);
      if (y2) years.push(y2);
    });
    if (!years.length) return {};
    return { yearFrom: Math.min(...years), yearTo: Math.max(...years) };
  }

  function pickFromFitments(fitments) {
    const entry = (fitments || []).find((f) => f && (f.make || f.model));
    if (!entry) return {};
    return {
      make: titleCase(entry.make || ""),
      model: titleCase(entry.model || ""),
    };
  }

  async function enrichSetData(data) {
    if (!HAS_DOM) return data;
    if (data.pageType !== "set" || !data.sku) return data;
    if (data.make && data.model && data.sets && data.sets.length) return data;
    const sku = data.sku;
    const family = sku.split("-")[0].toUpperCase();
    const url =
      family === "NR"
        ? "/data/nr-kits.json"
        : family === "LS"
          ? "/data/ls-kits.json"
          : "/data/hv-kits.json";
    try {
      const res = await fetch(url, { cache: "force-cache" });
      if (!res.ok) return data;
      const payload = await res.json();
      const kits = Array.isArray(payload) ? payload : payload.kits || [];
      const kit = kits.find((k) => normalizeSku(k?.sku) === sku);
      if (!kit) return data;
      const derived = getKitDerived(kit);
      const type = normalizeType(derived.springApplication) || inferTypeFromSku(sku);
      const axle = normalizeAxle(
        kit?.position || kit?.axle || kit?.axleConfig || ""
      );
      const range = yearRangeFromFitments(kit?.fitments || []);
      const pick = pickFromFitments(kit?.fitments || []);
      const applications = mergeApplications(
        data.applications || [],
        kit?.fitments || []
      );
      const sets = mergeSets(data.sets || [], [{ sku, type, axle }]);
      return {
        ...data,
        make: data.make || pick.make || "",
        model: data.model || pick.model || "",
        yearFrom: data.yearFrom || range.yearFrom || null,
        yearTo: data.yearTo || range.yearTo || null,
        sets,
        applications,
        fitments: kit?.fitments || data.fitments || [],
        axle: axle || data.axle || "",
      };
    } catch (err) {
      return data;
    }
  }

  async function getPageData() {
    const fromAttr = readDataAttrs();
    const fromPage = readPageData();
    const fromUrl = parseUrlData();
    const fromH1 = parseH1Data();

    const data = {
      pageType:
        fromAttr.pageType || fromPage.pageType || fromUrl.pageType || "",
      make: fromAttr.make || fromPage.make || fromUrl.make || fromH1.make || "",
      model:
        fromAttr.model || fromPage.model || fromUrl.model || fromH1.model || "",
      generation:
        fromAttr.generation ||
        fromPage.generation ||
        fromUrl.generation ||
        "",
      yearFrom:
        fromAttr.yearFrom ||
        fromPage.yearFrom ||
        fromUrl.yearFrom ||
        fromH1.yearFrom ||
        null,
      yearTo:
        fromAttr.yearTo ||
        fromPage.yearTo ||
        fromUrl.yearTo ||
        fromH1.yearTo ||
        null,
      sku: fromAttr.sku || fromPage.sku || fromUrl.sku || fromH1.sku || "",
      sets: mergeSets(fromPage.sets || []),
      applications: fromPage.applications || [],
      makeModel: fromH1.makeModel || "",
      makeSlug: fromUrl.makeSlug || "",
      modelSlug: fromUrl.modelSlug || "",
    };

    const domSets = [];
    if (HAS_DOM) {
      const nodes = [
        ...Array.from(document.querySelectorAll("[data-sku]")),
        ...Array.from(document.querySelectorAll(".sku")),
      ];
      nodes.forEach((node) => {
        const sku = normalizeSku(
          node.getAttribute?.("data-sku") || node.textContent || ""
        );
        if (!sku) return;
        const text = `${node.textContent || ""} ${
          node.parentElement ? node.parentElement.textContent || "" : ""
        }`;
        const type = typeFromText(text) || inferTypeFromSku(sku);
        const axle = axleFromText(text);
        domSets.push({ sku, type, axle });
      });
      const textSkus = extractSkusFromText(
        document.body ? document.body.innerText : ""
      );
      textSkus.forEach((sku) => domSets.push({ sku, type: inferTypeFromSku(sku) }));
    }
    data.sets = mergeSets(data.sets || [], normalizeSets(domSets));

    if (!data.pageType) {
      if (data.sku) data.pageType = "set";
      else if (data.make && data.model && data.generation) data.pageType = "generation";
      else if (data.make && data.model) data.pageType = "model";
    }

    const enriched = await enrichSetData(data);
    return enriched;
  }

  function detectPageType(data) {
    const fromData = normalizePageType(data.pageType);
    if (fromData) return fromData;
    if (data.sku) return "set";
    if (data.make && data.model && data.generation) return "generation";
    if (data.make && data.model) return "model";
    if (data.make && !data.model && !data.generation) return "brand";
    return "";
  }

  function shouldDelay(data, pageType) {
    if (!HAS_DOM) return false;
    if (pageType === "set") return false;
    if (pageType === "brand") {
      if (!data.make && SEO_STATE.retries < MAX_RETRIES) return true;
      return false;
    }
    if ((!data.make || !data.model) && SEO_STATE.retries < MAX_RETRIES) return true;
    if (!data.sets.length && SEO_STATE.retries < MAX_RETRIES) return true;
    return false;
  }

  function buildContext(data) {
    const make = String(data.make || "").trim();
    const model = String(data.model || "").trim();
    const makeModel =
      (make && model && `${make} ${model}`) || make || model || "dit model";
    const generation = String(data.generation || "").trim();
    const generationLabel = generation || "deze uitvoering";
    const yearRange = formatYearRange(data.yearFrom, data.yearTo);
    const yearPhrase = yearRange ? `voor bouwjaren ${yearRange}` : "voor meerdere bouwjaren";
    const sets = mergeSets(data.sets || []);
    const hasReplacement = sets.some((set) => set.type === "replacement");
    const hasHelper = sets.some((set) => set.type !== "replacement");
    const sku = String(data.sku || "").toUpperCase();
    const axle = normalizeAxle(data.axle || (sets[0] ? sets[0].axle : ""));
    const setType =
      normalizeType(data.setType || (sets[0] ? sets[0].type : "")) ||
      (sku ? inferTypeFromSku(sku) : "helper");

    return {
      make,
      model,
      makeModel,
      generation: generationLabel,
      yearRange,
      yearPhrase,
      sets,
      hasReplacement,
      hasHelper,
      sku,
      axle,
      setType,
      makeSlug: data.makeSlug || "",
      modelSlug: data.modelSlug || "",
      makeModelHtml: esc(makeModel),
      generationHtml: esc(generationLabel),
      yearRangeHtml: esc(yearRange),
      skuHtml: esc(sku),
    };
  }

  function makeBlock(id, title, bodyHtml, optional) {
    return {
      id,
      title,
      bodyHtml,
      optional: !!optional,
    };
  }

  function buildFaq(items) {
    return items
      .map(
        (item) =>
          `<section><h3>${esc(item.q)}</h3>${item.a}</section>`
      )
      .join("");
  }

  function buildGenerationBlocks(data) {
    const ctx = buildContext(data);
    const typeSummary = ctx.hasHelper && ctx.hasReplacement
      ? "hulpveren en vervangingsveren"
      : ctx.hasReplacement
        ? "vervangingsveren"
        : "hulpveren";

    const intro = paragraph([
      pickVariant("gen_intro_open", [
        `Voor de ${ctx.makeModelHtml} ${ctx.generationHtml} ${ctx.yearPhrase} draait het om balans tussen draagkracht en comfort, zeker wanneer gebruik en belading wisselen`,
        `De ${ctx.makeModelHtml} ${ctx.generationHtml} ${ctx.yearPhrase} is gebouwd voor gemiddeld gebruik, maar in de praktijk ligt de belasting vaak hoger`,
        `Wie met de ${ctx.makeModelHtml} ${ctx.generationHtml} ${ctx.yearPhrase} rijdt, merkt snel dat de vering sterk afhankelijk is van lading en gebruik`,
      ]),
      `Op deze pagina lees je hoe hulpveren de ${ctx.makeModelHtml} ${ctx.generationHtml} ondersteunen en wanneer een vervangingsveer beter past`,
      `We benoemen de beschikbare settypes (${typeSummary}) en leggen uit hoe askeuze en bouwjaar invloed hebben op de keuze`,
    ]);

    const problem = paragraph([
      pickVariant("gen_problem_open", [
        `Bij de ${ctx.makeModelHtml} ${ctx.generationHtml} zie je doorzakken meestal wanneer de achteras regelmatiger wordt belast dan de fabriek heeft ingecalculeerd`,
        `De ${ctx.makeModelHtml} ${ctx.generationHtml} kan gevoelig zijn voor doorzakken zodra belading of trekgewicht toeneemt`,
        `Veel rijders merken bij de ${ctx.makeModelHtml} ${ctx.generationHtml} dat de rijhoogte afneemt zodra de auto zwaarder wordt belast`,
      ]),
      `Belading met gereedschap, caravan of camperombouw verandert de stand van de ${ctx.makeModelHtml} ${ctx.generationHtml}, waardoor de auto rust minder stabiel aanvoelt`,
      `Ook bij leeg rijden kan de ${ctx.makeModelHtml} ${ctx.generationHtml} meer naloop tonen als de veren vermoeid raken`,
      `Het gevolg is minder stabiliteit en een minder strak stuurgevoel, vooral op drempels en oneffen wegdek`,
    ]);

    const solution = paragraph([
      pickVariant("gen_solution_open", [
        `Hulpveren voor de ${ctx.makeModelHtml} ${ctx.generationHtml} ondersteunen de originele veren en vergroten het draagvermogen zonder alles te vervangen`,
        `Met hulpveren krijgt de ${ctx.makeModelHtml} ${ctx.generationHtml} extra ondersteuning wanneer de belasting toeneemt`,
        `De ${ctx.makeModelHtml} ${ctx.generationHtml} profiteert van hulpveren doordat de rijhoogte beter op peil blijft bij belading`,
      ]),
      `Je merkt dit vooral bij de achteras wanneer de ${ctx.makeModelHtml} ${ctx.generationHtml} zwaarder wordt ingezet`,
      `Als de ${ctx.makeModelHtml} ${ctx.generationHtml} structureel is ingezakt, zijn vervangingsveren een logische optie omdat ze de originele veren vervangen`,
      `Welke optie het best past, hangt af van gebruik, aslast en de mate van doorzakken bij de ${ctx.makeModelHtml} ${ctx.generationHtml}`,
    ]);

    const load = paragraph([
      pickVariant("gen_load_open", [
        `Rijd je met de ${ctx.makeModelHtml} ${ctx.generationHtml} soms leeg en soms zwaar beladen, dan is een hulpveer ideaal omdat hij pas merkbaar wordt zodra er druk op de as komt`,
        `Bij wisselende belading werkt een hulpveer voor de ${ctx.makeModelHtml} ${ctx.generationHtml} prettig, omdat de ondersteuning pas toeneemt wanneer dat nodig is`,
        `Voor de ${ctx.makeModelHtml} ${ctx.generationHtml} met wisselende lading is een hulpveer vaak de meest logische keuze`,
      ]),
      `Gebruik je de ${ctx.makeModelHtml} ${ctx.generationHtml} vrijwel altijd met vaste belading, dan voelt een set met hogere basisondersteuning vaak consistenter`,
      `In beide gevallen blijft het doel gelijk: de ${ctx.makeModelHtml} ${ctx.generationHtml} houdt een stabieler niveau en reageert voorspelbaar bij remmen en bochten`,
      `Kies daarom op basis van je gemiddelde belasting, niet alleen op een incidentele piek`,
    ]);

    const ride = paragraph([
      pickVariant("gen_ride_open", [
        `Met hulpveren stuurt de ${ctx.makeModelHtml} ${ctx.generationHtml} strakker in en voelt de carrosserie minder wiebelig, vooral op hogere snelheid`,
        `De ${ctx.makeModelHtml} ${ctx.generationHtml} voelt met ondersteuning rustiger aan in bochten en bij zijwind`,
        `Na montage voelt de ${ctx.makeModelHtml} ${ctx.generationHtml} stabieler, vooral wanneer de auto zwaarder is beladen`,
      ]),
      `Tegelijk blijft het comfort van de ${ctx.makeModelHtml} ${ctx.generationHtml} overeind omdat de originele veren actief blijven`,
      `Een gelijkmatiger rijhoogte helpt de ${ctx.makeModelHtml} ${ctx.generationHtml} ook om banden gelijkmatiger te belasten, al blijft bandenspanning belangrijk`,
    ]);

    const install = paragraph([
      pickVariant("gen_install_open", [
        `Montage van hulpveren voor de ${ctx.makeModelHtml} ${ctx.generationHtml} is doorgaans binnen enkele uren klaar, afhankelijk van as en uitvoering`,
        `De ${ctx.makeModelHtml} ${ctx.generationHtml} heeft voor montage meestal geen ingrijpende aanpassing nodig, maar het werk vraagt wel nauwkeurigheid`,
        `Voor de ${ctx.makeModelHtml} ${ctx.generationHtml} is montage vaak een dagdeel werk, afhankelijk van uitvoering en bereikbaarheid`,
      ]),
      `Na montage is er weinig onderhoud nodig; controleer bij de ${ctx.makeModelHtml} ${ctx.generationHtml} vooral bevestiging en rijhoogte na de eerste rit`,
      `Waar een set voor de ${ctx.makeModelHtml} ${ctx.generationHtml} TUV of vergelijkbare documentatie heeft, staat dat per SKU vermeld`,
      `Kwaliteitssets zijn ontworpen voor lange inzet en passen binnen de originele ophanging van de ${ctx.makeModelHtml} ${ctx.generationHtml}`,
    ]);

    const faq = buildFaq([
      {
        q: `Past elke set op elke uitvoering van de ${ctx.makeModel} ${ctx.generation}?`,
        a: paragraph([
          `Nee, de ${ctx.makeModelHtml} ${ctx.generationHtml} kent verschillen in aslast, motor en uitvoering`,
          `Controleer daarom altijd bouwjaar, aspositie en eventuele opmerkingen per set voor de ${ctx.makeModelHtml} ${ctx.generationHtml}`,
        ]),
      },
      {
        q: `Wordt de ${ctx.makeModel} ${ctx.generation} harder met hulpveren?`,
        a: paragraph([
          `De ${ctx.makeModelHtml} ${ctx.generationHtml} kan iets strakker aanvoelen bij belading, maar leeg blijft het comfort vergelijkbaar omdat de originele veren blijven werken`,
          `Bij de ${ctx.makeModelHtml} ${ctx.generationHtml} merk je vooral meer controle, niet per se meer stugheid`,
        ]),
      },
      {
        q: `Kan ik met de ${ctx.makeModel} ${ctx.generation} nog een trekhaak gebruiken?`,
        a: paragraph([
          `Ja, hulpveren voor de ${ctx.makeModelHtml} ${ctx.generationHtml} zijn juist bedoeld om trekgewicht beter te ondersteunen`,
          `Controleer bij de ${ctx.makeModelHtml} ${ctx.generationHtml} wel of de set past bij jouw trekhaakbelasting en uitvoering`,
        ]),
      },
    ]);

    const setItems = ctx.sets.slice(0, 12).map((set) => {
      const axle = set.axle ? ` - ${axleLabel(set.axle)}` : "";
      return `<li>${esc(set.sku)} - ${typeLabel(set.type)}${axle}</li>`;
    });
    const setSummary = ctx.sets.length
      ? `<p>Voor ${ctx.makeModelHtml} ${ctx.generationHtml} zijn ${ctx.sets.length} set(s) beschikbaar, verdeeld over ${typeSummary}.</p>`
      : `<p>De setlijst voor ${ctx.makeModelHtml} ${ctx.generationHtml} wordt ingeladen op basis van beschikbare data.</p>`;
    const setList = `${setSummary}${setItems.length ? `<ul>${setItems.join("")}</ul>` : ""}`;

    const blocks = [
      makeBlock(
        "gen-intro",
        `Hulpveren voor ${ctx.makeModel} ${ctx.generation}`,
        intro
      ),
      makeBlock(
        "gen-problem",
        `Waarom de ${ctx.makeModel} ${ctx.generation} inzakt`,
        problem
      ),
      makeBlock(
        "gen-solution",
        "Oplossing: hulpveren en vervangingsveren",
        solution
      ),
      makeBlock("gen-load", "Constant of wisselend beladen", load),
      makeBlock("gen-ride", "Rijgedrag en techniek", ride),
      makeBlock("gen-install", "Montage en levensduur", install),
      makeBlock("gen-faq", "Mini-FAQ", faq),
      makeBlock(
        "gen-sets",
        `Beschikbare sets voor ${ctx.makeModel} ${ctx.generation}`,
        setList
      ),
    ];

    const reserve = [
      makeBlock(
        "gen-tips",
        "Praktische tips bij belading",
        paragraph([
          `Voor de ${ctx.makeModelHtml} ${ctx.generationHtml} helpt het om zware lading zo dicht mogelijk bij de as te plaatsen`,
          `Een gelijkmatige verdeling voorkomt dat de ${ctx.makeModelHtml} ${ctx.generationHtml} scheef zakt en houdt de set in het werkgebied`,
          `Controleer bij de ${ctx.makeModelHtml} ${ctx.generationHtml} ook bandenspanning en aslast, omdat dit de werking van hulpveren versterkt`,
        ]),
        true
      ),
    ];

    return { blocks, reserve, target: TARGETS.generation };
  }

  function buildModelBlocks(data) {
    const ctx = buildContext(data);
    const typeSummary = ctx.hasHelper && ctx.hasReplacement
      ? "hulpveren en vervangingsveren"
      : ctx.hasReplacement
        ? "vervangingsveren"
        : "hulpveren";

    const intro = paragraph([
      pickVariant("model_intro_open", [
        `De ${ctx.makeModelHtml} ${ctx.yearPhrase} bestaat uit meerdere generaties, waardoor de vering per bouwjaar en uitvoering anders aanvoelt bij belading`,
        `Wie een ${ctx.makeModelHtml} rijdt, merkt dat draagkracht en rijhoogte per generatie verschillen, vooral wanneer gebruik en belading wisselen`,
        `Voor de ${ctx.makeModelHtml} ${ctx.yearPhrase} spelen meerdere factoren mee, zoals uitvoering, aslast en hoe vaak je zwaarder rijdt`,
      ]),
      `Op deze modelpagina bundelen we ${typeSummary} voor de ${ctx.makeModelHtml}, zodat je per generatie snel de juiste richting ziet`,
      `We leggen uit waarom dit model kan doorzakken, welke oplossing past bij jouw gebruik en hoe je de set afstemt op aspositie en bouwjaar`,
      `Gebruik de verschillen per generatie als startpunt en controleer daarna de setdetails voor jouw uitvoering`,
    ]);

    const why = paragraph([
      pickVariant("model_why_open", [
        `Bij de ${ctx.makeModelHtml} komt doorzakken meestal voort uit structurele belading, trekgewicht of extra uitrusting die niet in het basisontwerp is meegenomen`,
        `De ${ctx.makeModelHtml} is ontworpen voor gemiddeld gebruik, maar in de praktijk rijden veel eigenaren met gereedschap, bagage of een aanhanger`,
        `Voor de ${ctx.makeModelHtml} speelt de combinatie van gewicht en rijstijl een grote rol, waardoor de achteras sneller inzakt dan verwacht`,
      ]),
      `Wanneer de rijhoogte daalt, verandert het stuurgevoel en wordt de ${ctx.makeModelHtml} gevoeliger voor hobbels en zijwind`,
      `Extra ondersteuning herstelt het niveau en helpt de ${ctx.makeModelHtml} weer stabiel te reageren bij drempels en bochten`,
    ]);

    const genLinks = collectGenerationLinks(ctx.makeSlug, ctx.modelSlug);
    const linkLabels = genLinks.map((link) => link.label).filter(Boolean);
    const fallbackLabels = ["eerste bouwjaren", "midden serie", "nieuwste uitvoeringen"];
    const labels = [];
    linkLabels.forEach((label) => {
      if (labels.length < 3 && !labels.includes(label)) labels.push(label);
    });
    while (labels.length < 3) {
      labels.push(fallbackLabels[labels.length]);
    }

    const genSections = labels.map((label, index) => {
      const labelText = String(label || "").trim();
      const labelPhrase = /\d/.test(labelText) ? `bouwjaren ${labelText}` : labelText;
      const labelHtml = esc(labelText || "deze generatie");
      const labelPhraseHtml = esc(labelPhrase || "deze generatie");
      const body = paragraph([
        pickVariant(`model_gen_${index}_open`, [
          `Binnen de ${ctx.makeModelHtml} zie je bij ${labelPhraseHtml} vaak dat de veerafstelling is gericht op leeg rijden, terwijl het praktijkgebruik zwaarder is`,
          `Voor de ${ctx.makeModelHtml} ${labelPhraseHtml} geldt dat het onderstel vaak strakker is, maar het verschil tussen leeg en beladen merkbaar blijft`,
          `De ${ctx.makeModelHtml} ${labelPhraseHtml} heeft zijn eigen balans tussen comfort en draagkracht, waardoor extra ondersteuning soms sneller nodig is`,
        ]),
        `Hulpveren geven extra ondersteuning wanneer belasting toeneemt, terwijl vervangingsveren juist een vaste basis bieden als de originele veren vermoeid zijn`,
        `Let bij ${labelHtml} goed op uitvoering en aslast, omdat die bepalen welke set past bij jouw ${ctx.makeModelHtml}`,
        `Met de juiste keuze blijft de ${ctx.makeModelHtml} stabieler bij remmen en bochten zonder dat het dagelijkse comfort verdwijnt`,
      ]);
      return `<section><h3>${labelHtml}</h3>${body}</section>`;
    });
    const generations = genSections.join("");

    const usage = paragraph([
      pickVariant("model_usage_open", [
        `Particulier gebruik van de ${ctx.makeModelHtml} draait vaak om wisselende belading, weekendritten en incidenteel trekgewicht`,
        `Wie de ${ctx.makeModelHtml} prive gebruikt, merkt vooral verschil bij vakanties, fietsendragers of een caravan`,
        `Bij particulier gebruik van de ${ctx.makeModelHtml} wisselt de belasting, waardoor ondersteuning vooral op piekmomenten nodig is`,
      ]),
      `Zakelijk gebruik of intensieve inzet vraagt juist om constante ondersteuning, omdat de ${ctx.makeModelHtml} dan vrijwel altijd gewicht draagt`,
      `Kijk daarom niet alleen naar één rit, maar naar het gemiddelde gebruik van jouw ${ctx.makeModelHtml}`,
      `Een set die past bij jouw ritme zorgt voor rust en voorkomt dat de auto gaat deinen bij belading`,
    ]);

    const choice = paragraph([
      pickVariant("model_choice_open", [
        `Hulpveren voor de ${ctx.makeModelHtml} ondersteunen de bestaande veren en worden vooral actief zodra de belasting stijgt`,
        `Met hulpveren krijgt de ${ctx.makeModelHtml} extra draagvermogen wanneer dat nodig is, zonder dat de basisvering wordt vervangen`,
        `Voor de ${ctx.makeModelHtml} is een hulpveer vaak de meest flexibele oplossing bij wisselende lading`,
      ]),
      `Vervangingsveren zijn bedoeld wanneer de originele veren structureel zijn doorgezakt of wanneer je een vaste, hogere basisondersteuning zoekt`,
      `Kies daarom hulpveren bij wisselende belasting en vervangingsveren bij permanente belading of herstel van rijhoogte`,
      `Controleer bij beide opties altijd bouwjaar, aspositie en uitvoering van de ${ctx.makeModelHtml}`,
    ]);

    const linkBlock = genLinks.length
      ? (() => {
          const items = genLinks.slice(0, 8).map((link) => {
            const label = esc(link.label || "deze generatie");
            const href = esc(link.href || "#");
            return `<li><a href="${href}">Hulpveren voor ${ctx.makeModelHtml} ${label}</a></li>`;
          });
          return `${paragraph([
            `Bekijk per generatie welke sets passen bij de ${ctx.makeModelHtml} en vergelijk bouwjaar en uitvoering voordat je bestelt`,
          ])}${items.length ? `<ul>${items.join("")}</ul>` : ""}`;
        })()
      : "";

    const faq = buildFaq([
      {
        q: `Zijn hulpveren voor elke ${ctx.makeModel} generatie hetzelfde?`,
        a: paragraph([
          `Nee, de ${ctx.makeModelHtml} kent per generatie andere aslasten en uitvoeringen`,
          `Controleer daarom altijd bouwjaar en type zodat de set goed past bij jouw ${ctx.makeModelHtml}`,
        ]),
      },
      {
        q: `Wanneer kies ik vervangingsveren voor de ${ctx.makeModel}?`,
        a: paragraph([
          `Vervangingsveren zijn geschikt wanneer de originele veren van de ${ctx.makeModelHtml} zijn doorgezakt`,
          `Ze geven een vaste basis en zijn logisch bij constante of zware belading`,
        ]),
      },
      {
        q: `Blijft de ${ctx.makeModel} comfortabel met hulpveren?`,
        a: paragraph([
          `Ja, hulpveren werken mee met de originele veren en worden vooral actief bij belasting`,
          `Daardoor blijft de ${ctx.makeModelHtml} leeg grotendeels hetzelfde aanvoelen`,
        ]),
      },
      {
        q: `Moet ik de aspositie weten voor mijn ${ctx.makeModel}?`,
        a: paragraph([
          `Ja, veel sets zijn specifiek voor de vooras of achteras van de ${ctx.makeModelHtml}`,
          `Controleer de setinformatie zodat je de juiste positie kiest`,
        ]),
      },
    ]);

    const cta = paragraph([
      `Klaar om de juiste set voor jouw ${ctx.makeModelHtml} te kiezen?`,
      `Selecteer de generatie, controleer de uitvoering en bekijk de beschikbare sets om direct te bestellen`,
    ]);

    const blocks = [
      makeBlock("model-intro", `Hulpveren voor ${ctx.makeModel}`, intro),
      makeBlock("model-why", `Waarom ondersteuning bij ${ctx.makeModel}`, why),
      makeBlock("model-generations", "Verschillen per generatie", generations),
      makeBlock("model-usage", "Particulier vs zakelijk gebruik", usage),
      makeBlock("model-choice", "Keuzehulp: hulpveren of vervangingsveren", choice),
    ];

    if (linkBlock) {
      blocks.push(
        makeBlock(
          "model-links",
          `Generaties van ${ctx.makeModel}`,
          linkBlock
        )
      );
    }

    blocks.push(makeBlock("model-faq", "FAQ", faq));
    blocks.push(makeBlock("model-cta", "Kies jouw set", cta));

    const reserve = [
      makeBlock(
        "model-tips",
        "Extra tips voor belading",
        paragraph([
          `Voor de ${ctx.makeModelHtml} loont het om lading zo dicht mogelijk bij de as te plaatsen`,
          `Een gelijkmatige verdeling vermindert het kantelen en helpt de ${ctx.makeModelHtml} stabiel te blijven`,
          `Controleer daarnaast bandenspanning en maximum aslast, zodat de set optimaal werkt`,
        ]),
        true
      ),
    ];

    return { blocks, reserve, target: TARGETS.model };
  }

  function buildBrandBlocks(data, options) {
    const ctx = buildContext(data);
    const path = HAS_DOM ? (location.pathname || "").toLowerCase() : "";
    const segments = path.split("/").filter(Boolean);
    const brandSlug = data.makeSlug || segments[1] || "";
    const h1Text = HAS_DOM ? (document.querySelector("h1")?.textContent || "") : "";
    const h1Clean = h1Text.replace(/\s+/g, " ").trim();
    const brandName = (data.make || h1Clean || slugToLabel(brandSlug) || "dit merk").trim();
    const brandHtml = esc(brandName);

    const modelLinks = [];
    if (HAS_DOM && brandSlug) {
      const selector = `a[href^="/hulpveren/${brandSlug}/"]`;
      const anchors = Array.from(document.querySelectorAll(selector));
      const seen = new Set();
      anchors.forEach((a) => {
        const href = a.getAttribute("href") || "";
        const match = href.match(
          new RegExp(`^/hulpveren/${brandSlug}/([^/]+)/?$`, "i")
        );
        if (!match) return;
        const modelSlug = match[1];
        if (!modelSlug || seen.has(modelSlug)) return;
        seen.add(modelSlug);
        modelLinks.push({
          href: href.endsWith("/") ? href : `${href}/`,
          label: slugToLabel(modelSlug),
        });
      });
    }

    const intro = paragraph([
      pickVariant("brand_intro_open", [
        `De ${brandHtml} modellenpagina helpt je snel de juiste hulpveren of vervangingsveren te vinden, afgestemd op bouwjaar en uitvoering`,
        `Op deze ${brandHtml} merkpagina vind je per model de beschikbare hulpveren en vervangingsveren, zodat je gericht kunt vergelijken`,
        `Voor ${brandHtml} bundelen we de beschikbare hulpveren en vervangingsveren per model, met focus op gebruik en belading`,
      ]),
      `Je ziet welke sets per model beschikbaar zijn en waar je op let bij wisselende belading of trekhaakgebruik`,
      `Gebruik de modelpagina’s om de juiste set voor jouw ${brandHtml} te kiezen en controleer altijd bouwjaar en uitvoering`,
    ]);

    const situations = paragraph([
      pickVariant("brand_situations_open", [
        `Bij ${brandHtml} zien we dat belading, aanhanger of caravan extra druk op de achteras geeft en de rijhoogte zichtbaar kan laten zakken`,
        `Voor ${brandHtml} ontstaat doorzakken vaak bij combinatie van gewicht, extra uitrusting en veelvuldig gebruik op lange ritten`,
        `Wie met een ${brandHtml} regelmatig laadt of trekt, merkt soms instabiliteit of een minder strakke lijn bij drempels en bochten`,
      ]),
      `De balans tussen comfort en draagkracht verschilt per uitvoering, waardoor de ene ${brandHtml} sneller ondersteuning nodig heeft dan de andere`,
      `Belangrijk is dat je niet alleen naar een enkel moment kijkt, maar naar het gemiddelde gebruik van jouw ${brandHtml}`,
      `Daarom werken we per model, zodat je makkelijker de set vindt die past bij jouw situatie`,
    ]);

    const solutions = paragraph([
      pickVariant("brand_solutions_open", [
        `Hulpveren ondersteunen de originele vering van jouw ${brandHtml} en worden vooral actief zodra de belasting toeneemt`,
        `Met hulpveren blijft de ${brandHtml} beter op niveau bij belading, terwijl de originele veren intact blijven`,
        `Hulpveren voor ${brandHtml} geven extra draagkracht wanneer dat nodig is, zonder het dagelijkse comfort onnodig te veranderen`,
      ]),
      `Vervangingsveren zijn bedoeld wanneer de originele veren van de ${brandHtml} zijn ingezakt of wanneer je een vaste, hogere basisondersteuning zoekt`,
      `De beste keuze hangt af van hoe vaak je zwaar beladen rijdt en hoe je ${brandHtml} in de praktijk gebruikt`,
    ]);

    const guidance = paragraph([
      pickVariant("brand_guidance_open", [
        `Rijd je incidenteel beladen met jouw ${brandHtml}, dan is extra ondersteuning die pas actief wordt vaak de meest comfortabele keuze`,
        `Voor ${brandHtml} met wisselende lading is het prettig wanneer de ondersteuning pas toeneemt zodra de belasting hoger is`,
        `Als jouw ${brandHtml} vooral leeg rijdt, maar af en toe zwaar wordt belast, kies je liever een oplossing die flexibel meewerkt`,
      ]),
      `Bij vrijwel constante zware belading is een set met meer basisondersteuning logischer, zeker als de originele veren vermoeid zijn`,
      `Controleer bouwjaar en uitvoering op de modelpagina om zeker te weten dat de set past bij jouw ${brandHtml}`,
    ]);

    const faqItems = [
      {
        q: `Veranderen hulpveren het comfort van mijn ${brandName}?`,
        a: paragraph([
          `Hulpveren voor ${brandHtml} werken mee met de originele vering en worden vooral merkbaar bij belading`,
          `Leeg blijft het comfort grotendeels zoals je gewend bent, terwijl beladen meer stabiliteit ontstaat`,
        ]),
      },
      {
        q: `Wanneer kies ik vervangingsveren voor mijn ${brandName}?`,
        a: paragraph([
          `Vervangingsveren zijn bedoeld als de originele veren van jouw ${brandHtml} zijn doorgezakt`,
          `Ze geven een vaste basis en passen bij constante of zware belading`,
        ]),
      },
      {
        q: `Hoe weet ik welke set past bij mijn ${brandName}?`,
        a: paragraph([
          `Gebruik de modelpagina om bouwjaar, uitvoering en aspositie te controleren`,
          `Zo weet je zeker dat de set aansluit op jouw ${brandHtml} uitvoering`,
        ]),
      },
    ];

    const faq = buildFaq((options && options.shortFaq) ? faqItems.slice(0, 2) : faqItems);

    const linkItems = modelLinks.slice(0, 10).map((link) => {
      const label = esc(link.label || "dit model");
      const href = esc(link.href || "#");
      return `<li><a href="${href}">Hulpveren voor ${brandHtml} ${label}</a></li>`;
    });
    const linksBlock = linkItems.length
      ? `${paragraph([
          `Bekijk de populairste ${brandHtml} modellen en klik door naar de juiste sets per bouwjaar en uitvoering`,
        ])}${linkItems.length ? `<ul>${linkItems.join("")}</ul>` : ""}`
      : "";

    const blocks = [
      makeBlock("brand-intro", `Hulpveren voor ${brandName}`, intro),
      makeBlock("brand-situations", "Veelvoorkomende situaties", situations),
      makeBlock(
        "brand-solutions",
        `Welke oplossing past bij jouw ${brandName}?`,
        solutions
      ),
      makeBlock("brand-guidance", "Keuzehulp", guidance),
      makeBlock("brand-faq", "Mini-FAQ", faq),
    ];

    if (linksBlock) {
      blocks.push(
        makeBlock(
          "brand-links",
          `Populaire ${brandName} modellen`,
          linksBlock
        )
      );
    }

    const reserve = [
      makeBlock(
        "brand-tips",
        "Praktische tips bij belading",
        paragraph([
          `Voor ${brandHtml} helpt het om lading zo dicht mogelijk bij de as te plaatsen en gelijkmatig te verdelen`,
          `Een stabiele verdeling zorgt dat de ${brandHtml} rechter blijft staan en minder beweegt bij drempels`,
          `Controleer ook bandenspanning en maximale aslast, zodat de set optimaal kan werken`,
        ]),
        true
      ),
    ];

    return { blocks, reserve, target: TARGETS.brand };
  }

  function buildSetBlocks(data) {
    const ctx = buildContext(data);
    const sku =
      ctx.sku ||
      normalizeSku(HAS_DOM ? location.pathname : "") ||
      "HV-SET";
    const skuHtml = esc(sku);
    const typeText = typeLabel(ctx.setType);
    const isReplacement = ctx.setType === "replacement";
    const axleLabelText = ctx.axle ? axleLabel(ctx.axle) : "";
    const axleLower = axleLabelText ? axleLabelText.toLowerCase() : "";

    const applications = collectApplications(data);
    const listInfo = buildApplicationsList(applications, 30);

    const introOptions = isReplacement
      ? [
          `Set ${skuHtml} is bedoeld als vervangingsveren wanneer de originele veren zijn ingezakt`,
          `Set ${skuHtml} vervangt de originele veren en helpt de rijhoogte weer op niveau te brengen`,
          `Met set ${skuHtml} kies je voor vervangingsveren die een vaste basis geven bij belading`,
        ]
      : [
          `Set ${skuHtml} is ontworpen om extra ondersteuning te geven wanneer het voertuig zwaarder wordt belast`,
          `Met set ${skuHtml} blijft de rijhoogte beter op peil zodra de belasting toeneemt`,
          `Set ${skuHtml} biedt extra draagkracht bij belading of trekgewicht zonder de basisvering volledig te vervangen`,
        ];
    const typeSentence = isReplacement
      ? `Dit is een ${typeText} set die de originele veren vervangt en de rijhoogte herstelt`
      : `Dit is een ${typeText} set met focus op ondersteuning bij belading, zonder dat je de basisvering hoeft te wisselen`;

    const intro = paragraph([
      pickVariant(
        isReplacement ? "set_intro_open_rep" : "set_intro_open_assist",
        introOptions
      ),
      typeSentence,
      `Hieronder vind je alle toepassingen van set ${skuHtml}, zodat je direct ziet of jouw uitvoering erbij staat`,
      `Controleer altijd bouwjaar en uitvoering in de lijst voordat je bestelt`,
    ]);

    const applicationsIntro = applications.length
      ? paragraph([
          `De toepassingen zijn gegroepeerd per merk en model om sneller te kunnen scannen`,
          `Zo zie je in een oogopslag of set ${skuHtml} past bij jouw voertuig`,
        ])
      : "";

    const applicationsBlock = `${applicationsIntro}${listInfo.html}`;

    const axleBlock = axleLabelText
      ? paragraph([
          `Deze set is bedoeld voor de ${axleLower}, zodat de extra ondersteuning precies op de juiste plek werkt`,
          `Montage is doorgaans binnen enkele uren mogelijk, afhankelijk van bereikbaarheid en uitvoering`,
        ])
      : "";

    const noticeable = paragraph([
      pickVariant("set_notice_open", [
        `Je merkt het effect vooral wanneer het voertuig beladen is of wanneer er met trekgewicht wordt gereden`,
        `Bij belading of extra uitrusting merk je dat de auto minder inzakt en rustiger reageert`,
        `De ondersteuning wordt vooral merkbaar bij belading, trekhaakgebruik of extra uitrusting`,
      ]),
      `Zonder belading blijft het karakter grotendeels gelijk, terwijl de stabiliteit bij belasting toeneemt`,
      `Het doel is meer controle en minder deinen, niet een stugge rijervaring`,
    ]);

    const faq = buildFaq([
      {
        q: `Verandert set ${sku} het comfort wanneer je leeg rijdt?`,
        a: paragraph([
          `De set werkt vooral wanneer de belasting toeneemt, waardoor het comfort leeg meestal vergelijkbaar blijft`,
          `Bij belading voelt het voertuig rustiger en stabieler aan`,
        ]),
      },
      {
        q: `Hoe weet ik of set ${sku} past bij mijn uitvoering?`,
        a: paragraph([
          `Gebruik de toepassingenlijst en controleer bouwjaar en uitvoering zorgvuldig`,
          `Bij twijfel kun je de setgegevens vergelijken met de specificaties van jouw voertuig`,
        ]),
      },
    ]);

    const specItems = [];
    if (sku) specItems.push(`<li>SKU: ${skuHtml}</li>`);
    if (ctx.setType) specItems.push(`<li>Type: ${typeText}</li>`);
    if (ctx.axle) specItems.push(`<li>Aspositie: ${axleLabelText}</li>`);
    if (ctx.yearRange) specItems.push(`<li>Bouwjaren: ${ctx.yearRangeHtml}</li>`);
    const specs = specItems.length ? `<ul>${specItems.join("")}</ul>` : "";

    const blocks = [
      makeBlock("set-intro", `Set ${sku} hulpveren`, intro),
      makeBlock("set-applications", "Toepassingen van deze set", applicationsBlock),
    ];

    if (axleBlock) {
      blocks.push(makeBlock("set-axle", "As en montage", axleBlock));
    }

    blocks.push(makeBlock("set-notice", "Wanneer merkbaar", noticeable));
    blocks.push(makeBlock("set-faq", "Mini-FAQ", faq));

    if (specs) {
      blocks.push(makeBlock("set-specs", "Set-overzicht", specs));
    }

    const reserve = [
      makeBlock(
        "set-tips",
        "Praktische tips bij belading",
        paragraph([
          `Plaats zware lading zo dicht mogelijk bij de as en verdeel het gewicht gelijkmatig`,
          `Een stabiele verdeling helpt de set beter te werken en houdt het voertuig rustiger`,
          `Controleer bandenspanning en maximale aslast om de ondersteuning optimaal te benutten`,
        ]),
        true
      ),
    ];

    return { blocks, reserve, target: TARGETS.set };
  }

  function blocksToHtml(blocks) {
    return blocks
      .map((block) => {
        const id = esc(block.id || "");
        const title = esc(block.title || "");
        return `<section class="seo-block" data-seo-block="${id}"><h2>${title}</h2>${block.bodyHtml || ""}</section>`;
      })
      .join("");
  }

  function adjustBlocks(blocks, reserve, target) {
    const base = blocks.slice();
    if (!target) return base;
    const baseCount = wordCount(blocksToHtml(base));
    if (baseCount < target.min && reserve && reserve.length) {
      const withReserve = base.concat(reserve[0]);
      const withCount = wordCount(blocksToHtml(withReserve));
      if (withCount <= target.max) return withReserve;
    }
    return base;
  }

  function ensureContainer(pageType) {
    if (!HAS_DOM) return null;
    let container = document.querySelector("#seo-content");
    if (!container) container = document.querySelector("[data-seo-content]");
    if (container) {
      if (!container.id) container.id = "seo-content";
      container.classList.add("seo-wrap");
      return container;
    }
    const main =
      document.querySelector("main") ||
      document.querySelector(".content") ||
      document.querySelector(".page-content") ||
      document.body;
    if (!main) return null;
    container = document.createElement("div");
    container.id = "seo-content";
    container.setAttribute("data-seo-content", "1");
    container.classList.add("seo-wrap");
    if (pageType === "brand") {
      const grid = document.querySelector(".grid");
      if (grid && grid.parentElement) {
        grid.parentElement.insertBefore(container, grid);
        return container;
      }
    }
    main.appendChild(container);
    return container;
  }

  function scheduleRender() {
    if (!HAS_DOM) return;
    if (SEO_STATE.retries >= MAX_RETRIES) return;
    const delay = 200 + SEO_STATE.retries * 200;
    window.setTimeout(() => renderSeo(true), delay);
  }

  async function renderSeo(force) {
    if (!HAS_DOM) return;
    if (SEO_STATE.rendering) return;
    SEO_STATE.rendering = true;
    try {
      const data = await getPageData();
      const pageType = detectPageType(data);
      if (!pageType) return;
      if (shouldDelay(data, pageType)) {
        SEO_STATE.retries += 1;
        SEO_STATE.rendering = false;
        scheduleRender();
        return;
      }

      SEO_STATE.retries = 0;
      let result = null;
      if (pageType === "generation") result = buildGenerationBlocks(data);
      if (pageType === "model") result = buildModelBlocks(data);
      if (pageType === "set") result = buildSetBlocks(data);
      if (pageType === "brand") result = buildBrandBlocks(data);
      if (!result) return;

      if (pageType === "brand" && result.target) {
        const baseCount = wordCount(blocksToHtml(result.blocks));
        if (baseCount > result.target.max) {
          result = buildBrandBlocks(data, { shortFaq: true });
        }
      }

      const blocks = adjustBlocks(result.blocks, result.reserve, result.target);
      const html = blocksToHtml(blocks);
      const count = wordCount(html);
      const container = ensureContainer(pageType);
      if (!container) return;
      if (!container.innerHTML || force || SEO_STATE.lastHtml !== html) {
        container.innerHTML = html;
      }
      SEO_STATE.lastHtml = html;
      SEO_STATE.lastPageType = pageType;
      SEO_STATE.rendered = true;
      console.log("[seo] pageType=", pageType, "words=", count);
    } catch (err) {
      console.log("[seo] render error", err);
    } finally {
      SEO_STATE.rendering = false;
    }
  }

  function setupObserver() {
    if (!HAS_DOM || SEO_STATE.observer) return;
    const observer = new MutationObserver(() => {
      if (SEO_STATE.rendering) return;
      const container =
        document.querySelector("#seo-content") ||
        document.querySelector("[data-seo-content]");
      if (!container || !container.innerHTML) {
        renderSeo(true);
      }
    });
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
      SEO_STATE.observer = observer;
    }
  }

  function init() {
    if (!HAS_DOM) return;
    const path = (location.pathname || "").toLowerCase();
    const isSetPage = /^\/hulpveren\/hv-\d{6}\/?$/.test(path);
    if (isSetPage) {
      document.documentElement.classList.add("is-set-page");
      const removeBrandsGrid = () => {
        const headings = Array.from(document.querySelectorAll("h1,h2,h3"));
        const target = headings.find(
          (h) => (h.textContent || "").trim().toLowerCase() === "hulpveren per merk"
        );
        if (!target) return false;
        const section =
          target.closest("section.wrap") ||
          target.closest("section") ||
          target.parentElement;
        if (section) {
          section.remove();
          console.log("[seo] removed brands grid on set page");
          return true;
        }
        return false;
      };
      removeBrandsGrid();
      const obs = new MutationObserver(() => {
        if (removeBrandsGrid()) {
          obs.disconnect();
        }
      });
      if (document.body) {
        obs.observe(document.body, { childList: true, subtree: true });
        window.setTimeout(() => obs.disconnect(), 5000);
      }
    }
    if (SEO_STATE.init) return;
    SEO_STATE.init = true;
    const start = () => {
      renderSeo();
      setupObserver();
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
      start();
    }
  }

  function renderBrand(ctx) {
    const label = esc(ctx?.makeLabel || ctx?.make || "dit merk");
    const intro = paragraph([
      pickVariant("brand_intro_open", [
        `${label} voertuigen worden vaak breder ingezet dan de fabriek verwacht, waardoor extra ondersteuning bij belading welkom is`,
        `Bij ${label} modellen speelt belading een grote rol in rijhoogte en stabiliteit, zeker bij trekhaakgebruik`,
        `Wie met ${label} rijdt en regelmatig extra gewicht meeneemt, merkt al snel het verschil dat ondersteuning kan maken`,
      ]),
      `Hulpveren ondersteunen de originele vering en houden de rijhoogte beter op peil zonder dat het dagelijkse comfort verdwijnt`,
      `Kies per model en bouwjaar een set die past bij jouw gebruik en uitvoering`,
    ]);
    return `<section class="seo-block"><h2>${label} hulpveren</h2>${intro}</section>`;
  }

  function renderModel() {
    return "";
  }

  const seoModule = {
    init,
    renderSeo,
    renderBrand,
    renderModel,
    wordCount,
    getMadSuffixDigit,
    getKitDerived,
    getAxleConfig,
    isV2: true,
  };

  if (typeof module === "object" && module.exports) {
    module.exports = seoModule;
  }

  root.HVSeo = seoModule;
  root.SeoContent = seoModule;

  init();
})(typeof self !== "undefined" ? self : this);
