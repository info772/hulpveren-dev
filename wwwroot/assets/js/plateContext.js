// /assets/js/plateContext.js
(() => {
  "use strict";

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

  const sanitizePlateInput = (value) => {
    const raw = String(value || "").toUpperCase();
    const cleaned = raw.replace(/[^A-Z0-9-]+/g, "").replace(/-+/g, "-");
    return cleaned.replace(/^-+/, "").replace(/-+$/, "");
  };

  const slugify = (value) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

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
      return safeJsonParse(sessionStorage.getItem(STORAGE_KEY));
    } catch {
      return null;
    }
  };

  const savePlateContext = (ctx) => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ctx || null));
    } catch {
      return;
    }
  };

  const dispatchPlateEvent = (ctx) => {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: ctx || null }));
  };

  const clearPlateContext = () => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      return;
    }
    renderPlatePill(null);
    dispatchPlateEvent(null);
  };

  const buildVehicleSummary = (ctx) => {
    if (!ctx || !ctx.plate) return "";
    if (!ctx.vehicle) return `${ctx.plate} kenteken actief`;
    const make = ctx.vehicle.make || "";
    const model = ctx.vehicle.modelLabel || ctx.vehicle.model || "";
    const rangeLabel =
      ctx.vehicle.rangeLabel ||
      ctx.yearRange?.label ||
      formatRangeLabel(getContextRange(ctx)) ||
      "";
    const base = [ctx.plate, [make, model].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(" ");
    return rangeLabel ? `${base} (${rangeLabel})` : base;
  };

  const renderPlatePill = (ctx) => {
    const pill = ensurePlatePill(true);
    const input = document.querySelector("[data-plate-input]");
    if (!pill) return;
    const row = pill.closest("[data-plate-pill-row]");
    const pillText = pill.querySelector("[data-plate-pill-text]");
    if (!ctx || !ctx.plate) {
      pill.hidden = true;
      if (row) row.hidden = true;
      if (pillText) pillText.textContent = "";
      return;
    }
    pill.hidden = false;
    if (row) row.hidden = false;
    if (pillText) pillText.textContent = buildVehicleSummary(ctx);
    if (input && !input.value) {
      input.value = ctx.plate;
    }
  };

  const buildPlatePillMarkup = () => `
    <div class="platepill" data-plate-pill hidden>
      <span data-plate-pill-text></span>
      <button type="button" class="platepill__clear" data-plate-clear aria-label="Wis kenteken">x</button>
    </div>
  `;

  const ensurePlatePillRow = (allowFallback = false) => {
    let row = document.querySelector("[data-plate-pill-row]");
    if (row) return row;
    const crumbs = document.querySelector(".site-breadcrumbs");
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
      });
    }
    const ctx = loadPlateContext();
    if (ctx) renderPlatePill(ctx);
  };

  const buildPlateBarMarkup = () => `
    <div class="nlplate">
      <span class="nlplate__eu" aria-hidden="true">
        <span class="nlplate__nl">NL</span>
      </span>
      <form class="nlplate__form" data-plate-form role="search" aria-label="Kenteken zoeken">
        <input class="nlplate__input" name="plate" inputmode="text" autocomplete="off"
               placeholder="5VLL95" aria-label="Kenteken" data-plate-input />
        <button class="nlplate__btn" type="submit" aria-label="Zoeken">
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path fill="currentColor" d="M13.6 12.2a6 6 0 1 0-1.4 1.4l3.6 3.6a1 1 0 0 0 1.4-1.4l-3.6-3.6ZM4 8a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z"/>
          </svg>
        </button>
      </form>
    </div>
  `;

  const ensurePlateBar = () => {
    let bar = document.querySelector("[data-platebar]");
    if (bar) return bar;
    const target =
      document.querySelector(".hv2-cta") ||
      document.querySelector(".nav-shell") ||
      document.querySelector(".hv2-header") ||
      document.querySelector(".site-header");
    if (!target) return null;

    bar = document.createElement("div");
    bar.className = "platebar";
    bar.setAttribute("data-platebar", "1");
    bar.innerHTML = buildPlateBarMarkup();
    if (target.classList.contains("nav-shell")) {
      bar.classList.add("nav-cta");
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
    const form = bar.querySelector("[data-plate-form]");
    const input = bar.querySelector("[data-plate-input]");

    if (input) {
      input.addEventListener("input", () => {
        const cleaned = sanitizePlateInput(input.value);
        if (cleaned !== input.value) input.value = cleaned;
      });
      input.addEventListener("blur", () => {
        input.value = sanitizePlateInput(input.value);
      });
    }

    if (form) {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const normalized = normalizePlate(input ? input.value : "");
        if (input) input.value = sanitizePlateInput(input.value);
        if (!normalized || normalized.length < 6) {
          if (input) input.focus();
          return;
        }
        const ctx = {
          plate: normalized,
          vehicle: null,
          range: null,
          yearRange: null,
          updatedAt: Date.now(),
        };
        savePlateContext(ctx);
        renderPlatePill(ctx);
        dispatchPlateEvent(ctx);
        window.location.href = `${PLATE_PATH}${normalized}`;
      });
    }
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
        <a class="btn" href="${PLATE_PATH}${ctx.plate}">Bekijk passende sets</a>
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

  const setPlateContextFromVehicle = (plate, vehicle, options = {}) => {
    const normalized = normalizePlate(plate);
    if (!normalized) return null;
    const yearRange = options.yearRange || null;
    const range =
      options.range ||
      parseRange(yearRange) ||
      parseRange(vehicle?.modelRangeText || vehicle?.modelRange || null) ||
      null;
    const vehicleBasic = vehicle
      ? {
          make: vehicle.make || vehicle.makename || "",
          model: vehicle.model || vehicle.modelname || "",
          modelLabel:
            vehicle.modelLabel ||
            vehicle.modelRemark ||
            vehicle.model_remark ||
            "",
          rangeLabel: yearRange?.label || vehicle?.modelRangeText || "",
        }
      : null;
    const ctx = {
      plate: normalized,
      vehicle: vehicleBasic,
      range,
      yearRange,
      updatedAt: Date.now(),
    };
    savePlateContext(ctx);
    renderPlatePill(ctx);
    dispatchPlateEvent(ctx);
    return ctx;
  };

  const init = () => {
    initPlateBar();
    initPlatePill();
    const ctx = loadPlateContext();
    if (ctx) {
      renderPlatePill(ctx);
      dispatchPlateEvent(ctx);
      applyPlateContext(ctx);
    }
    window.addEventListener(EVENT_NAME, (evt) => {
      renderPlatePill(evt.detail);
      applyPlateContext(evt.detail);
    });
  };

  window.HVPlateContext = {
    normalizePlate,
    loadPlateContext,
    getPlateContext: loadPlateContext,
    savePlateContext,
    clearPlateContext,
    setPlateContextFromVehicle,
    initPlateBar,
    initPlatePill,
    init,
  };
})();
