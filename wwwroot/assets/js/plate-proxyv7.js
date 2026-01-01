(function () {
  const CONFIG_URLS = {
    productSettings: "/assets/config/productSettings.json",
    menuMapping: "/assets/config/menuMapping.json",
  };

  const STORAGE_KEYS = {
    plate: "hv_plate",
    vehicle: "hv_vehicle_selected",
    selectedAt: "hv_vehicle_selected_at",
    productSettings: "hv_product_settings",
    menuMapping: "hv_menu_mapping",
    plateCachePrefix: "hv_plate_cache_",
    menuPartsPrefix: "hv_menuparts_cache_",
  };

  const TTL = {
    configMs: 6 * 60 * 60 * 1000,
    plateMs: 24 * 60 * 60 * 1000,
    menuPartsMs: 6 * 60 * 60 * 1000,
  };

  const RATE_LIMIT_MS = 3000;

  const BRAND_KEYWORDS = ["supplier", "brand", "make", "manufacturer"];
  const GROUP_KEYWORDS = ["group", "partgroup", "articlegroup", "productgroup", "category", "ktg"];

  let lastLookupAt = 0;
  let cachedConfig = null;

  function now() {
    return Date.now();
  }

  function normalizePlate(input) {
    return String(input || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  }

  function isValidPlate(plate) {
    return plate.length >= 6;
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

  function cacheWrite(key, value, ttlMs) {
    const payload = {
      value,
      expiresAt: ttlMs ? now() + ttlMs : null,
    };
    storageSet(key, JSON.stringify(payload));
  }

  function cacheRead(key) {
    const raw = storageGet(key);
    if (!raw) return null;
    try {
      const payload = JSON.parse(raw);
      if (payload.expiresAt && payload.expiresAt < now()) {
        storageRemove(key);
        return null;
      }
      return payload.value;
    } catch (err) {
      return null;
    }
  }

  function clearConfigCache() {
    storageRemove(STORAGE_KEYS.productSettings);
    storageRemove(STORAGE_KEYS.menuMapping);
    cachedConfig = null;
  }

  function joinUrl(base, path) {
    const trimmed = String(base || "").replace(/\/+$/, "");
    const suffix = path.startsWith("/") ? path : `/${path}`;
    return `${trimmed}${suffix}`;
  }

  async function fetchText(url) {
    const res = await fetch(url, { cache: "no-store", mode: "cors" });
    if (!res.ok) {
      const err = new Error(`Request failed: ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return res.text();
  }

  async function fetchJson(url) {
    const res = await fetch(url, { cache: "no-store", mode: "cors" });
    if (!res.ok) {
      const err = new Error(`Request failed: ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  function toNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    const num = Number.parseInt(value, 10);
    return Number.isNaN(num) ? null : num;
  }

  function toNumberList(values) {
    if (!Array.isArray(values)) return [];
    return values
      .map((value) => toNumber(value))
      .filter((value) => value !== null);
  }

  function getXmlValue(node, tagName) {
    if (!node) return "";
    const nodes = node.getElementsByTagNameNS("*", tagName);
    if (!nodes.length) return "";
    return (nodes[0].textContent || "").trim();
  }

  function parsePlateXml(xmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, "application/xml");
    const errors = doc.getElementsByTagName("parsererror");
    if (errors.length) {
      throw new Error("invalid_xml");
    }

    const nodes = doc.getElementsByTagNameNS("*", "SingleType");
    const candidates = [];
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i];
      candidates.push({
        makeCode: toNumber(getXmlValue(node, "makecode")),
        make: getXmlValue(node, "makename") || null,
        modelCode: toNumber(getXmlValue(node, "modelcode")),
        model: getXmlValue(node, "modelname") || null,
        modelRemark: getXmlValue(node, "model_remark") || null,
        bodyType: getXmlValue(node, "bodytype") || null,
        typeCode: toNumber(getXmlValue(node, "typecode")),
        type: getXmlValue(node, "typename") || null,
        typeRemark: getXmlValue(node, "type_remark") || null,
        fuelCode: toNumber(getXmlValue(node, "fuelcode")),
        engineType: getXmlValue(node, "enginetype") || null,
        kw: toNumber(getXmlValue(node, "kw")),
        kwCat: toNumber(getXmlValue(node, "kw_cat")),
        groupType: toNumber(getXmlValue(node, "grouptype")),
        ktyp: toNumber(getXmlValue(node, "ktyp")),
        driveType: getXmlValue(node, "drivetype") || null,
        engineContents: toNumber(getXmlValue(node, "engine_contents")),
        cylinders: toNumber(getXmlValue(node, "nocyl")),
        typeFrom: toNumber(getXmlValue(node, "type_from")),
        typeTill: toNumber(getXmlValue(node, "type_till")),
      });
    }
    return candidates;
  }

  async function loadProductSettings(force) {
    if (!force) {
      const cached = cacheRead(STORAGE_KEYS.productSettings);
      if (cached) return cached;
    }
    const settings = await fetchJson(CONFIG_URLS.productSettings);
    cacheWrite(STORAGE_KEYS.productSettings, settings, TTL.configMs);
    return settings;
  }

  async function loadMenuMapping(force) {
    if (!force) {
      const cached = cacheRead(STORAGE_KEYS.menuMapping);
      if (cached) return cached;
    }
    const mapping = await fetchJson(CONFIG_URLS.menuMapping);
    cacheWrite(STORAGE_KEYS.menuMapping, mapping, TTL.configMs);
    return mapping;
  }

  async function loadConfig(force) {
    if (!force && cachedConfig) return cachedConfig;
    const [productSettings, menuMapping] = await Promise.all([
      loadProductSettings(force),
      loadMenuMapping(force),
    ]);
    cachedConfig = { productSettings, menuMapping };
    return cachedConfig;
  }

  async function lookupPlate(plate) {
    const normalized = normalizePlate(plate);
    if (!isValidPlate(normalized)) {
      const err = new Error("invalid_plate");
      err.code = "invalid_plate";
      throw err;
    }

    const elapsed = now() - lastLookupAt;
    if (elapsed < RATE_LIMIT_MS) {
      const err = new Error("rate_limited");
      err.code = "rate_limited";
      throw err;
    }
    lastLookupAt = now();

    const cacheKey = `${STORAGE_KEYS.plateCachePrefix}${normalized}`;
    const cached = cacheRead(cacheKey);
    if (cached) return cached;

    const config = await loadConfig(false);
    const proxyBase =
      config.productSettings && config.productSettings.proxyBase
        ? config.productSettings.proxyBase
        : "http://proxyv7.easycarparts.nl";
    const url = joinUrl(
      proxyBase,
      `/mmt.ashx?operation=GetTypesByLicenseplateNL&plate=${encodeURIComponent(normalized)}`
    );
    const xmlText = await fetchText(url);
    const candidates = parsePlateXml(xmlText);
    const payload = {
      plate: normalized,
      vehicleCandidates: candidates,
    };
    cacheWrite(cacheKey, payload, TTL.plateMs);
    return payload;
  }

  function findMakeKey(mapping, make) {
    if (!mapping || !mapping.byMake || !make) return null;
    const target = String(make).toLowerCase();
    const keys = Object.keys(mapping.byMake);
    for (let i = 0; i < keys.length; i += 1) {
      if (keys[i].toLowerCase() === target) return keys[i];
    }
    return null;
  }

  function normalizeNodeIds(nodeIds) {
    if (!Array.isArray(nodeIds)) return [];
    const values = nodeIds
      .map((value) => toNumber(value))
      .filter((value) => value !== null);
    return Array.from(new Set(values));
  }

  function resolveNodeIds(mapping, make, groupKey) {
    const result = {
      rootId: toNumber(mapping && mapping.defaultRootId) || 0,
      nodeIds: [],
    };

    const makeKey = findMakeKey(mapping, make);
    const makeEntry = makeKey ? mapping.byMake[makeKey] : null;
    const makeGroup = makeEntry && makeEntry[groupKey] ? makeEntry[groupKey] : null;
    const defaultGroup =
      mapping && mapping.defaultByGroup && mapping.defaultByGroup[groupKey]
        ? mapping.defaultByGroup[groupKey]
        : null;

    const source = makeGroup || defaultGroup;
    if (source) {
      if (source.rootId !== undefined && source.rootId !== null) {
        const sourceRoot = toNumber(source.rootId);
        if (sourceRoot !== null) result.rootId = sourceRoot;
      }
      result.nodeIds = normalizeNodeIds(source.nodeIds);
    }

    return result;
  }

  function collectNumericFields(obj, path, depth, out) {
    if (!obj || typeof obj !== "object" || depth > 5) return;
    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        collectNumericFields(item, `${path}[${index}]`, depth + 1, out);
      });
      return;
    }
    Object.keys(obj).forEach((key) => {
      const value = obj[key];
      const nextPath = path ? `${path}.${key}` : key;
      if (typeof value === "number" && Number.isFinite(value)) {
        out.push({ value, key, path: nextPath });
        return;
      }
      if (typeof value === "string" && value.trim() && /^[0-9]+$/.test(value.trim())) {
        out.push({ value: Number.parseInt(value, 10), key, path: nextPath });
        return;
      }
      if (value && typeof value === "object") {
        collectNumericFields(value, nextPath, depth + 1, out);
      }
    });
  }

  function containsKeyword(text, keywords) {
    for (let i = 0; i < keywords.length; i += 1) {
      if (text.includes(keywords[i])) return true;
    }
    return false;
  }

  function isIgnoredKeyForBrand(keyLower) {
    return keyLower.includes("menu") && !keyLower.includes("supplier");
  }

  function pickCandidate(candidates, keywords, preferredCodes) {
    const filtered = candidates.filter((candidate) => {
      const keyLower = candidate.key.toLowerCase();
      const pathLower = candidate.path.toLowerCase();
      if (keywords === BRAND_KEYWORDS && isIgnoredKeyForBrand(keyLower)) return false;
      return (
        containsKeyword(keyLower, keywords) ||
        containsKeyword(pathLower, keywords)
      );
    });
    if (!filtered.length) return null;
    if (Array.isArray(preferredCodes) && preferredCodes.length) {
      const match = filtered.find((candidate) => preferredCodes.includes(candidate.value));
      if (match) return match;
    }
    return filtered[0];
  }

  function pickStringValue(obj, keys) {
    if (!obj) return "";
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key];
        if (typeof value === "string" && value.trim()) return value.trim();
        if (value && typeof value === "object") {
          const nested = value.Name || value.name || value.Label || value.label;
          if (typeof nested === "string" && nested.trim()) return nested.trim();
        }
      }
    }
    return "";
  }

  function pickSupplierName(rawItem) {
    if (!rawItem) return "";
    if (Array.isArray(rawItem.Suppliers)) {
      for (let i = 0; i < rawItem.Suppliers.length; i += 1) {
        const supplier = rawItem.Suppliers[i];
        if (supplier && typeof supplier.Name === "string" && supplier.Name.trim()) {
          return supplier.Name.trim();
        }
      }
    }

    return pickStringValue(rawItem, [
      "SupplierName",
      "BrandName",
      "MakeName",
      "ManufacturerName",
      "Supplier",
      "Brand",
      "Make",
      "Manufacturer",
    ]);
  }

  function safeStringify(value, limit) {
    try {
      const text = JSON.stringify(value);
      if (!limit || text.length <= limit) return text;
      return text.slice(0, limit);
    } catch (err) {
      return "";
    }
  }

  function buildFallbackText(normalized) {
    const parts = [];
    if (normalized.title) parts.push(normalized.title);
    if (normalized.supplierName) parts.push(normalized.supplierName);
    parts.push(safeStringify(normalized.raw, 1000));
    return parts.join(" ").toLowerCase();
  }

  function normalizeItem(rawItem, preferredCodes) {
    const preferredBrandCodes = toNumberList(preferredCodes && preferredCodes.brandCodes);
    const preferredGroupCodes = toNumberList(preferredCodes && preferredCodes.productGroupCodes);

    const candidates = [];
    collectNumericFields(rawItem, "", 0, candidates);

    const brandCandidate = pickCandidate(candidates, BRAND_KEYWORDS, preferredBrandCodes);
    const groupCandidate = pickCandidate(candidates, GROUP_KEYWORDS, preferredGroupCodes);

    const title =
      pickStringValue(rawItem, [
        "PartName",
        "ProductName",
        "ArticleName",
        "Description",
        "Name",
        "Menu",
        "Title",
      ]) || "Onbekend";

    const supplierName = pickSupplierName(rawItem);

    return {
      title,
      brandCode: brandCandidate ? brandCandidate.value : null,
      brandField: brandCandidate ? brandCandidate.path : null,
      productGroupCode: groupCandidate ? groupCandidate.value : null,
      groupField: groupCandidate ? groupCandidate.path : null,
      supplierName: supplierName || null,
      raw: rawItem,
    };
  }

  function fallbackMatches(normalized, filters) {
    const includeRaw = Array.isArray(filters.fallbackTextInclude)
      ? filters.fallbackTextInclude
      : [];
    const excludeRaw = Array.isArray(filters.fallbackTextExclude)
      ? filters.fallbackTextExclude
      : [];

    if (!includeRaw.length) return false;

    const include = includeRaw.map((term) => String(term).toLowerCase());
    const exclude = excludeRaw.map((term) => String(term).toLowerCase());
    const haystack = buildFallbackText(normalized);

    if (exclude.some((term) => term && haystack.includes(term))) return false;

    const matchedIncludes = include.filter((term) => term && haystack.includes(term));
    if (!matchedIncludes.length) return false;

    const brandTerms = includeRaw
      .filter((term) => /^[A-Z0-9]+$/.test(String(term)))
      .map((term) => String(term).toLowerCase());
    const nonBrandTerms = include.filter((term) => !brandTerms.includes(term));

    if (brandTerms.length) {
      const hasBrand = brandTerms.some((term) => haystack.includes(term));
      if (!hasBrand) return false;
      if (!nonBrandTerms.length) return true;
      return nonBrandTerms.some((term) => haystack.includes(term));
    }

    return true;
  }

  function passesFilters(normalized, filters) {
    const preferredBrandCodes = toNumberList(filters.brandCodes);
    const preferredGroupCodes = toNumberList(filters.productGroupCodes);
    const needsBrand = preferredBrandCodes.length > 0;
    const needsGroup = preferredGroupCodes.length > 0;
    const brandHas = normalized.brandCode !== null && normalized.brandCode !== undefined;
    const groupHas = normalized.productGroupCode !== null && normalized.productGroupCode !== undefined;

    if (needsBrand && brandHas && !preferredBrandCodes.includes(normalized.brandCode)) {
      return false;
    }
    if (needsGroup && groupHas && !preferredGroupCodes.includes(normalized.productGroupCode)) {
      return false;
    }

    if (!needsBrand && !needsGroup) {
      if (filters.fallbackTextInclude && filters.fallbackTextInclude.length) {
        return fallbackMatches(normalized, filters);
      }
      return true;
    }

    if ((needsBrand && !brandHas) || (needsGroup && !groupHas)) {
      return fallbackMatches(normalized, filters);
    }

    return true;
  }

  function looksLikePart(item) {
    if (!item || typeof item !== "object") return false;
    const keys = Object.keys(item).map((key) => key.toLowerCase());
    return (
      keys.some((key) => key.includes("part")) ||
      keys.some((key) => key.includes("article")) ||
      keys.some((key) => key.includes("product"))
    );
  }

  function collectItemsFromMenuparts(payload) {
    const items = [];
    if (!payload) return items;

    if (Array.isArray(payload.MenuItems)) {
      payload.MenuItems.forEach((menuItem) => {
        if (Array.isArray(menuItem.MenuParts) && menuItem.MenuParts.length) {
          menuItem.MenuParts.forEach((part) => {
            items.push({
              ...part,
              MenuCode: menuItem.MenuCode,
              Menu: menuItem.Menu,
            });
          });
          return;
        }
        if (looksLikePart(menuItem)) {
          items.push(menuItem);
        }
      });
    } else if (Array.isArray(payload.MenuParts)) {
      items.push(...payload.MenuParts);
    } else if (Array.isArray(payload.items)) {
      items.push(...payload.items);
    }

    return items;
  }

  async function fetchMenuParts(rootId, nodeId, proxyBase) {
    const cacheKey = `${STORAGE_KEYS.menuPartsPrefix}${rootId}_${nodeId}`;
    const cached = cacheRead(cacheKey);
    if (cached) return cached;
    const url = joinUrl(proxyBase, `/PartServices/api/Menuparts/${rootId}/${nodeId}`);
    const data = await fetchJson(url);
    cacheWrite(cacheKey, data, TTL.menuPartsMs);
    return data;
  }

  async function loadItemsForVehicle(vehicle, plate) {
    const config = await loadConfig(false);
    const productSettings = config.productSettings || { groups: {} };
    const menuMapping = config.menuMapping || {};
    const proxyBase = productSettings.proxyBase || "http://proxyv7.easycarparts.nl";

    const groupEntries = Object.entries(productSettings.groups || {});
    const results = {};

    await Promise.all(
      groupEntries.map(async ([groupKey, group]) => {
        if (!group || !group.enabled) return;
        const nodeInfo = resolveNodeIds(
          menuMapping,
          vehicle && vehicle.make ? vehicle.make : "",
          groupKey
        );
        const nodeIds = nodeInfo.nodeIds;
        const rootId = nodeInfo.rootId;
        if (!nodeIds.length) {
          results[groupKey] = {
            label: group.label || groupKey,
            items: [],
            nodeIds: [],
            rootId,
            filters: group.filters || {},
          };
          return;
        }

        const payloads = await Promise.all(
          nodeIds.map((nodeId) => fetchMenuParts(rootId, nodeId, proxyBase))
        );
        const rawItems = payloads.flatMap((payload) => collectItemsFromMenuparts(payload));
        const filters = group.filters || {};
        const preferredCodes = {
          brandCodes: filters.brandCodes || [],
          productGroupCodes: filters.productGroupCodes || [],
        };

        const normalized = rawItems.map((item) => normalizeItem(item, preferredCodes));
        const filtered = normalized.filter((item) => passesFilters(item, filters));
        const maxItems = toNumber(group.maxItems) || filtered.length;
        results[groupKey] = {
          label: group.label || groupKey,
          items: filtered.slice(0, maxItems),
          nodeIds,
          rootId,
          filters,
        };
      })
    );

    const detail = { plate, vehicle, groups: results };
    window.dispatchEvent(new CustomEvent("hv:itemsLoaded", { detail }));
    return results;
  }

  function formatCandidate(candidate) {
    const parts = [candidate.make, candidate.model, candidate.type].filter(Boolean);
    const years =
      candidate.typeFrom || candidate.typeTill
        ? `${candidate.typeFrom || ""}-${candidate.typeTill || ""}`
        : "";
    return parts.join(" ") + (years ? ` (${years})` : "");
  }

  function saveSelection(plate, vehicle) {
    storageSet(STORAGE_KEYS.plate, plate);
    storageSet(STORAGE_KEYS.vehicle, JSON.stringify(vehicle));
    storageSet(STORAGE_KEYS.selectedAt, String(now()));
  }

  function getSelected() {
    const plate = storageGet(STORAGE_KEYS.plate);
    const vehicleRaw = storageGet(STORAGE_KEYS.vehicle);
    const selectedAt = Number.parseInt(storageGet(STORAGE_KEYS.selectedAt) || "0", 10) || null;
    let vehicle = null;
    try {
      vehicle = vehicleRaw ? JSON.parse(vehicleRaw) : null;
    } catch (err) {
      vehicle = null;
    }
    return { plate, vehicle, selectedAt };
  }

  function clearSelected() {
    storageRemove(STORAGE_KEYS.plate);
    storageRemove(STORAGE_KEYS.vehicle);
    storageRemove(STORAGE_KEYS.selectedAt);
  }

  function setStatus(el, message, isError) {
    if (!el) return;
    el.textContent = message || "";
    el.classList.toggle("is-error", Boolean(isError));
  }

  function setLoading(form, isLoading) {
    if (!form) return;
    form.classList.toggle("is-loading", isLoading);
    const button = form.querySelector("button[type='submit']");
    if (button) button.disabled = isLoading;
  }

  function renderCandidatePicker(container, plate, candidates, onPick) {
    container.innerHTML = "";
    const wrapper = document.createElement("div");
    wrapper.className = "hv-plate-candidates";
    const label = document.createElement("label");
    label.className = "hv-plate-label";
    label.textContent = "Kies een voertuigvariant";
    const select = document.createElement("select");
    select.className = "hv-plate-select";

    candidates.forEach((candidate, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = formatCandidate(candidate);
      select.appendChild(option);
    });

    const button = document.createElement("button");
    button.type = "button";
    button.className = "hv-plate-submit";
    button.textContent = "Bevestig";
    button.addEventListener("click", () => {
      const index = Number.parseInt(select.value, 10);
      const selected = candidates[index];
      if (selected) onPick(selected);
    });

    wrapper.appendChild(label);
    wrapper.appendChild(select);
    wrapper.appendChild(button);
    container.appendChild(wrapper);
  }

  function renderSelected(container, vehicle) {
    if (!container) return;
    container.innerHTML = "";
    if (!vehicle) return;
    const box = document.createElement("div");
    box.className = "hv-plate-selected";
    box.innerHTML = [
      '<div class="hv-plate-selected__title">Geselecteerd voertuig</div>',
      `<div class="hv-plate-selected__name">${formatCandidate(vehicle)}</div>`,
    ].join("");
    container.appendChild(box);
  }

  async function handleSelection(vehicle, plate, elements) {
    saveSelection(plate, vehicle);
    renderSelected(elements.selected, vehicle);
    setStatus(elements.status, "Voertuig gevonden.");
    await loadItemsForVehicle(vehicle, plate);
  }

  function mount(container, options) {
    const target = typeof container === "string" ? document.querySelector(container) : container;
    if (!target) return null;

    target.innerHTML = [
      '<div class="hv-plate-widget">',
      '  <form class="hv-plate-form" autocomplete="off">',
      '    <input class="hv-plate-input" type="text" placeholder="28NJN7" />',
      '    <button class="hv-plate-submit" type="submit">Zoek</button>',
      "  </form>",
      '  <div class="hv-plate-status" role="status" aria-live="polite"></div>',
      '  <div class="hv-plate-selected-slot"></div>',
      '  <div class="hv-plate-results"></div>',
      "</div>",
    ].join("");

    const form = target.querySelector(".hv-plate-form");
    const input = target.querySelector(".hv-plate-input");
    const status = target.querySelector(".hv-plate-status");
    const selected = target.querySelector(".hv-plate-selected-slot");
    const results = target.querySelector(".hv-plate-results");

    const existing = getSelected();
    if (existing.vehicle) {
      renderSelected(selected, existing.vehicle);
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      setStatus(status, "");
      results.innerHTML = "";

      const plate = normalizePlate(input.value);
      if (!isValidPlate(plate)) {
        setStatus(status, "Voer een geldig kenteken in.", true);
        return;
      }

      setLoading(form, true);
      setStatus(status, "Bezig met ophalen...");

      try {
        const data = await lookupPlate(plate);
        const candidates = Array.isArray(data.vehicleCandidates) ? data.vehicleCandidates : [];
        if (!candidates.length) {
          setStatus(status, "Geen voertuig gevonden voor dit kenteken.", true);
          return;
        }
        if (candidates.length === 1) {
          await handleSelection(candidates[0], plate, { selected, status });
          results.innerHTML = "";
          return;
        }

        renderCandidatePicker(results, plate, candidates, async (selection) => {
          await handleSelection(selection, plate, { selected, status });
          results.innerHTML = "";
        });
        setStatus(status, "Meerdere voertuigen gevonden.");
      } catch (err) {
        if (err.code === "rate_limited") {
          setStatus(status, "Wacht even en probeer opnieuw.", true);
        } else {
          setStatus(status, "Fout bij het ophalen. Probeer later opnieuw.", true);
        }
      } finally {
        setLoading(form, false);
      }
    });

    return {
      reloadConfig: () => reloadConfig(),
    };
  }

  async function reloadConfig() {
    clearConfigCache();
    return loadConfig(true);
  }

  window.HVPlate = {
    mount,
    lookupPlate,
    getSelected,
    clear: clearSelected,
    reloadConfig,
    normalizeItem,
    collectItemsFromMenuparts,
  };
})();
