// /assets/js/plateContext.js
(() => {
  "use strict";

  /* Fix Summary:
   * Broken: Plate bar bindings could duplicate after partial reloads and lacked reliable redirects.
   * Change: Guarded bindings, added plate status/reset UI, and standardized redirects to /kenteken.
   * Test: Use the header plate search with valid/invalid input; verify redirect to /kenteken/?kt=.
   */

  const STORAGE_KEY = "hv_plate_context";
  const EVENT_NAME = "plate:changed";
  const PLATE_PATH = "/kenteken/";

  const safeJsonParse = (raw) => {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  const normalizePlate = (value) =>
    String(value || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");

  function driveTypeLabel(dt) {
    const s = String(dt || "").toUpperCase();
    if (!s) return "";
    if (s === "FWD") return "2WD (voorwiel)";
    if (s === "RWD") return "2WD (achterwiel)";
    if (s === "AWD" || s === "4WD" || s === "4X4") return "4WD";
    return s;
  }

  function parseEngineCodes(engineType) {
    return String(engineType || "")
      .split(";")
      .map((x) => x.trim())
      .filter(Boolean);
  }

  function toUiVehicleFromCandidate(c) {
    if (!c || typeof c !== "object") return null;
    const engineCodes = Array.isArray(c.engineCodes)
      ? c.engineCodes
      : parseEngineCodes(c.engineType || c.engineCode || "");

    return {
      plate: c.plate || "",
      make: c.make || "",
      model: c.model || "",
      bodyType: c.bodyType || "",
      type: c.type || "",
      kw: c.kw ?? null,
      kwCat: c.kwCat ?? null,
      driveType: c.driveType || "",
      driveTypeLabel: driveTypeLabel(c.driveType || ""),
      driveLabel: c.driveLabel || driveTypeLabel(c.driveType || ""),
      vehicleType: c.vehicleType || "",
      firstColor: c.firstColor || "",
      secondColor: c.secondColor || "",
      seatCount: c.seatCount ?? null,
      cylinders: c.cylinders ?? null,
      engineContents: c.engineContents ?? null,
      weightEmpty: c.weightEmpty ?? null,
      maxWeight: c.maxWeight ?? null,
      engineCodes,
      engineCode: c.engineCode || engineCodes[0] || "",
      typeFrom: c.typeFrom ?? null,
      typeTill: c.typeTill ?? null,
      year: c.year ?? null,
    };
  }

  function mergeVehicleRaw(existing, incoming, source) {
    const a = existing && typeof existing === "object" ? existing : {};
    const b = incoming && typeof incoming === "object" ? incoming : {};
    return {
      ...a,
      ...b,
      _rawSources: Array.from(
        new Set([...(a._rawSources || []), source].filter(Boolean))
      ),
    };
  }

  function ensureCtx() {
    const ctx =
      window.hv_plate_context || (window.hv_plate_context = { plate: "", vehicle: {} });
    ctx.vehicle = ctx.vehicle || {};
    return ctx;
  }

  function dispatchPlateContextUpdated(reason) {
    try {
      window.dispatchEvent(
        new CustomEvent("hv:plateContextUpdated", {
          detail: {
            reason: reason || "unknown",
            plate: window.hv_plate_context?.plate || "",
            ts: Date.now(),
          },
        })
      );
    } catch (_) {}
  }

  function setBaseFromAldoc(base, rawPayload) {
    const ctx = ensureCtx();

    if (base && typeof base === "object") {
      const v = ctx.vehicle;
      if (base.make) v.make = base.make;
      if (base.model) v.model = base.model;
      if (base.makeSlug) v.makeSlug = base.makeSlug;
      if (base.modelSlug) v.modelSlug = base.modelSlug;
      if (base.rangeLabel) v.rangeLabel = base.rangeLabel;
      if (base.kt) v.kt = base.kt;
    }

    ctx.vehicle.baseSource = "aldoc";
    ctx.vehicle.baseUpdatedAt = Date.now();

    if (rawPayload && typeof rawPayload === "object") {
      if (typeof mergeVehicleRaw === "function") {
        ctx.vehicleRaw = mergeVehicleRaw(ctx.vehicleRaw, rawPayload, "aldoc");
      } else {
        ctx.vehicleRaw = { ...(ctx.vehicleRaw || {}), ...rawPayload };
      }
    }

    try {
      savePlateContext(ctx);
    } catch (_) {}
    dispatchPlateContextUpdated("aldoc");
  }

  function setYearFromRdw(year, rawPayload) {
    if (Array.isArray(rawPayload)) rawPayload = rawPayload[0] || {};
    if (rawPayload && Array.isArray(rawPayload.data)) rawPayload = rawPayload.data[0] || {};
    const ctx = ensureCtx();
    const v = ctx.vehicle;

    if (year && typeof year === "object") {
      if (year.buildFrom) v.buildFrom = year.buildFrom;
      if (year.buildTo) v.buildTo = year.buildTo;

      if (year.yearMin) v.yearMin = Number(year.yearMin);
      if (year.yearMax) v.yearMax = Number(year.yearMax);

      if (v.yearMin && v.yearMax) v.rangeLabel = `${v.yearMin} — ${v.yearMax}`;
      else if (v.yearMin) v.rangeLabel = `${v.yearMin} —`;
    }

    v.yearSource = "rdw";
    v.yearUpdatedAt = Date.now();

    if (rawPayload && typeof rawPayload === "object") {
      if (typeof mergeVehicleRaw === "function") {
        ctx.vehicleRaw = mergeVehicleRaw(ctx.vehicleRaw, rawPayload, "rdw");
      } else {
        ctx.vehicleRaw = { ...(ctx.vehicleRaw || {}), ...rawPayload };
      }
    }

    try {
      savePlateContext(ctx);
    } catch (_) {}
    dispatchPlateContextUpdated("rdw");
  }

  function normalizeKt(raw) {
    const s = String(raw || "").trim();
    if (!s) return "";
    return s.startsWith("kt_") ? s : `kt_${s}`;
  }

  function isPlateRoot(parts) {
    const root = String(parts && parts[0] ? parts[0] : "").toLowerCase();
    return [
      "hulpveren",
      "luchtvering",
      "verlagingsveren",
      "kenteken",
      "hulpveren-op-kenteken",
      "luchtvering-op-kenteken",
      "verlagingsveren-op-kenteken",
    ].includes(root);
  }

  function isPlateSegment(value) {
    const s = String(value || "").trim();
    if (!/^[A-Z0-9]{4,8}$/i.test(s)) return false;
    return /\d/.test(s);
  }

  function isKtSegment(value) {
    const s = String(value || "").trim();
    if (!/^kt_[a-z0-9]+$/i.test(s)) return false;
    return /\d/.test(s.slice(3));
  }

  function stripStateSegments(pathname) {
    const parts = pathname.split("/").filter(Boolean);
    if (!isPlateRoot(parts)) {
      return "/" + parts.join("/") + "/";
    }
    if (parts.length && isKtSegment(parts[parts.length - 1])) {
      parts.pop();
    }
    if (parts.length && isPlateSegment(parts[parts.length - 1])) {
      parts.pop();
    }
    return "/" + parts.join("/") + "/";
  }

  function buildPlateKtUrl({ plateRaw, ktRaw }) {
    const plate = normalizePlate(plateRaw);
    const kt = normalizeKt(ktRaw);
    const base = stripStateSegments(window.location.pathname);
    const segments = [];
    if (plate) segments.push(plate);
    if (kt) segments.push(kt);
    return base + segments.join("/");
  }

  function readPlateKtFromUrl() {
    const parts = window.location.pathname.split("/").filter(Boolean);
    if (!isPlateRoot(parts)) return { plate: "", kt: "" };
    let kt = "";
    let plate = "";
    const last = parts[parts.length - 1] || "";
    if (isKtSegment(last)) {
      kt = last;
      const prev = parts[parts.length - 2] || "";
      if (isPlateSegment(prev)) plate = prev.toUpperCase();
    } else {
      if (isPlateSegment(last)) plate = last.toUpperCase();
    }
    return { plate, kt };
  }
  const sanitizePlateInput = (value) =>
    String(value || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");

  const slugify = (value) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");


  const escapeHtml = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[m]));

  const ensurePlateStatus = (bar) => {
    if (!bar) return null;
    let status = bar.querySelector(".plate-status");
    if (status) return status;
    status = document.createElement("div");
    status.className = "plate-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    bar.appendChild(status);
    return status;
  };

  const setPlateBarState = (bar, statusEl, state, message, options = {}) => {
    if (!bar || !statusEl) return;
    bar.dataset.plateState = state || "";
    statusEl.dataset.state = state || "";
    if (!message) {
      statusEl.textContent = "";
      return;
    }
    if (options.actionLabel) {
      statusEl.innerHTML = `
        <span class="plate-status__text">${escapeHtml(message)}</span>
        <div class="plate-status__actions">
          <button type="button" class="plate-status__reset" data-plate-reset="1">${escapeHtml(
            options.actionLabel
          )}</button>
        </div>
      `;
      const resetBtn = statusEl.querySelector("[data-plate-reset]");
      if (resetBtn && typeof options.onAction === "function") {
        resetBtn.addEventListener("click", options.onAction, { once: true });
      }
      return;
    }
    statusEl.textContent = message;
  };

  const parseYM = (input, defaultMonth = 1) => {
    if (input == null || input === "") return null;
    if (typeof input === "object" && input.year) {
      const year = Number.parseInt(input.year, 10);
      const month = Number.parseInt(input.month, 10) || defaultMonth;
      if (!Number.isFinite(year)) return null;
      const safeMonth =
        Number.isFinite(month) && month >= 1 && month <= 12 ? month : defaultMonth;
      return { year, month: safeMonth };
    }

    const raw = String(input || "").trim();
    if (!raw) return null;

    const yearOnly = raw.match(/^(\d{4})$/);
    if (yearOnly) {
      return { year: Number.parseInt(yearOnly[1], 10), month: defaultMonth };
    }

    const yearMonth = raw.match(/^(\d{4})[\/-](\d{1,2})(?:[\/-]\d{1,2})?$/);
    if (yearMonth) {
      const year = Number.parseInt(yearMonth[1], 10);
      const month = Number.parseInt(yearMonth[2], 10);
      if (!Number.isFinite(year)) return null;
      return {
        year,
        month: month >= 1 && month <= 12 ? month : defaultMonth,
      };
    }

    const monthYear = raw.match(/^(\d{1,2})[\/-](\d{4})$/);
    if (monthYear) {
      const month = Number.parseInt(monthYear[1], 10);
      const year = Number.parseInt(monthYear[2], 10);
      if (!Number.isFinite(year)) return null;
      return {
        year,
        month: month >= 1 && month <= 12 ? month : defaultMonth,
      };
    }

    const dayMonthYear = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (dayMonthYear) {
      const month = Number.parseInt(dayMonthYear[2], 10);
      const year = Number.parseInt(dayMonthYear[3], 10);
      if (!Number.isFinite(year)) return null;
      return {
        year,
        month: month >= 1 && month <= 12 ? month : defaultMonth,
      };
    }

    const digits = raw.replace(/\D/g, "");
    if (digits.length >= 8) {
      const year = Number.parseInt(digits.slice(0, 4), 10);
      const month = Number.parseInt(digits.slice(4, 6), 10);
      if (!Number.isFinite(year)) return null;
      return {
        year,
        month: month >= 1 && month <= 12 ? month : defaultMonth,
      };
    }
    if (digits.length >= 6) {
      const year = Number.parseInt(digits.slice(0, 4), 10);
      const month = Number.parseInt(digits.slice(4, 6), 10);
      if (!Number.isFinite(year)) return null;
      return {
        year,
        month: month >= 1 && month <= 12 ? month : defaultMonth,
      };
    }
    if (digits.length >= 4) {
      const year = Number.parseInt(digits.slice(0, 4), 10);
      return Number.isFinite(year) ? { year, month: defaultMonth } : null;
    }

    return null;
  };

  const toComparable = (ym) => {
    if (!ym || !Number.isFinite(ym.year) || !Number.isFinite(ym.month)) return null;
    return ym.year * 12 + (ym.month - 1);
  };

  const normalizeRange = (start, end) => {
    if (!start && !end) return null;
    return { start: start || null, end: end || null };
  };

  const parseRange = (input) => {
    if (input == null || input === "") return null;
    if (typeof input === "object") {
      if (input.label) {
        const viaLabel = parseRange(String(input.label));
        if (viaLabel) return viaLabel;
      }
      if (
        Object.prototype.hasOwnProperty.call(input, "start") ||
        Object.prototype.hasOwnProperty.call(input, "end")
      ) {
        const start = parseYM(input.start, 1);
        const end = parseYM(input.end, 12);
        return normalizeRange(start, end);
      }
      if (
        Object.prototype.hasOwnProperty.call(input, "from") ||
        Object.prototype.hasOwnProperty.call(input, "to")
      ) {
        const start = parseYM(input.from, 1);
        const end = parseYM(input.to, 12);
        return normalizeRange(start, end);
      }
      return null;
    }

    const raw = String(input || "").trim();
    if (!raw) return null;

    const slashParts = raw.split("/");
    if (slashParts.length >= 2) {
      const start = parseYM(slashParts[0], 1);
      const end = parseYM(slashParts[1], 12);
      return normalizeRange(start, end);
    }

    const yearRange = raw.match(/(\d{4})\s*-\s*(\d{4})/);
    if (yearRange) {
      const start = parseYM(yearRange[1], 1);
      const end = parseYM(yearRange[2], 12);
      return normalizeRange(start, end);
    }

    const singleStart = parseYM(raw, 1);
    const singleEnd = parseYM(raw, 12);
    return normalizeRange(singleStart, singleEnd);
  };

  const rangesOverlap = (rangeA, rangeB) => {
    if (!rangeA || !rangeB) return true;
    const aStart = toComparable(rangeA.start);
    const aEnd = toComparable(rangeA.end);
    const bStart = toComparable(rangeB.start);
    const bEnd = toComparable(rangeB.end);
    const left = aStart == null ? -Infinity : aStart;
    const right = aEnd == null ? Infinity : aEnd;
    const otherLeft = bStart == null ? -Infinity : bStart;
    const otherRight = bEnd == null ? Infinity : bEnd;
    return left <= otherRight && otherLeft <= right;
  };

  const clampRangeMax = (current, maxYM) => {
    if (!maxYM) return current;
    if (!current) return maxYM;
    const currentValue = toComparable(current);
    const maxValue = toComparable(maxYM);
    if (currentValue == null || maxValue == null) return current;
    return currentValue > maxValue ? maxYM : current;
  };

  const clampRangeMin = (current, minYM) => {
    if (!minYM) return current;
    if (!current) return minYM;
    const currentValue = toComparable(current);
    const minValue = toComparable(minYM);
    if (currentValue == null || minValue == null) return current;
    return currentValue < minValue ? minYM : current;
  };

  const clampGeneration = (range, generation) => {
    if (!range || !generation) return range;
    const start = range.start ? { ...range.start } : null;
    const end = range.end ? { ...range.end } : null;
    if (generation === 3) {
      const boundaryEnd = { year: 2015, month: 5 };
      return {
        start,
        end: clampRangeMax(end, boundaryEnd),
      };
    }
    if (generation === 4) {
      const boundaryStart = { year: 2015, month: 6 };
      return {
        start: clampRangeMin(start, boundaryStart),
        end,
      };
    }
    return range;
  };

  const formatYM = (ym) => {
    if (!ym || !ym.year) return "";
    const month =
      ym.month && ym.month >= 1 && ym.month <= 12
        ? String(ym.month).padStart(2, "0")
        : "";
    return month ? `${ym.year}-${month}` : String(ym.year);
  };

  const formatRangeLabel = (range) => {
    if (!range) return "";
    const start = formatYM(range.start);
    const end = formatYM(range.end);
    if (start && end) return `${start}-${end}`;
    return start || end || "";
  };

  const detectCaddyGeneration = (vehicle) => {
    if (!vehicle) return null;
    const label = [
      vehicle.modelLabel,
      vehicle.model,
      vehicle.modelname,
      vehicle.modelRemark,
      vehicle.model_remark,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (/(caddy\s*iii|caddy\s*3)/.test(label) || /caddy-iii/.test(label)) return 3;
    if (/(caddy\s*iv|caddy\s*4)/.test(label) || /caddy-iv/.test(label)) return 4;
    return null;
  };

  const loadPlateContext = () => {
    try {
      const sess = safeJsonParse(sessionStorage.getItem(STORAGE_KEY));
      if (sess) return sess;
      const local = safeJsonParse(localStorage.getItem(STORAGE_KEY));
      if (local) return local;
      const plateOnly = localStorage.getItem("hv_plate");
      if (plateOnly) return { plate: plateOnly, vehicle: {} };
      return null;
    } catch {
      return null;
    }
  };

  const savePlateContext = (ctx) => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ctx || null));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ctx || null));
      if (ctx && ctx.plate) {
        localStorage.setItem("hv_plate", ctx.plate);
      }
    } catch {
      return;
    }
  };

  const dispatchPlateEvent = (ctx) => {
    const detail = ctx || null;
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail }));
    if (detail && detail.plate) {
      window.dispatchEvent(new CustomEvent("vehicle:changed", { detail }));
    } else {
      window.dispatchEvent(new CustomEvent("vehicle:cleared", { detail }));
    }
  };

  const clearPlateContext = () => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem("hv_plate");
    } catch {
      return;
    }
    renderPlatePill(null);
    dispatchPlateEvent(null);
  };

  const buildVehicleSummary = (ctx) => {
    if (!ctx || !ctx.plate) return "";
    if (!ctx.vehicle) return `${ctx.plate}`;
    const make = ctx.vehicle.make || "";
    const model = ctx.vehicle.modelLabel || ctx.vehicle.model || "";
    const rangeLabel =
      ctx.vehicle.rangeLabel ||
      ctx.yearRange?.label ||
      formatRangeLabel(getContextRange(ctx)) ||
      "";
    return [ctx.plate, [make, model].filter(Boolean).join(" "), rangeLabel]
      .filter(Boolean)
      .join(" ");
  };

  const renderPlatePill = (ctx) => {
    const pill = ensurePlatePill(true);
    const input =
      document.getElementById("plateInput") ||
      document.querySelector(".plate-input");
    if (!pill) return;
    const row = pill.closest("[data-plate-pill-row]");
    const plateValueEl = pill.querySelector("[data-plate-pill-plate]");
    const makeEl = pill.querySelector("[data-plate-pill-make]");
    const modelEl = pill.querySelector("[data-plate-pill-model]");
    const yearEl = pill.querySelector("[data-plate-pill-year]");
    let note =
      pill.querySelector("[data-plate-pill-note]") ||
      pill.querySelector(".plate-year-note");
    if (!note) {
      note = document.createElement("div");
      note.className = "kt-note plate-year-note";
      note.setAttribute("data-plate-pill-note", "1");
      const right = pill.querySelector(".kt-right");
      if (right) right.appendChild(note);
      else pill.appendChild(note);
    }
    const setChip = (el, value) => {
      if (!el) return;
      const text = value ? String(value).trim() : "";
      el.textContent = text;
      el.hidden = !text;
    };
    if (!ctx || !ctx.plate) {
      pill.hidden = true;
      if (row) row.hidden = true;
      if (plateValueEl) plateValueEl.textContent = "";
      setChip(makeEl, "");
      setChip(modelEl, "");
      setChip(yearEl, "");
      note.textContent = "";
      note.hidden = true;
      return;
    }
    pill.hidden = false;
    if (row) row.hidden = false;
    if (plateValueEl) {
      plateValueEl.textContent = ctx.plate || ctx.plateMasked || "";
    }
    const make = ctx?.vehicle?.make || "";
    const model = ctx?.vehicle?.modelLabel || ctx?.vehicle?.model || "";
    const yearLabel =
      ctx?.vehicle?.rangeLabel ||
      ctx?.yearRange?.label ||
      formatRangeLabel(getContextRange(ctx)) ||
      "";
    setChip(makeEl, make);
    setChip(modelEl, model);
    setChip(yearEl, yearLabel);
    const yMin = ctx?.vehicle?.yearMin ?? ctx?.vehicle?.estimatedYearMin;
    const yMax = ctx?.vehicle?.yearMax ?? ctx?.vehicle?.estimatedYearMax;
    const basisRaw = ctx?.vehicle?.yearSource || ctx?.vehicle?.estimatedYearFrom;
    const basis =
      basisRaw === "eerste_toelating"
        ? "eerste toelating"
        : basisRaw === "rdw"
          ? "RDW"
          : "indicatie";
    if (yMin != null || yMax != null) {
      const minTxt = yMin != null ? String(yMin) : "";
      const maxTxt = yMax != null ? String(yMax) : "";
      const dash = minTxt && maxTxt ? " - " : "";
      note.textContent = `Bouwjaar-inschatting: ${minTxt}${dash}${maxTxt} (op basis van ${basis})`;
      note.hidden = false;
    } else {
      note.textContent = "";
      note.hidden = true;
    }
    if (input && !input.value) {
      input.value = ctx.plate;
    }
  };

  const buildPlatePillMarkup = () => `
    <div class="platepill kt-summary" data-plate-pill hidden>
      <div class="kt-left">
        <div class="kt-label">Kenteken:</div>
        <div class="kt-value" data-plate-pill-plate></div>
        <div class="kt-lines">
          <span class="kt-chip" data-plate-pill-make hidden></span>
          <span class="kt-chip" data-plate-pill-model hidden></span>
          <span class="kt-chip" data-plate-pill-year hidden></span>
        </div>
      </div>
      <div class="kt-right">
        <button type="button" class="platepill__clear" data-plate-clear>Annuleer</button>
        <div class="kt-note plate-year-note" data-plate-pill-note hidden></div>
      </div>
    </div>
  `;

  const ensurePlatePillRow = (allowFallback = false) => {
    let row = document.querySelector("[data-plate-pill-row]");
    const crumbs =
      document.querySelector(".site-breadcrumbs") ||
      document.querySelector(".crumbs") ||
      document.querySelector(".breadcrumbs");
    if (row) {
      if (crumbs && row.previousElementSibling !== crumbs) {
        crumbs.insertAdjacentElement("afterend", row);
      }
      return row;
    }
    if (crumbs) {
      row = document.createElement("div");
      row.className = "platepill-row";
      row.setAttribute("data-plate-pill-row", "1");
      row.hidden = true;
      row.innerHTML = `<div class="wrap">${buildPlatePillMarkup()}</div>`;
      crumbs.insertAdjacentElement("afterend", row);
      return row;
    }
    if (!allowFallback) return null;
    const header =
      document.querySelector(".site-header") ||
      document.querySelector(".hv2-header") ||
      document.getElementById("site-header");
    if (!header) return null;
    row = document.createElement("div");
    row.className = "platepill-row";
    row.setAttribute("data-plate-pill-row", "1");
    row.hidden = true;
    row.innerHTML = `<div class="wrap">${buildPlatePillMarkup()}</div>`;
    header.insertAdjacentElement("afterend", row);
    return row;
  };

  const ensurePlatePill = (allowFallback = false) => {
    const existing = document.querySelector("[data-plate-pill]");
    if (existing) return existing;
    const row = ensurePlatePillRow(allowFallback);
    if (!row) return null;
    return row.querySelector("[data-plate-pill]");
  };

  const initPlatePill = () => {
    const attempts = initPlatePill._attempts || 0;
    const pill = ensurePlatePill(attempts >= 4);
    if (!pill) {
      initPlatePill._attempts = attempts + 1;
      if (initPlatePill._attempts < 7) {
        setTimeout(initPlatePill, 300);
      }
      return;
    }
    initPlatePill._attempts = 0;
    const clearBtn = pill.querySelector("[data-plate-clear]");
    if (clearBtn && clearBtn.dataset.plateClearBound !== "1") {
      clearBtn.dataset.plateClearBound = "1";
      clearBtn.addEventListener("click", () => {
        clearPlateContext();
        window.location.href = stripStateSegments(window.location.pathname);
      });
    }
    const ctx = loadPlateContext();
    if (ctx) renderPlatePill(ctx);
  };

  const buildPlateBarMarkup = () => `
    <div class="plate-search">
      <div class="plate-ui">
        <div class="plate-eu">NL</div>

        <input
          class="plate-input"
          type="text"
          id="plateInput"
          name="plate"
          placeholder="5VLL95"
          autocomplete="off"
          inputmode="latin"
        />
        <button class="plate-button" type="button" id="plateSearchBtn">Zoek</button>
      </div>
    </div>
  `;

  const ensurePlateBar = () => {
    let bar = document.querySelector(".plate-search");
    if (bar) return bar;
    const target =
      document.querySelector(".hv2-cta") ||
      document.querySelector(".nav-shell") ||
      document.querySelector(".hv2-header") ||
      document.querySelector(".site-header");
    if (!target) return null;

    const wrapper = document.createElement("div");
    wrapper.innerHTML = buildPlateBarMarkup();
    bar = wrapper.firstElementChild;
    if (!bar) return null;
    if (target.classList.contains("nav-shell")) {
      target.appendChild(bar);
      return bar;
    }
    if (target.classList.contains("hv2-cta")) {
      target.insertAdjacentElement("afterbegin", bar);
    } else {
      target.appendChild(bar);
    }
    return bar;
  };

  const initPlateBar = () => {
    const bar = ensurePlateBar();
    if (!bar) {
      initPlateBar._attempts = (initPlateBar._attempts || 0) + 1;
      if (initPlateBar._attempts < 6) {
        setTimeout(initPlateBar, 300);
      }
      return;
    }
    const input =
      bar.querySelector("#plateInput") || bar.querySelector(".plate-input");
    const button =
      bar.querySelector("#plateSearchBtn") || bar.querySelector(".plate-button");
    const statusEl = ensurePlateStatus(bar);

    const resetBar = () => {
      if (input) input.value = "";
      if (input) input.focus();
      setPlateBarState(bar, statusEl, "idle", "");
    };

    const submitPlate = () => {
      const normalized = normalizePlate(input ? input.value : "");
      if (input) input.value = sanitizePlateInput(input.value);
      if (!normalized || normalized.length < 6) {
        setPlateBarState(bar, statusEl, "error", "Voer een geldig kenteken in.", {
          actionLabel: "Reset",
          onAction: resetBar,
        });
        if (input) input.focus();
        return;
      }
      console.info("plate:parsed", { plate: normalized, source: "header" });
      setPlateBarState(bar, statusEl, "loading", "Bezig met zoeken...");
      const path = String(window.location.pathname || "").toLowerCase();
      const intentType = path.startsWith("/hulpveren/")
        ? "hulpveren"
        : path.startsWith("/luchtvering/")
          ? "luchtvering"
          : path.startsWith("/verlagingsveren/")
            ? "verlagingsveren"
            : "";
<<<<<<< HEAD
      const prevCtx = loadPlateContext() || window.hv_plate_context || {};
      const prevPlate = normalizePlate(prevCtx?.plate || "");
      const hasVehicle =
        prevCtx &&
        prevCtx.vehicle &&
        (prevCtx.vehicle.make ||
          prevCtx.vehicle.model ||
          prevCtx.vehicle.modelLabel ||
          prevCtx.vehicle.makeSlug ||
          prevCtx.vehicle.modelSlug);
      const hasManualSelection =
        /^\/(hulpveren|luchtvering|verlagingsveren)\/[^\/]+\/[^\/]+\/?$/i.test(path) &&
        !/\/kt_[a-z0-9]+\/?$/i.test(path);
      const hasPlateInUrl = /\/kt_[a-z0-9]+\/?$/i.test(path);
      const shouldForceRedirect =
        (hasVehicle || hasManualSelection || hasPlateInUrl || prevPlate) &&
        (!prevPlate || prevPlate !== normalized);
=======
      const parts = String(window.location.pathname || "")
        .split("/")
        .filter(Boolean);
      const family = parts[0] || "";
      const isPlateSegment = (value) => /^kt_[a-z0-9]+$/i.test(String(value || ""));
      const makePart = parts[1] && !isPlateSegment(parts[1]) ? parts[1] : "";
      const modelPart = parts[2] && !isPlateSegment(parts[2]) ? parts[2] : "";
      const route =
        family === "hulpveren" ||
        family === "luchtvering" ||
        family === "verlagingsveren"
          ? {
              makeSlug: slugify(makePart),
              modelSlug: slugify(modelPart),
            }
          : null;
>>>>>>> cf9fe37d9acd492fa6fd67ac7b79734b2444c11b
      const ctx = {
        plate: normalized,
        vehicle: {},
        range: null,
        yearRange: null,
        intentType,
        route,
        updatedAt: Date.now(),
      };
      window.hv_plate_context = ctx;
      savePlateContext(ctx);
      renderPlatePill(ctx);
      dispatchPlateEvent(ctx);
      if (typeof window.openPlateGroupOverlay === "function" && !shouldForceRedirect) {
        window.__hvPlateOverlayPrevCtx = prevCtx;
        setPlateBarState(bar, statusEl, "success", "Kies productgroep.");
        window.openPlateGroupOverlay(normalized);
        return;
      }
      const encoded = encodeURIComponent(normalized);
      const targetBase = PLATE_PATH.endsWith("/") ? PLATE_PATH : `${PLATE_PATH}/`;
      const target = intentType
        ? `${targetBase}?kt=${encoded}&type=${encodeURIComponent(intentType)}`
        : `${targetBase}?kt=${encoded}`;
      setPlateBarState(bar, statusEl, "success", "Kenteken gevonden. Doorsturen...");
      console.info("plate:redirect", { plate: normalized, target, source: "header" });
      window.location.href = target;
    };

    if (button && button.dataset.plateBound !== "1") {
      button.dataset.plateBound = "1";
      button.addEventListener("click", submitPlate);
    }

    if (input && input.dataset.plateBound !== "1") {
      input.dataset.plateBound = "1";
      input.addEventListener("input", () => {
        const cleaned = sanitizePlateInput(input.value);
        if (cleaned !== input.value) input.value = cleaned;
      });
      input.addEventListener("blur", () => {
        input.value = sanitizePlateInput(input.value);
      });
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          submitPlate();
        }
      });
    }

    setPlateBarState(bar, statusEl, "idle", "");
  };

  function getContextRange(ctx) {
    if (!ctx || !ctx.range) return null;
    const generation = detectCaddyGeneration(ctx.vehicle);
    return clampGeneration(ctx.range, generation);
  }

  const ensurePlateChip = (container, ctx) => {
    if (!container) return null;
    const existing = container.previousElementSibling;
    if (existing && existing.matches("[data-plate-chip]")) return existing;
    const chip = document.createElement("div");
    chip.className = "plate-filter-chip";
    chip.setAttribute("data-plate-chip", "1");
    const text = buildVehicleSummary(ctx);
    chip.innerHTML = `
      <span class="plate-filter-chip__text">Gefilterd op kenteken: ${text}</span>
      <button type="button" class="plate-filter-chip__clear" aria-label="Wis kenteken">Wis</button>
    `;
    chip.querySelector("button").addEventListener("click", () => clearPlateContext());
    container.insertAdjacentElement("beforebegin", chip);
    return chip;
  };

  const restoreSetOrder = (container) => {
    const cards = Array.from(container.children);
    cards.sort((a, b) => {
      const ai = Number.parseInt(a.dataset.plateIndex || "0", 10);
      const bi = Number.parseInt(b.dataset.plateIndex || "0", 10);
      return ai - bi;
    });
    cards.forEach((card) => container.appendChild(card));
  };

  const applyPlateToSetLists = (ctx) => {
    const lists = document.querySelectorAll("[data-set-list]");
    lists.forEach((list) => {
      const cards = Array.from(list.children);
      cards.forEach((card, idx) => {
        if (!card.dataset.plateIndex) {
          card.dataset.plateIndex = String(idx);
        }
      });
      const prevChip = list.previousElementSibling;
      if (prevChip && prevChip.matches("[data-plate-chip]")) {
        prevChip.remove();
      }

      if (!ctx || !ctx.plate) {
        restoreSetOrder(list);
        cards.forEach((card) => {
          delete card.dataset.plateMatch;
          card.classList.remove("is-plate-match", "is-plate-miss");
        });
        return;
      }

      const vehicleRange = getContextRange(ctx);
      ensurePlateChip(list, ctx);

      const scored = cards.map((card) => {
        const rangeText = card.getAttribute("data-fitment-range") || "";
        const setRange = parseRange(rangeText);
        let match = null;
        if (vehicleRange && setRange) {
          match = rangesOverlap(vehicleRange, setRange);
        }
        return { card, match };
      });

      scored.sort((a, b) => {
        const score = (entry) =>
          entry.match === true ? 0 : entry.match == null ? 1 : 2;
        const diff = score(a) - score(b);
        if (diff !== 0) return diff;
        const ai = Number.parseInt(a.card.dataset.plateIndex || "0", 10);
        const bi = Number.parseInt(b.card.dataset.plateIndex || "0", 10);
        return ai - bi;
      });

      scored.forEach(({ card, match }) => {
        if (match === true) {
          card.dataset.plateMatch = "1";
          card.classList.add("is-plate-match");
          card.classList.remove("is-plate-miss");
        } else if (match === false) {
          card.dataset.plateMatch = "0";
          card.classList.add("is-plate-miss");
          card.classList.remove("is-plate-match");
        } else {
          delete card.dataset.plateMatch;
          card.classList.remove("is-plate-match", "is-plate-miss");
        }
        list.appendChild(card);
      });
    });
  };

  const findProductFitmentText = (ctx) => {
    const headings = Array.from(document.querySelectorAll("h2"));
    const pastOpHeading = headings.find((h) =>
      /past\s+op/i.test(h.textContent || "")
    );
    if (!pastOpHeading) return null;
    const section = pastOpHeading.closest("section") || pastOpHeading.parentElement;
    if (!section) return null;
    const items = Array.from(section.querySelectorAll("li"));
    if (!items.length) return null;
    if (ctx && ctx.vehicle) {
      const make = slugify(ctx.vehicle.make || "");
      const model = slugify(ctx.vehicle.model || ctx.vehicle.modelLabel || "");
      const match = items.find((item) => {
        const text = slugify(item.textContent || "");
        if (make && !text.includes(make)) return false;
        if (model && !text.includes(model)) return false;
        return true;
      });
      if (match) return match.textContent || "";
    }
    return items[0].textContent || "";
  };

  const ensureFitmentStatusTarget = () => {
    const existing = document.querySelector("[data-fitment-status]");
    if (existing) return existing;
    const hero = document.querySelector(".product-hero");
    const body = hero ? hero.querySelector(".body") : null;
    if (!body) return null;
    const target = document.createElement("div");
    target.setAttribute("data-fitment-status", "1");
    target.className = "fitment-status";
    const sku = body.querySelector(".sku");
    if (sku && sku.nextSibling) {
      sku.parentElement.insertBefore(target, sku.nextSibling);
    } else {
      body.insertAdjacentElement("afterbegin", target);
    }
    return target;
  };

  const applyPlateToProduct = (ctx) => {
    const target = ensureFitmentStatusTarget();
    if (!target) return;
    if (!ctx || !ctx.plate) {
      target.textContent = "";
      target.className = "fitment-status";
      return;
    }

    const fitmentText = findProductFitmentText(ctx);
    const vehicleRange = getContextRange(ctx);
    const fitmentRange = parseRange(fitmentText || "");
    let status = "warn";
    let label = "Controleer bouwjaar";

    if (vehicleRange && fitmentRange) {
      if (rangesOverlap(vehicleRange, fitmentRange)) {
        status = "ok";
        label = "Past op jouw voertuig";
      } else {
        status = "bad";
        label = "Past waarschijnlijk niet";
      }
    }

    target.className = `fitment-status fitment-status--${status}`;
    target.innerHTML = `
      <span class="fitment-status__label">${label}</span>
      <a class="btn btn-ghost" href="${PLATE_PATH}${ctx.plate}">Bekijk passende sets</a>
    `; 
  };

  const applyPlateToContent = (ctx) => {
  return; // bovenste kenteken/voertuig-weergave vervangt deze onderste CTA-balk

    const main = document.querySelector("main");
    if (!main) return;
    const existing = main.querySelector(".plate-cta");
    if (!ctx || !ctx.plate) {
      if (existing) existing.remove();
      return;
    }
    if (existing) return;
    if (document.querySelector("[data-set-list]")) return;
    if (document.querySelector(".product-hero")) return;

    const block = document.createElement("div");
    block.className = "plate-cta card";
    const text = buildVehicleSummary(ctx);
    block.innerHTML = `
      <div class="body">
        <div class="eyebrow">Voor jouw voertuig</div>
        <p>${text ? text : "Kenteken actief"}</p>
        <a class="btn" href="${PLATE_PATH}?kt=${encodeURIComponent(ctx.plate)}">Kies productgroep</a>
      </div>
    `;
    const firstWrap = main.querySelector(".wrap") || main.firstElementChild;
    if (firstWrap && firstWrap.parentElement) {
      firstWrap.parentElement.insertBefore(block, firstWrap);
    } else {
      main.insertAdjacentElement("afterbegin", block);
    }
  };

  const applyPlateContext = (ctx) => {
    applyPlateToSetLists(ctx);
    applyPlateToProduct(ctx);
    applyPlateToContent(ctx);
  };

  function setVehicleYearRange(ctx, yearMin, yearMax, source) {
    if (!ctx) return;
    ctx.vehicle = ctx.vehicle || {};
    ctx.vehicle.yearMin = yearMin ? Number(yearMin) : ctx.vehicle.yearMin;
    ctx.vehicle.yearMax = yearMax ? Number(yearMax) : ctx.vehicle.yearMax;
    ctx.vehicle.yearSource = source || ctx.vehicle.yearSource;
    ctx.vehicle.yearUpdatedAt = Date.now();

    if (ctx.vehicle.yearMin && ctx.vehicle.yearMax) {
      ctx.vehicle.rangeLabel = `${ctx.vehicle.yearMin} — ${ctx.vehicle.yearMax}`;
    } else if (ctx.vehicle.yearMin) {
      ctx.vehicle.rangeLabel = `${ctx.vehicle.yearMin} —`;
    }

    if (ctx.vehicle.yearMin || ctx.vehicle.yearMax) {
      window.dispatchEvent(
        new CustomEvent("hv:vehicleYearRange", {
          detail: {
            yearMin: ctx.vehicle.yearMin,
            yearMax: ctx.vehicle.yearMax,
            source: ctx.vehicle.yearSource || "unknown",
            plate: ctx.plate || null,
          },
        })
      );
    }
  }

  const setPlateContextFromVehicle = (plate, vehicle, options = {}) => {
    const normalized = normalizePlate(plate);
    if (!normalized) return null;
    const previous = loadPlateContext();
    const intentType = options.intentType || (previous && previous.intentType) || "";
    let route = options.route || (previous && previous.route) || null;
    let yearRange = options.yearRange || null;

    // ✅ Klein voertuigobject voor UI, plus raw bewaren
    const vSmall = {
      make: vehicle?.make || vehicle?.makename || "",
      model: vehicle?.model || vehicle?.modelname || "",
      modelLabel: vehicle?.modelLabel || vehicle?.model || vehicle?.modelname || "",
      rangeLabel:
        vehicle?.rangeLabel ||
        vehicle?.uitvoering ||
        vehicle?.trim ||
        vehicle?.typeLabel ||
        vehicle?.typename ||
        vehicle?.type ||
        "",
      yearMin: vehicle?.yearMin || vehicle?.estimatedYearMin || null,
      yearMax: vehicle?.yearMax || vehicle?.estimatedYearMax || null,
      yearSource: vehicle?.yearSource || vehicle?.estimatedYearFrom || null,
      baseSource: vehicle?.baseSource || vehicle?.base_source || vehicle?.source || "aldoc",
      baseUpdatedAt: vehicle?.baseUpdatedAt || Date.now(),
    };

    vSmall.make = String(vSmall.make || "");
    vSmall.model = String(vSmall.model || "");
    vSmall.modelLabel = String(vSmall.modelLabel || "");
    vSmall.rangeLabel = String(vSmall.rangeLabel || "");
    vSmall.makeSlug = slugify(vSmall.make);
    vSmall.modelSlug = slugify(vSmall.model || vSmall.modelLabel);

    if ((!vSmall.yearMin || !vSmall.yearMax) && vSmall.rangeLabel) {
      const years = String(vSmall.rangeLabel).match(/\b(19\d{2}|20\d{2})\b/g);
      if (years && years.length) {
        const y1 = Number(years[0]);
        const y2 = Number(years[1] || years[0]);
        vSmall.yearMin = Math.min(y1, y2);
        vSmall.yearMax = Math.max(y1, y2);
        vSmall.yearSource = vSmall.yearSource || "aldoc_uitvoering";
      }
    }

    const uiVehicle = toUiVehicleFromCandidate(vehicle);
    if (uiVehicle && !uiVehicle.plate) {
      uiVehicle.plate = normalized;
    }

    const existingCtx =
      window.hv_plate_context ||
      loadPlateContext() || { plate: "", vehicle: {}, vehicleRaw: null };
    let vehicleRaw =
      (options && options.vehicleRaw) ||
      vehicle ||
      existingCtx.vehicleRaw ||
      previous?.vehicleRaw ||
      null;

    if (!yearRange && (vSmall.yearMin != null || vSmall.yearMax != null)) {
      const from = vSmall.yearMin ?? vSmall.yearMax;
      const to = vSmall.yearMax ?? vSmall.yearMin;
      let label = "";
      if (from != null && to != null) {
        label = from === to ? String(from) : `${from}-${to}`;
      } else if (from != null) {
        label = `${from}-nu`;
      } else if (to != null) {
        label = `tot ${to}`;
      }
      yearRange = {
        from,
        to,
        label,
        source: vSmall.yearSource || "plate",
      };
    }

    const range =
      options.range ||
      parseRange(yearRange) ||
      parseRange(vehicle?.modelRangeText || vehicle?.modelRange || null) ||
      null;
    const mergedVehicle = uiVehicle ? { ...uiVehicle, ...vSmall } : vSmall;
    const ctx = {
      plate: normalized,
      vehicle: mergedVehicle,
      vehicleRaw,
      range,
      yearRange,
      intentType,
      route,
      updatedAt: Date.now(),
    };
    if (!route) {
      ctx.route = {
        makeSlug: vSmall.makeSlug || undefined,
        modelSlug: vSmall.modelSlug || undefined,
      };
    } else {
      if (!route.makeSlug) route.makeSlug = vSmall.makeSlug || route.makeSlug;
      if (!route.modelSlug) route.modelSlug = vSmall.modelSlug || route.modelSlug;
      ctx.route = route;
    }
    if (yearRange && (yearRange.from != null || yearRange.to != null)) {
      setVehicleYearRange(ctx, yearRange.from, yearRange.to, yearRange.source);
    }

    window.hv_plate_context = ctx;
    savePlateContext(ctx);
    renderPlatePill(ctx);
    dispatchPlateEvent(ctx);
    return ctx;
  };

  // Backwards compat: some code calls setPlateContextFromPlate
  function setPlateContextFromPlate(plate, vehicle) {
    return setPlateContextFromVehicle(plate, vehicle);
  }

  const init = () => {
    initPlateBar();
    initPlatePill();
    const ctx = loadPlateContext();
    if (ctx) {
      renderPlatePill(ctx);
      dispatchPlateEvent(ctx);
      applyPlateContext(ctx);
    }
    const handleEvent = (detail) => {
      renderPlatePill(detail);
      applyPlateContext(detail);
    };
    window.addEventListener(EVENT_NAME, (evt) => handleEvent(evt.detail));
    window.addEventListener("vehicle:changed", (evt) => handleEvent(evt.detail));
    window.addEventListener("vehicle:cleared", () => handleEvent(null));
  };

  window.HVPlateContext = {
    normalizePlate,
    loadPlateContext,
    getPlateContext: loadPlateContext,
    savePlateContext,
    clearPlateContext,
    setPlateContextFromVehicle,
    setPlateContextFromPlate,
    applyPlateContext,
    setBaseFromAldoc,
    setYearFromRdw,
    initPlateBar,
    initPlatePill,
    init,
  };

  // Backward-compatible globals for legacy callers
  if (typeof window.setPlateContextFromPlate === "undefined") {
    window.setPlateContextFromPlate = setPlateContextFromPlate;
  }
  if (typeof window.setPlateContextFromVehicle === "undefined") {
    window.setPlateContextFromVehicle = setPlateContextFromVehicle;
  }
  // Ensure the global context exists (many parts of the site expect this)
  if (typeof window.hv_plate_context === "undefined") {
    window.hv_plate_context = loadPlateContext() || { plate: "", vehicle: {} };
  }

  // Hydrate from URL: /.../<PLATE>/kt_xxx or variants
  (function hydrateFromUrl() {
    const { plate, kt } = readPlateKtFromUrl();
    const existing = loadPlateContext() || { plate: "", vehicle: {} };
    window.hv_plate_context = existing;
    if (plate) {
      existing.plate = plate;
      try {
        localStorage.setItem("hv_plate", plate);
      } catch (_) {}
    }
    if (kt) {
      existing.vehicle = existing.vehicle || {};
      existing.vehicle.kt = kt;
    }
    savePlateContext(existing);
    if (plate && typeof window.setPlateContextFromPlate === "function") {
      window.setPlateContextFromPlate(plate);
    }
  })();

  // Ensure global plate context exists (filters/UI expect this)
  window.hv_plate_context = window.hv_plate_context || {
    plate: "",
    vehicle: {},
  };

  // If your internal context object exists, expose it.
  try {
    if (typeof HVPlateContext !== "undefined") {
      window.hv_plate_context = HVPlateContext;
    }
  } catch (_) {}
})();
