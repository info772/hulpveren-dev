(function () {
  /* Fix Summary:
   * Broken: Kenteken lookup could hang without timeout and errors lacked reset/fallback links.
   * Change: Added timeout-based fetch with diagnostics, explicit state handling, and reset/manual actions.
   * Test: Use /kenteken with valid/invalid plates and simulate API failure/timeout.
   */

  const STORAGE_KEYS = {
    plate: "hv_plate",
    vehicle: "hv_vehicle_selected",
    selectedAt: "hv_vehicle_selected_at",
  };
  const MENU_CACHE_KEY = "hv_menu_cache";
  const MENU_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
  const MAPPING_CACHE_KEY = "hv_menu_mapping";
  const MAPPING_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
  const MAPPING_URL = "/config/menuMapping.json";
  const PLATE_API_BASE = (window.HV_PLATE_API_BASE || "/api/plate").replace(
    /\/+$/,
    ""
  );
  const PLATE_TIMEOUT_MS = 12000;

  function normalizePlate(value) {
    return String(value || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  }

  function isValidPlate(value) {
    return value.length >= 6;
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
      localStorage.setItem(key, value);
    } catch (err) {
      return;
    }
  }

  function storageGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (err) {
      return null;
    }
  }

  function storageRemove(key) {
    try {
      localStorage.removeItem(key);
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

  async function fetchWithTimeout(url, options = {}, timeoutMs = PLATE_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
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

  async function fetchPlateJson(plate) {
    const url = `${PLATE_API_BASE}/${encodeURIComponent(plate)}`;
    const res = await fetchWithTimeout(url, { cache: "no-store" });
    const snippet = await res
      .clone()
      .text()
      .then((text) => text.slice(0, 200))
      .catch(() => "");
    if (!res.ok) {
      console.warn("plate:fetch_error", { url, status: res.status, snippet });
      const error = new Error(`Request failed: ${res.status}`);
      error.status = res.status;
      throw error;
    }
    console.info("plate:fetch", { url, status: res.status, snippet });
    return res.json();
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

  function saveSelection(plate, vehicle) {
    storageSet(STORAGE_KEYS.plate, plate);
    storageSet(STORAGE_KEYS.vehicle, JSON.stringify(vehicle));
    storageSet(STORAGE_KEYS.selectedAt, String(Date.now()));
    if (
      window.HVPlateContext &&
      typeof window.HVPlateContext.setPlateContextFromVehicle === "function"
    ) {
      window.HVPlateContext.setPlateContextFromVehicle(plate, vehicle);
    }
  }

  function persistSelection(plate, vehicle) {
    if (typeof saveSelection === "function") {
      saveSelection(plate, vehicle);
      return;
    }
    storageSet(
      "hv_plate_selection",
      JSON.stringify({ plate, vehicle, selectedAt: Date.now() })
    );
  }

  function getSelectedVehicle() {
    return storageGetJson(STORAGE_KEYS.vehicle);
  }

  function clearSelection() {
    storageRemove(STORAGE_KEYS.plate);
    storageRemove(STORAGE_KEYS.vehicle);
    storageRemove(STORAGE_KEYS.selectedAt);
    if (
      window.HVPlateContext &&
      typeof window.HVPlateContext.clearPlateContext === "function"
    ) {
      window.HVPlateContext.clearPlateContext();
    }
  }

  async function lookupPlate(plate) {
    const normalized = normalizePlate(plate);
    if (!isValidPlate(normalized)) {
      const err = new Error("invalid_plate");
      err.code = "invalid_plate";
      throw err;
    }
    const data = await fetchPlateJson(normalized);
    return data;
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
    clearButton.addEventListener("click", () => {
      clearSelection();
      container.innerHTML = "";
    });
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
    }

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

  function finalizeSelection(plate, vehicle, data, elements) {
    if (!vehicle) return;
    persistSelection(plate, vehicle);
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
    if (existing) renderSelected(results, existing);

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
  } else {
    initWidget();
  }
})();
