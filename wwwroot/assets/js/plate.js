(function () {
  /* Fix Summary:
   * Broken: /kenteken/?kt= did not auto-load a plate lookup and could hang without timeout.
   * Change: Added URL auto-init, HVPlateContext sync, and timeout-based lookup with clear states.
   * Test: Open /kenteken/?kt=13GTRG and confirm auto lookup + tiles render.
   */

  const MENU_CACHE_KEY = "hv_menu_cache";
  const MENU_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
  const MAPPING_CACHE_KEY = "hv_menu_mapping";
  const MAPPING_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
  const MAPPING_URL = "/config/menuMapping.json";
  const PLATE_API_BASE = (window.HV_PLATE_API_BASE || "/api/plate").replace(
    /\/+$/,
    ""
  );
  const PLATE_TIMEOUT_MS = 10000;

  function normalizePlate(value) {
    return String(value || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  }

  function isValidPlate(value) {
    return value.length >= 6;
  }

  function slugify(value) {
    return String(value || "")
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/#/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function extractYear(value) {
    if (!value) return null;
    const s = String(value);
    const m = s.match(/\b(19\d{2}|20\d{2})\b/);
    if (!m) return null;
    return Number(m[1]);
  }

  function getEstimatedYear(candidate) {
    if (!candidate) return { year: null, source: null };
    const year =
      extractYear(
        candidate.firstAdmissionDate ||
          candidate.dateFirstAdmission ||
          candidate.eersteToelating
      ) ||
      extractYear(
        candidate.buildYear || candidate.bouwjaar || candidate.year
      ) ||
      extractYear(
        candidate.registrationDate || candidate.datumEersteToelating
      );

    const source =
      year &&
      (candidate.firstAdmissionDate ||
        candidate.dateFirstAdmission ||
        candidate.eersteToelating)
        ? "eerste_toelating"
        : year
        ? "bouwjaar"
        : null;

    return { year: year || null, source };
  }

  function computeMakeModelSlug(vehicle) {
    if (!vehicle) return { make: "", model: "" };
    const make = slugify(vehicle.make || vehicle.makename || "");
    let baseModel = (vehicle.modelname || vehicle.model || "").toString().trim();
    const extra = (vehicle.typename || vehicle.type || vehicle.type_remark || "")
      .toString()
      .trim();
    if (baseModel && extra) {
      const b = baseModel.toLowerCase();
      const e = extra.toLowerCase();
      if (!b.includes(e) && extra.length <= 18) {
        baseModel = `${baseModel} ${extra}`;
      }
    }
    const modelKey = baseModel || extra;
    const model = slugify(modelKey);
    return { make, model };
  }

  function parseAldocRangeFromText(text) {
    const s = String(text || "");
    const m = s.match(/\(([^)]*)\)/);
    const inside = m ? m[1] : s;
    const years = inside.match(/\b(19\d{2}|20\d{2})\b/g);
    if (!years || !years.length) return null;
    const y1 = Number(years[0]);
    const y2 = Number(years[1] || years[0]);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    return { minY, maxY, source: "aldoc_uitvoering" };
  }

  async function fetchRdwYear(plate) {
    const res = await fetch(`/api/rdw/${encodeURIComponent(plate)}`, { cache: "no-store" });
    if (!res.ok) throw new Error("rdw_failed");
    const data = await res.json();
    const year = Number(data.year || 0);
    if (!year) throw new Error("rdw_no_year");
    return { year, source: "rdw" };
  }

  function applyYearContext(vehicle, yearMin, yearMax, source) {
    if (!vehicle) return;
    vehicle.yearMin = yearMin;
    vehicle.yearMax = yearMax;
    vehicle.yearSource = source || "indicatief";
    vehicle.yearNote = "Indicatie: kan afwijken";
  }

  function setRouteSlugsFromVehicle() {
    return;
  }


  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[m]));
  }

  function buildStatusActions({ showReset, showManual }) {
    const actions = [];
    if (showReset) {
      actions.push(
        '<button type="button" class="plate-status__reset" data-plate-reset="1">Reset</button>'
      );
    }
    if (showManual) {
      actions.push(
        '<a class="plate-status__link" href="/hulpveren">Hulpveren</a>'
      );
      actions.push(
        '<a class="plate-status__link" href="/luchtvering">Luchtvering</a>'
      );
      actions.push(
        '<a class="plate-status__link" href="/verlagingsveren">Verlagingsveren</a>'
      );
    }
    if (!actions.length) return "";
    return `<div class="plate-status__actions">${actions.join("")}</div>`;
  }

  function setStatus(el, message, isError, options = {}) {
    if (!el) return;
    const state =
      options.state || (isError ? "error" : message ? "success" : "idle");
    el.dataset.state = state;
    el.classList.toggle("is-error", Boolean(isError));
    if (options.actionsHtml) {
      const safeMessage = escapeHtml(message || "");
      el.innerHTML = `<span class="plate-status__text">${safeMessage}</span>${options.actionsHtml}`;
      const resetBtn = el.querySelector("[data-plate-reset]");
      if (resetBtn && typeof options.onReset === "function") {
        resetBtn.addEventListener("click", options.onReset, { once: true });
      }
      return;
    }
    el.textContent = message || "";
  }

  function setLoading(form, isLoading) {
    if (!form) return;
    form.classList.toggle("is-loading", isLoading);
    const button = form.querySelector("button[type='submit']");
    if (button) button.disabled = isLoading;
  }

  function storageSet(key, value) {
    try {
      sessionStorage.setItem(key, value);
    } catch (err) {
      return;
    }
  }

  function storageGet(key) {
    try {
      return sessionStorage.getItem(key);
    } catch (err) {
      return null;
    }
  }

  function storageRemove(key) {
    try {
      sessionStorage.removeItem(key);
    } catch (err) {
      return;
    }
  }

  function storageGetJson(key) {
    const raw = storageGet(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (err) {
      return null;
    }
  }

  function emitEvent(name, detail) {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }

  function extractCandidates(data) {
    if (!data) return [];
    if (Array.isArray(data.vehicleCandidates)) return data.vehicleCandidates;
    if (Array.isArray(data.candidates)) return data.candidates;
    if (data.vehicle && typeof data.vehicle === "object") return [data.vehicle];
    return [];
  }

  function cacheRead(key, ttlMs) {
    const entry = storageGetJson(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      storageRemove(key);
      return null;
    }
    return entry.value;
  }

  function cacheWrite(key, value, ttlMs) {
    const payload = {
      value,
      expiresAt: ttlMs ? Date.now() + ttlMs : null,
    };
    storageSet(key, JSON.stringify(payload));
  }

  async function fetchJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      const error = new Error(`Request failed: ${res.status}`);
      error.status = res.status;
      throw error;
    }
    return res.json();
  }

  async function fetchJsonWithTimeout(url, timeoutMs = PLATE_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { cache: "no-store", signal: controller.signal });
      if (!res.ok) {
        const error = new Error(`Request failed: ${res.status}`);
        error.status = res.status;
        throw error;
      }
      return res.json();
    } catch (err) {
      if (err && err.name === "AbortError") {
        const timeoutErr = new Error("plate_timeout");
        timeoutErr.code = "timeout";
        throw timeoutErr;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  function candidateLabel(candidate) {
    if (!candidate) return "Onbekend";
    const make = candidate.make || candidate.makename || "";
    const model = candidate.model || candidate.modelname || "";
    const type = candidate.type || candidate.typename || "";
    const from = candidate.typeFrom || candidate.type_from || "";
    const till = candidate.typeTill || candidate.type_till || "";
    const years = from || till ? `${from}-${till || ""}` : "";
    return [make, model, type].filter(Boolean).join(" ") + (years ? ` (${years})` : "");
  }

  function saveSelection(plate, vehicle, options = {}) {
    if (
      window.HVPlateContext &&
      typeof window.HVPlateContext.setPlateContextFromVehicle === "function"
    ) {
      window.HVPlateContext.setPlateContextFromVehicle(plate, vehicle, options);
    }
  }

  function persistSelection(plate, vehicle, options = {}) {
    saveSelection(plate, vehicle, options);
  }

  function getSelectedVehicle() {
    const ctx =
      window.HVPlateContext && typeof window.HVPlateContext.getPlateContext === "function"
        ? window.HVPlateContext.getPlateContext()
        : null;
    return ctx && ctx.vehicle ? ctx.vehicle : null;
  }

  function clearSelection() {
    if (
      window.HVPlateContext &&
      typeof window.HVPlateContext.clearPlateContext === "function"
    ) {
      window.HVPlateContext.clearPlateContext();
    }
  }

  async function lookupPlateWithTimeout(plate) {
    const normalized = normalizePlate(plate);
    if (!isValidPlate(normalized)) {
      const err = new Error("invalid_plate");
      err.code = "invalid_plate";
      throw err;
    }
    const url = `${PLATE_API_BASE}/${encodeURIComponent(normalized)}`;
    return fetchJsonWithTimeout(url, PLATE_TIMEOUT_MS);
  }

  async function lookupPlate(plate) {
    return lookupPlateWithTimeout(plate);
  }

  function resolveMake(vehicle) {
    return (vehicle && (vehicle.make || vehicle.makename)) || "";
  }

  const Menu = {
    async loadMenu(options = {}) {
      if (!options.force) {
        const cached = cacheRead(MENU_CACHE_KEY, MENU_CACHE_TTL_MS);
        if (cached) return cached;
      }
      const data = await fetchJson("/api/menu");
      cacheWrite(MENU_CACHE_KEY, data, MENU_CACHE_TTL_MS);
      return data;
    },

    async loadMenuNode(rootId, nodeId, options = {}) {
      const cacheKey = `hv_menu_node_${rootId}_${nodeId}`;
      if (!options.force) {
        const cached = cacheRead(cacheKey, MENU_CACHE_TTL_MS);
        if (cached) return cached;
      }
      const data = await fetchJson(`/api/menuparts/${rootId}/${nodeId}`);
      cacheWrite(cacheKey, data, MENU_CACHE_TTL_MS);
      return data;
    },

    async getMapping(options = {}) {
      if (window.HVPlateMenuMapping && !options.force) {
        return window.HVPlateMenuMapping;
      }
      if (!options.force) {
        const cached = cacheRead(MAPPING_CACHE_KEY, MAPPING_CACHE_TTL_MS);
        if (cached) return cached;
      }
      const mapping = await fetchJson(MAPPING_URL);
      cacheWrite(MAPPING_CACHE_KEY, mapping, MAPPING_CACHE_TTL_MS);
      return mapping;
    },

    getNodeForVehicle(vehicle, mapping) {
      if (!mapping) return null;
      const make = resolveMake(vehicle);
      let makeConfig = null;
      if (make && mapping.byMake) {
        const target = make.toLowerCase();
        const keys = Object.keys(mapping.byMake);
        for (let i = 0; i < keys.length; i += 1) {
          if (keys[i].toLowerCase() === target) {
            makeConfig = mapping.byMake[keys[i]];
            break;
          }
        }
      }
      const rootId =
        (makeConfig && makeConfig.rootId !== undefined ? makeConfig.rootId : null) ??
        mapping.defaultRootId ??
        0;
      const nodeId =
        (makeConfig && makeConfig.nodeId !== undefined ? makeConfig.nodeId : null) ??
        mapping.defaultNodeId ??
        null;
      return { rootId, nodeId };
    },

    async loadRelevantMenuParts(vehicle, options = {}) {
      const mapping = await Menu.getMapping(options);
      const node = Menu.getNodeForVehicle(vehicle, mapping);
      if (!node || node.nodeId === null || node.nodeId === undefined) {
        return null;
      }
      return Menu.loadMenuNode(node.rootId, node.nodeId, options);
    },
  };

  function ensureWidget(container) {
    if (container.querySelector(".hv-plate-form")) return;
    container.innerHTML = [
      '<div class="hv-plate-widget__form">',
      '  <form class="hv-plate-form" autocomplete="off">',
      '    <input class="hv-plate-input" type="text" name="plate" placeholder="28NJN7" />',
      '    <button class="hv-plate-submit" type="submit">Zoek</button>',
      "  </form>",
      '  <div class="hv-plate-status" role="status" aria-live="polite"></div>',
      "</div>",
      '<div class="hv-plate-results"></div>',
    ].join("");
  }

  function renderSelected(container, vehicle) {
    if (!container) return;
    container.innerHTML = "";
    const card = document.createElement("div");
    card.className = "hv-plate-selected";
    card.innerHTML = [
      '<div class="hv-plate-selected__title">Geselecteerd voertuig</div>',
      `<div class="hv-plate-selected__name">${candidateLabel(vehicle)}</div>`,
      '<button class="hv-plate-clear" type="button">Wis selectie</button>',
    ].join("");
    container.appendChild(card);

    const clearButton = card.querySelector(".hv-plate-clear");
    if (clearButton) {
      clearButton.addEventListener("click", () => {
        clearSelection();
        window.location.href = window.location.pathname;
      });
    }
  }

  function renderCandidatePicker(container, plate, candidates, onPick) {
    container.innerHTML = "";
    const wrapper = document.createElement("div");
    wrapper.className = "hv-plate-candidates";

    const label = document.createElement("label");
    label.textContent = "Kies een voertuigvariant";
    label.className = "hv-plate-label";
    const select = document.createElement("select");
    select.className = "hv-plate-select";
    candidates.forEach((candidate, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = candidateLabel(candidate);
      select.appendChild(option);
    });

    const button = document.createElement("button");
    button.type = "button";
    button.className = "hv-plate-submit";
    button.textContent = "Bevestig";
    button.addEventListener("click", () => {
      const index = Number.parseInt(select.value, 10);
      const selected = candidates[index];
      if (!selected) return;
      if (typeof onPick === "function") {
        onPick(selected);
      }
    });

    wrapper.appendChild(label);
    wrapper.appendChild(select);
    wrapper.appendChild(button);
    container.appendChild(wrapper);
  }

  function renderMountUI(container) {
    if (!container) return null;
    let form = container.querySelector(".hv-plate-form");
    let input = container.querySelector(".plate-input, .hv-plate-input");
    let status = container.querySelector(".plate-status, .hv-plate-status");
    let results = container.querySelector(".plate-results, .hv-plate-results");
    let button = form ? form.querySelector(".plate-btn, .hv-plate-btn") : null;

    if (!input || !form || !status || !results) {
      container.innerHTML = "";
      const root = document.createElement("div");
      root.className = "hv-plate-mount";

      form = document.createElement("form");
      form.className = "hv-plate-form";
      form.autocomplete = "off";

      input = document.createElement("input");
      input.type = "text";
      input.name = "plate";
      input.placeholder = "Bijv. 28NJN7";
      input.className = "plate-input hv-plate-input";

      button = document.createElement("button");
      button.type = "submit";
      button.className = "plate-btn hv-plate-btn";
      button.textContent = "Zoek";

      form.appendChild(input);
      form.appendChild(button);

      status = document.createElement("div");
      status.className = "plate-status hv-plate-status";
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");

      results = document.createElement("div");
      results.className = "plate-results hv-plate-results";

      root.appendChild(form);
      root.appendChild(status);
      root.appendChild(results);
      container.appendChild(root);
    }

    return { form, input, button, status, results };
  }

  function renderCandidateList(container, candidates, onPick) {
    container.innerHTML = "";
    const list = document.createElement("div");
    list.className = "hv-plate-candidate-list";

    candidates.forEach((candidate) => {
      const card = document.createElement("div");
      card.className = "hv-plate-candidate";

      const title = document.createElement("div");
      title.className = "hv-plate-candidate__title";
      title.textContent = candidateLabel(candidate);

      const button = document.createElement("button");
      button.type = "button";
      button.className = "hv-plate-candidate__btn";
      button.textContent = "Kies deze";
      button.addEventListener("click", () => {
        if (typeof onPick === "function") {
          onPick(candidate);
        }
      });

      card.appendChild(title);
      card.appendChild(button);
      list.appendChild(card);
    });

    container.appendChild(list);
  }

  function normalizeType(value) {
    const raw = String(value || "").toLowerCase().trim();
    if (!raw) return "";
    if (raw === "hv" || raw === "hulpveren") return "hulpveren";
    if (raw === "nr" || raw === "luchtvering") return "luchtvering";
    if (raw === "ls" || raw === "verlagingsveren") return "verlagingsveren";
    return "";
  }

  const PLATE_PREFIX = "kt_";

  function normalizeKt(raw) {
    const s = String(raw || "").trim().toLowerCase();
    if (!s) return "";
    return s.startsWith(PLATE_PREFIX) ? s : `${PLATE_PREFIX}${s}`;
  }

  function buildTypeUrl(type, makeSlug, modelSlug) {
    const cleanType = String(type || "").replace(/^\/+|\/+$/g, "");
    const segments = [cleanType];
    if (makeSlug) segments.push(String(makeSlug).replace(/^\/+|\/+$/g, ""));
    if (modelSlug) segments.push(String(modelSlug).replace(/^\/+|\/+$/g, ""));

    const ctx =
      (window.HVPlateContext &&
      typeof window.HVPlateContext.getPlateContext === "function" &&
      window.HVPlateContext.getPlateContext()) ||
      window.hv_plate_context ||
      {};
    const plateSeg = ctx.plate ? normalizePlate(ctx.plate).toLowerCase() : "";
    const ktRaw = ctx.vehicle && ctx.vehicle.kt ? ctx.vehicle.kt : "";
    const finalKt = ktRaw
      ? normalizeKt(ktRaw)
      : plateSeg
        ? normalizeKt(plateSeg)
        : "";
    if (finalKt) segments.push(finalKt);
    return "/" + segments.filter(Boolean).join("/") + "/";
  }

  function getIntentTypeFromLocation() {
    const params = new URLSearchParams(location.search || "");
    const viaParam = normalizeType(params.get("type"));
    if (viaParam) return viaParam;
    const path = String(location.pathname || "").toLowerCase();
    if (path.startsWith("/hulpveren/")) return "hulpveren";
    if (path.startsWith("/luchtvering/")) return "luchtvering";
    if (path.startsWith("/verlagingsveren/")) return "verlagingsveren";
    return "";
  }

  function renderTypeChoice(container, makeSlug) {
    if (!container) return;
    let block = container.querySelector("[data-plate-type-choice]");
    if (!block) {
      block = document.createElement("div");
      block.className = "plate-type-choice";
      block.setAttribute("data-plate-type-choice", "1");
      container.appendChild(block);
    }
    block.innerHTML = `
      <div class="plate-type-choice__title">Kies productgroep</div>
      <div class="plate-type-choice__actions">
        <button type="button" class="btn" data-type="hulpveren">Hulpveren</button>
        <button type="button" class="btn" data-type="luchtvering">Luchtvering</button>
        <button type="button" class="btn" data-type="verlagingsveren">Verlagingsveren</button>
      </div>
    `;
    if (block.dataset.bound !== "1") {
      block.dataset.bound = "1";
      block.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-type]");
        if (!button) return;
        const type = normalizeType(button.dataset.type);
        if (!type) return;
        const ctx =
          (window.HVPlateContext &&
            typeof window.HVPlateContext.getPlateContext === "function" &&
            window.HVPlateContext.getPlateContext()) ||
          window.hv_plate_context ||
          {};
        const vehicle = ctx && ctx.vehicle ? ctx.vehicle : null;
        const make =
          makeSlug ||
          slugify(
            (ctx.route && ctx.route.makeSlug) ||
              (vehicle && (vehicle.make || vehicle.makename)) ||
              ""
          );
        const model = slugify(
          (ctx.route && ctx.route.modelSlug) ||
            (vehicle &&
              (vehicle.model || vehicle.modelLabel || vehicle.modelname)) ||
            ""
        );
        window.location.href = buildTypeUrl(type, make, model);
      });
    }
  }

  function getPlateFromUrl() {
    const params = new URLSearchParams(location.search || "");
    const fromParam = params.get("kt");
    if (fromParam) return fromParam;
    const match = (location.pathname || "").match(/^\/kenteken\/([^/]+)\/?$/i);
    return match ? match[1] : "";
  }

  function normalizeKentekenUrl(plate) {
    if (!plate) return;
    if (!window.history || typeof window.history.replaceState !== "function") return;
    try {
      if ((location.pathname || "").toLowerCase().startsWith("/kenteken")) {
        const params = new URLSearchParams(location.search || "");
        const type = normalizeType(params.get("type"));
        const suffix = type ? `&type=${type}` : "";
        window.history.replaceState(null, "", `/kenteken/?kt=${plate}${suffix}`);
      }
    } catch (err) {
      return;
    }
  }

  async function initFromUrl(elements, options = {}) {
    if (!elements || !elements.form || !elements.input || !elements.status) return;
    if (elements.form.dataset.hvPlateAutoInit === "1") return;
    const raw = getPlateFromUrl();
    if (!raw) {
      if (typeof window.HVKentekenChoice === "function") {
        window.HVKentekenChoice(null);
      }
      return;
    }
    const normalized = normalizePlate(raw);
    if (!isValidPlate(normalized)) return;

    elements.form.dataset.hvPlateAutoInit = "1";
    elements.input.value = normalized;
    normalizeKentekenUrl(normalized);
    console.info("plate:parsed", { plate: normalized, source: "url" });

    const resetForm = () => {
      elements.input.value = "";
      elements.results.innerHTML = "";
      setStatus(elements.status, "", false, { state: "idle" });
      elements.input.focus();
    };

    const manualActionsHtml = buildStatusActions({ showReset: true, showManual: true });
    setLoading(elements.form, true);
    setStatus(elements.status, "Bezig met ophalen...", false, { state: "loading" });
    console.info("plate:lookup_start", { plate: normalized, source: "url" });

    try {
      const data = await lookupPlateWithTimeout(normalized);
      console.info("plate:lookup_end", { plate: normalized, ok: true });
      const candidates = extractCandidates(data);

      if (!candidates.length) {
        setStatus(elements.status, "Geen voertuig gevonden voor dit kenteken.", true, {
          state: "error",
          actionsHtml: manualActionsHtml,
          onReset: resetForm,
        });
        return;
      }

      const autoSelect =
        candidates.length === 1 && options.autoSelectIfSingle !== false;
      if (autoSelect) {
        finalizeSelection(normalized, candidates[0], data, {
          results: elements.results,
          status: elements.status,
        });
        return;
      }

      const renderCandidates =
        options.renderCandidates ||
        ((list, onPick) =>
          renderCandidatePicker(elements.results, normalized, list, onPick));
      renderCandidates(candidates, (selection) => {
        finalizeSelection(normalized, selection, data, {
          results: elements.results,
          status: elements.status,
        });
      });
      setStatus(elements.status, "Kies variant.", false, { state: "success" });
    } catch (err) {
      const message =
        err.code === "invalid_plate" || err.status === 400
          ? "Ongeldig kenteken"
          : err.status === 404
            ? "Geen voertuig gevonden voor dit kenteken."
          : err.code === "timeout"
            ? "Kentekencheck duurt te lang. Probeer opnieuw."
          : "Fout bij het ophalen. Probeer later opnieuw.";
      const allowManual =
        err.code === "timeout" || err.status === 404 || !err.status || Number(err.status) >= 500;
      const actionsHtml = buildStatusActions({
        showReset: true,
        showManual: allowManual,
      });
      setStatus(elements.status, message, true, {
        state: "error",
        actionsHtml,
        onReset: resetForm,
      });
    } finally {
      setLoading(elements.form, false);
    }
  }

  function mount(selector, options = {}) {
    const container = typeof selector === "string" ? document.querySelector(selector) : selector;
    if (!container) return null;
    if (container.dataset && container.dataset.hvPlateMounted === "1") return null;
    if (container.dataset) {
      container.dataset.hvPlateMounted = "1";
    }

    const elements = renderMountUI(container);
    if (!elements) return null;
    const settings = Object.assign({ autoSelectIfSingle: true }, options);

    const existing = getSelectedVehicle();
    if (existing) {
      renderSelected(elements.results, existing);
      renderTypeChoice(elements.results, slugify(existing.make || existing.makename || ""));
    }

    initFromUrl(elements, {
      autoSelectIfSingle: settings.autoSelectIfSingle,
      renderCandidates: (candidates, onPick) => renderCandidateList(elements.results, candidates, onPick),
    });

    elements.form.addEventListener("submit", async (event) => {
      event.preventDefault();
      setStatus(elements.status, "", false, { state: "idle" });
      elements.results.innerHTML = "";

      const normalized = normalizePlate(elements.input.value);
      elements.input.value = normalized;
      if (!isValidPlate(normalized)) {
        const actionsHtml = buildStatusActions({ showReset: true, showManual: false });
        const resetForm = () => {
          elements.input.value = "";
          elements.results.innerHTML = "";
          setStatus(elements.status, "", false, { state: "idle" });
          elements.input.focus();
        };
        setStatus(elements.status, "Ongeldig kenteken", true, {
          state: "error",
          actionsHtml,
          onReset: resetForm,
        });
        return;
      }

      emitEvent("hv:plateLookup", { plate: normalized });
      setLoading(elements.form, true);
      setStatus(elements.status, "Bezig met ophalen...", false, { state: "loading" });

      try {
        const data = await lookupPlate(normalized);
        const candidates = extractCandidates(data);

        emitEvent("hv:plateResult", {
          plate: normalized,
          candidates,
          source: data.source || "api",
        });

        if (!candidates.length) {
          const actionsHtml = buildStatusActions({ showReset: true, showManual: false });
          const resetForm = () => {
            elements.input.value = "";
            elements.results.innerHTML = "";
            setStatus(elements.status, "", false, { state: "idle" });
            elements.input.focus();
          };
          setStatus(elements.status, "Geen voertuig gevonden voor dit kenteken.", true, {
            state: "error",
            actionsHtml,
            onReset: resetForm,
          });
          return;
        }

        if (candidates.length === 1 && settings.autoSelectIfSingle !== false) {
          finalizeSelection(normalized, candidates[0], data, {
            results: elements.results,
            status: elements.status,
          });
          return;
        }

        renderCandidateList(elements.results, candidates, (selection) => {
          finalizeSelection(normalized, selection, data, {
            results: elements.results,
            status: elements.status,
          });
        });
        setStatus(elements.status, "Kies een voertuigvariant.", false, {
          state: "success",
        });
      } catch (err) {
        const message =
          err.code === "invalid_plate" || err.status === 400
            ? "Ongeldig kenteken"
            : err.status === 404
              ? "Geen voertuig gevonden voor dit kenteken."
            : err.status === 429
              ? "Te veel verzoeken, probeer zo opnieuw"
              : err.code === "timeout"
                ? "Kentekenservice reageert niet. Probeer opnieuw."
                : "Fout bij het ophalen. Probeer later opnieuw.";
        const isServiceError =
          err.code === "timeout" || !err.status || Number(err.status) >= 500;
        const actionsHtml = buildStatusActions({
          showReset: true,
          showManual: isServiceError,
        });
        const resetForm = () => {
          elements.input.value = "";
          elements.results.innerHTML = "";
          setStatus(elements.status, "", false, { state: "idle" });
          elements.input.focus();
        };
        setStatus(elements.status, message, true, {
          state: "error",
          actionsHtml,
          onReset: resetForm,
        });
      } finally {
        setLoading(elements.form, false);
      }
    });

    return {
      destroy() {
        if (container.dataset) {
          delete container.dataset.hvPlateMounted;
        }
        container.innerHTML = "";
      },
    };
  }

  function finalizeSelectionLegacy(plate, vehicle, data, elements) {
    if (!vehicle) return;
    persistSelection(plate, vehicle);
    setRouteSlugsFromVehicle(vehicle);
	// 🔁 spring naar juiste merkpagina binnen huidige categorie
const path = location.pathname;
const isHV = path.startsWith("/hulpveren/");
const isNR = path.startsWith("/luchtvering/");
const isLS = path.startsWith("/verlagingsveren/");

if (isHV || isNR || isLS) {
  const type = isHV ? "hulpveren" : isNR ? "luchtvering" : "verlagingsveren";
  const make = slugify(vehicle.make || vehicle.makename || "");
  location.href = `/${type}/${make}/`;
  return;
}

// ⬇️ NIET op HV/NR/LS → vraag keuze
const make = slugify(vehicle.make || vehicle.makename || "");
const choice = null;
if (!choice) return;

const map = { HV: "hulpveren", NR: "luchtvering", LS: "verlagingsveren" };
const type = map[String(choice).trim().toUpperCase()];
if (type) location.href = `/${type}/${make}/`;


    if (elements && elements.results) {
      renderSelected(elements.results, vehicle);
    }
    if (elements && elements.status) {
      setStatus(elements.status, "Voertuig gevonden.", false, { state: "success" });
    }
    emitEvent("hv:vehicleSelected", {
      plate,
      vehicle,
      source: (data && data.source) || "api",
    });
  }

  function bindBaseNavRedirect() {
    const selected = getSelectedVehicle();
    if (!selected) return;
    const { make, model } = computeMakeModelSlug(selected);
    if (!make) return;
    const targets = ["/hulpveren", "/hulpveren/"];
    document.addEventListener("click", (evt) => {
      const a = evt.target.closest("a");
      if (!a) return;
      const href = a.getAttribute("href") || "";
      if (!targets.includes(href)) return;
      evt.preventDefault();
      const next = model ? `/hulpveren/${make}/${model}/` : `/hulpveren/${make}/`;
      window.location.href = next;
    });
  }

  function finalizeSelection(plate, vehicle, data, elements) {
    if (!vehicle) return;

    const { make, model } = computeMakeModelSlug(vehicle);
    const intentType = getIntentTypeFromLocation();

    const proceed = () => {
      const makeSlug = make;
      persistSelection(plate, vehicle, { intentType });
      setRouteSlugsFromVehicle(vehicle);

      const path = String(location.pathname || "").toLowerCase();
      const isHV = path.startsWith("/hulpveren/");
      const isNR = path.startsWith("/luchtvering/");
      const isLS = path.startsWith("/verlagingsveren/");
      if (isHV || isNR || isLS) {
        const type = isHV ? "hulpveren" : isNR ? "luchtvering" : "verlagingsveren";
        window.location.href = buildTypeUrl(type, make, model);
        return;
      }

      if (intentType && makeSlug) {
        window.location.href = buildTypeUrl(intentType, make, model);
        return;
      }

      if (elements && elements.results) {
        renderSelected(elements.results, vehicle);
        if (!document.getElementById("kenteken-tiles")) {
          renderTypeChoice(elements.results, makeSlug);
        }
      }
      if (elements && elements.status) {
        setStatus(elements.status, "Voertuig gevonden.", false, { state: "success" });
      }
      emitEvent("hv:vehicleSelected", {
        plate,
        vehicle,
        source: (data && data.source) || "api",
      });
    };

    (async () => {
      try {
        const rdw = await fetchRdwYear(plate);
        applyYearContext(vehicle, rdw.year - 1, rdw.year + 1, rdw.source);
      } catch (e) {
        const est = getEstimatedYear(vehicle);
        if (est.year) {
          vehicle.estimatedYear = est.year;
          vehicle.estimatedYearFrom = est.source;
          vehicle.estimatedYearMin = est.year - 1;
          vehicle.estimatedYearMax = est.year + 1;
          applyYearContext(vehicle, est.year - 1, est.year + 1, est.source || "aldoc");
        } else {
          const txt =
            vehicle.uitvoering ||
            vehicle.trim ||
            vehicle.typeLabel ||
            vehicle.typename ||
            vehicle.type ||
            "";
          const r = parseAldocRangeFromText(txt);
          if (r) applyYearContext(vehicle, r.minY, r.maxY, r.source);
        }
      } finally {
        proceed();
      }
    })();
  }

  function initWidget() {
    const container =
      document.querySelector("[data-hv-plate]") || document.getElementById("hv-plate-widget");
    if (!container) return;

    ensureWidget(container);

    const form = container.querySelector(".hv-plate-form");
    const input = container.querySelector(".hv-plate-input");
    const status = container.querySelector(".hv-plate-status");
    const results = container.querySelector(".hv-plate-results");

    const existing = getSelectedVehicle();
    if (existing) {
      renderSelected(results, existing);
      renderTypeChoice(results, slugify(existing.make || existing.makename || ""));
    }

    initFromUrl({ form, input, status, results }, {
      autoSelectIfSingle: true,
      renderCandidates: (candidates, onPick) =>
        renderCandidatePicker(results, normalizePlate(input.value), candidates, onPick),
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      setStatus(status, "", false, { state: "idle" });
      results.innerHTML = "";

      const normalized = normalizePlate(input.value);
      if (!isValidPlate(normalized)) {
        const actionsHtml = buildStatusActions({ showReset: true, showManual: false });
        const resetForm = () => {
          input.value = "";
          results.innerHTML = "";
          setStatus(status, "", false, { state: "idle" });
          input.focus();
        };
        setStatus(status, "Voer een geldig kenteken in.", true, {
          state: "error",
          actionsHtml,
          onReset: resetForm,
        });
        return;
      }

      setLoading(form, true);
      setStatus(status, "Bezig met ophalen...", false, { state: "loading" });

      try {
        const data = await lookupPlate(normalized);
        const candidates = extractCandidates(data);
        if (!candidates.length) {
          const actionsHtml = buildStatusActions({ showReset: true, showManual: false });
          const resetForm = () => {
            input.value = "";
            results.innerHTML = "";
            setStatus(status, "", false, { state: "idle" });
            input.focus();
          };
          setStatus(status, "Geen voertuig gevonden voor dit kenteken.", true, {
            state: "error",
            actionsHtml,
            onReset: resetForm,
          });
          return;
        }

        if (candidates.length === 1) {
          finalizeSelection(normalized, candidates[0], data, { results, status });
          return;
        }

        renderCandidatePicker(results, normalized, candidates, (selection) => {
          finalizeSelection(normalized, selection, data, { results, status });
        });
        setStatus(status, "Meerdere voertuigen gevonden.", false, {
          state: "success",
        });
      } catch (err) {
        const message =
          err.code === "invalid_plate"
            ? "Voer een geldig kenteken in."
            : err.status === 404
              ? "Geen voertuig gevonden voor dit kenteken."
            : err.code === "timeout"
              ? "Kentekenservice reageert niet. Probeer opnieuw."
              : "Fout bij het ophalen. Probeer later opnieuw.";
        const isServiceError =
          err.code === "timeout" || !err.status || Number(err.status) >= 500;
        const actionsHtml = buildStatusActions({
          showReset: true,
          showManual: isServiceError,
        });
        const resetForm = () => {
          input.value = "";
          results.innerHTML = "";
          setStatus(status, "", false, { state: "idle" });
          input.focus();
        };
        setStatus(status, message, true, {
          state: "error",
          actionsHtml,
          onReset: resetForm,
        });
      } finally {
        setLoading(form, false);
      }
    });
  }

  window.HVPlate = {
    normalizePlate,
    lookupPlate,
    getSelectedVehicle,
    clear: clearSelection,
    Menu,
    mount,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initWidget);
    document.addEventListener("DOMContentLoaded", bindBaseNavRedirect);
  } else {
    initWidget();
    bindBaseNavRedirect();
  }
})();
