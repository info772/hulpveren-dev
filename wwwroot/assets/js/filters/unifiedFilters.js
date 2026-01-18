(() => {
  "use strict";

  const toNum = (value) => {
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? n : null;
  };

  const normalizeEngine = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");

  const engineMatches = (query, candidate) => {
    const q = normalizeEngine(query);
    const c = normalizeEngine(candidate);
    if (!q) return true;
    if (!c) return false;
    return c.includes(q);
  };

  const getCards = (pageType) => {
    if (pageType === "hv") {
      return Array.from(document.querySelectorAll("#model-grid .card.product"));
    }
    return Array.from(
      document.querySelectorAll("#nr-grid .card.product, #ls-grid .card.product")
    );
  };

  const extractRecordFromCard = (card) => {
    const ds = card.dataset || {};
    const yearFrom = toNum(ds.yearFrom);
    const yearTo = toNum(ds.yearTo);
    const drive =
      ds.drive && ds.drive.trim()
        ? ds.drive
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
    const rear =
      ds.rear && ds.rear.trim()
        ? ds.rear
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
    return {
      sku: ds.sku || "",
      yearFrom,
      yearTo,
      engine: ds.engine || "",
      pos: ds.pos || "",
      support: ds.support || "",
      drive,
      rear,
      approval: ds.approval || "",
      dropKey: ds.drop || "",
      dropFront: toNum(ds.dropFront),
      dropRear: toNum(ds.dropRear),
    };
  };

  const parseStateFromUI = (pageType) => {
    const state = {
      yearFrom: null,
      yearTo: null,
      yearExact: null,
      engineQuery: "",
      pos: new Set(),
      support: new Set(),
      drive: new Set(),
      rear: new Set(),
      approval: new Set(),
      dropKey: "",
      dropFrontMin: null,
      dropRearMin: null,
    };

    if (pageType === "hv") {
      const yearSlider = document.getElementById("flt-year");
      const yearFrom = document.getElementById("flt-year-from");
      const yearTo = document.getElementById("flt-year-to");
      const yearVal = toNum(yearSlider && yearSlider.value);
      state.yearFrom = toNum(yearFrom && yearFrom.value);
      state.yearTo = toNum(yearTo && yearTo.value);
      state.yearExact =
        state.yearFrom != null || state.yearTo != null ? null : yearVal;

      document.querySelectorAll("#mode-chips .chip[data-on='1']").forEach((chip) => {
        const key = chip.getAttribute("data-key");
        if (key) state.support.add(key);
      });
      document.querySelectorAll("#drive-chips .chip[data-on='1']").forEach((chip) => {
        const key = chip.getAttribute("data-key");
        if (key) state.drive.add(key);
      });
      document.querySelectorAll("#rear-chips .chip[data-on='1']").forEach((chip) => {
        const key = chip.getAttribute("data-key");
        if (key) state.rear.add(key);
      });
      document.querySelectorAll("#pos-chips .chip[data-on='1']").forEach((chip) => {
        const key = chip.getAttribute("data-key");
        if (key) state.pos.add(key);
      });
      return state;
    }

    const yearSlider =
      document.getElementById("nr-year-slider") ||
      document.getElementById("ls-year-slider");
    const yearFrom =
      document.getElementById("nr-year-from") ||
      document.getElementById("ls-year-from");
    const yearTo =
      document.getElementById("nr-year-to") ||
      document.getElementById("ls-year-to");

    state.yearExact = toNum(yearSlider && yearSlider.value);
    if (state.yearExact === 0) state.yearExact = null;
    state.yearFrom = toNum(yearFrom && yearFrom.value);
    state.yearTo = toNum(yearTo && yearTo.value);
    if (state.yearFrom != null || state.yearTo != null) {
      state.yearExact = null;
    }

    const engineInput =
      document.getElementById("ls-engine") || document.getElementById("nr-engine");
    state.engineQuery = engineInput ? String(engineInput.value || "").trim() : "";

    const dropSelect = document.getElementById("ls-drop");
    if (dropSelect && dropSelect.value) state.dropKey = dropSelect.value;

    const dropFront =
      document.getElementById("ls-drop-front") ||
      document.getElementById("nr-drop-front");
    const dropRear =
      document.getElementById("ls-drop-rear") ||
      document.getElementById("nr-drop-rear");
    state.dropFrontMin = toNum(dropFront && dropFront.value);
    state.dropRearMin = toNum(dropRear && dropRear.value);

    document.querySelectorAll(".nr-pos:checked, .ls-pos:checked").forEach((box) => {
      const value = box.value;
      if (value) state.pos.add(value.toLowerCase());
    });
    document.querySelectorAll(".nr-appr:checked").forEach((box) => {
      const value = box.value;
      if (value) state.approval.add(value.toLowerCase());
    });
    return state;
  };

  const matchRecord = (record, state, pageType) => {
    const y1 = record.yearFrom ?? 0;
    const y2 = record.yearTo ?? new Date().getFullYear();

    if (state.yearExact != null) {
      if (state.yearExact < y1 || state.yearExact > y2) return false;
    } else {
      if (state.yearFrom != null && state.yearFrom > y2) return false;
      if (state.yearTo != null && state.yearTo < y1) return false;
    }

    if (pageType !== "hv") {
      if (state.engineQuery) {
        if (!engineMatches(state.engineQuery, record.engine)) return false;
      }
      if (state.dropKey && record.dropKey !== state.dropKey) return false;
      if (state.dropFrontMin != null) {
        if (record.dropFront == null || record.dropFront < state.dropFrontMin)
          return false;
      }
      if (state.dropRearMin != null) {
        if (record.dropRear == null || record.dropRear < state.dropRearMin)
          return false;
      }
      if (state.pos.size && !state.pos.has(String(record.pos || "").toLowerCase()))
        return false;
      if (
        state.approval.size &&
        !state.approval.has(String(record.approval || "").toLowerCase())
      )
        return false;
      return true;
    }

    if (state.support.size && !state.support.has(record.support)) return false;
    if (state.pos.size && !state.pos.has(record.pos)) return false;
    if (state.drive.size) {
      if (!record.drive || !record.drive.length) {
        // no drive metadata on record; allow
      } else {
      const allow = new Set(record.drive || []);
      let ok = false;
      state.drive.forEach((wanted) => {
        if (allow.has(wanted)) ok = true;
      });
        if (!ok) return false;
      }
    }
    if (state.rear.size) {
      if (!record.rear || !record.rear.length) {
        // no rear metadata on record; allow
      } else {
      const allow = new Set(record.rear || []);
      let ok = false;
      state.rear.forEach((wanted) => {
        if (allow.has(wanted)) ok = true;
      });
        if (!ok) return false;
      }
    }
    return true;
  };

  const computeFacets = (records) => {
    const facets = {
      yearMin: null,
      yearMax: null,
      pos: new Set(),
      support: new Set(),
      drive: new Set(),
      rear: new Set(),
      approval: new Set(),
      dropKeys: new Set(),
    };
    records.forEach((record) => {
      if (record.yearFrom != null) {
        facets.yearMin =
          facets.yearMin == null ? record.yearFrom : Math.min(facets.yearMin, record.yearFrom);
      }
      if (record.yearTo != null) {
        facets.yearMax =
          facets.yearMax == null ? record.yearTo : Math.max(facets.yearMax, record.yearTo);
      }
      if (record.pos) facets.pos.add(record.pos);
      if (record.support) facets.support.add(record.support);
      (record.drive || []).forEach((d) => facets.drive.add(d));
      (record.rear || []).forEach((r) => facets.rear.add(r));
      if (record.approval) facets.approval.add(record.approval.toLowerCase());
      if (record.dropKey) facets.dropKeys.add(record.dropKey);
    });
    return facets;
  };

  const updateSelectOptions = (selectEl, options, available, placeholder) => {
    if (!selectEl) return false;
    const current = selectEl.value || "";
    const list = options.filter(([value]) => available.has(value));
    const optionsHtml = list
      .map(([value, label]) => `<option value="${value}">${label}</option>`)
      .join("");
    selectEl.innerHTML = `<option value="">${placeholder}</option>${optionsHtml}`;
    if (current && list.some(([value]) => value === current)) {
      selectEl.value = current;
      return false;
    }
    if (current) {
      selectEl.value = "";
      return true;
    }
    return false;
  };

  const updateUIOptions = (facets, state, pageType, cards) => {
    let stateChanged = false;

    if (pageType === "hv") {
      document.querySelectorAll("#mode-chips .chip").forEach((chip) => {
        const key = chip.getAttribute("data-key");
        const enabled = key && facets.support.has(key);
        chip.toggleAttribute("data-disabled", !enabled);
        if (!enabled && chip.getAttribute("data-on") === "1") {
          chip.setAttribute("data-on", "0");
          state.support.delete(key);
          stateChanged = true;
        }
      });
      document.querySelectorAll("#drive-chips .chip").forEach((chip) => {
        const key = chip.getAttribute("data-key");
        const enabled = key && facets.drive.has(key);
        chip.toggleAttribute("data-disabled", !enabled);
        if (!enabled && chip.getAttribute("data-on") === "1") {
          chip.setAttribute("data-on", "0");
          state.drive.delete(key);
          stateChanged = true;
        }
      });
      document.querySelectorAll("#rear-chips .chip").forEach((chip) => {
        const key = chip.getAttribute("data-key");
        const enabled = key && facets.rear.has(key);
        chip.toggleAttribute("data-disabled", !enabled);
        if (!enabled && chip.getAttribute("data-on") === "1") {
          chip.setAttribute("data-on", "0");
          state.rear.delete(key);
          stateChanged = true;
        }
      });
      document.querySelectorAll("#pos-chips .chip").forEach((chip) => {
        const key = chip.getAttribute("data-key");
        const enabled = key && facets.pos.has(key);
        chip.toggleAttribute("data-disabled", !enabled);
        if (!enabled && chip.getAttribute("data-on") === "1") {
          chip.setAttribute("data-on", "0");
          state.pos.delete(key);
          stateChanged = true;
        }
      });

      const yearSlider = document.getElementById("flt-year");
      if (yearSlider && facets.yearMin != null && facets.yearMax != null) {
        yearSlider.min = String(facets.yearMin);
        yearSlider.max = String(facets.yearMax);
        const v = toNum(yearSlider.value);
        if (v != null && (v < facets.yearMin || v > facets.yearMax)) {
          yearSlider.value = String(facets.yearMin);
          state.yearExact = facets.yearMin;
          stateChanged = true;
        }
      }
      return { stateChanged, newState: state };
    }

    const engineSelect = document.getElementById("ls-engine");
    const dropSelect = document.getElementById("ls-drop");

    if (engineSelect && engineSelect.tagName === "SELECT") {
      const options = Array.from(engineSelect.options)
        .filter((opt) => opt.value)
        .map((opt) => [opt.value, opt.textContent || opt.value]);
      const available = new Set();
      options.forEach(([value]) => {
        if (cards.some((card) => engineMatches(value, card.dataset.engine || ""))) {
          available.add(value);
        }
      });
      if (updateSelectOptions(engineSelect, options, available, "Alle motoren")) {
        state.engineQuery = "";
        stateChanged = true;
      }
    }

    if (dropSelect) {
      const options = Array.from(dropSelect.options)
        .filter((opt) => opt.value)
        .map((opt) => [opt.value, opt.textContent || opt.value]);
      if (updateSelectOptions(dropSelect, options, facets.dropKeys, "Alle verlagingen")) {
        state.dropKey = "";
        stateChanged = true;
      }
    }

    document.querySelectorAll(".nr-pos, .ls-pos").forEach((box) => {
      const value = box.value.toLowerCase();
      const enabled = facets.pos.has(value);
      box.disabled = !enabled;
      if (!enabled && box.checked) {
        box.checked = false;
        state.pos.delete(value);
        stateChanged = true;
      }
    });

    document.querySelectorAll(".nr-appr").forEach((box) => {
      const value = box.value.toLowerCase();
      const enabled = facets.approval.has(value);
      box.disabled = !enabled;
      if (!enabled && box.checked) {
        box.checked = false;
        state.approval.delete(value);
        stateChanged = true;
      }
    });

    const yearSlider =
      document.getElementById("nr-year-slider") ||
      document.getElementById("ls-year-slider");
    if (yearSlider && facets.yearMin != null && facets.yearMax != null) {
      yearSlider.min = String(facets.yearMin);
      yearSlider.max = String(facets.yearMax);
      const v = toNum(yearSlider.value);
      if (v != null && v !== 0 && (v < facets.yearMin || v > facets.yearMax)) {
        yearSlider.value = "0";
        state.yearExact = null;
        stateChanged = true;
      }
    }

    return { stateChanged, newState: state };
  };

  const renderVisibility = (cards, records) => {
    const visible = new Set(records.map((r) => r.__card));
    cards.forEach((card) => {
      card.style.display = visible.has(card) ? "" : "none";
    });
  };

  const updateResultCount = (count, pageType) => {
    if (pageType === "hv") {
      const countEl = document.getElementById("kit-count");
      if (countEl) countEl.textContent = String(count);
      const summaryEl = document.getElementById("filter-summary");
      if (summaryEl) summaryEl.textContent = `gevonden: ${count} sets`;
      return;
    }
    const countEl =
      document.getElementById("nr-count") || document.getElementById("ls-count");
    if (countEl) countEl.textContent = String(count);
  };

  const initUnifiedFilters = (pageType) => {
    const cards = getCards(pageType);
    if (!cards.length) return;
    let isInternalUpdate = false;

    const run = () => {
      if (isInternalUpdate) return;
      const state = parseStateFromUI(pageType);
      const records = cards.map((card) => {
        const record = extractRecordFromCard(card);
        record.__card = card;
        return record;
      });
      let visible = records.filter((r) => matchRecord(r, state, pageType));
      let facets = computeFacets(visible);
      isInternalUpdate = true;
      const result = updateUIOptions(facets, state, pageType, cards);
      isInternalUpdate = false;
      if (result.stateChanged) {
        const nextState = result.newState;
        visible = records.filter((r) => matchRecord(r, nextState, pageType));
        facets = computeFacets(visible);
        isInternalUpdate = true;
        updateUIOptions(facets, nextState, pageType, cards);
        isInternalUpdate = false;
      }
      renderVisibility(cards, visible);
      updateResultCount(visible.length, pageType);
    };

    const bind = (selector, evt = "change") => {
      document.querySelectorAll(selector).forEach((el) => {
        el.addEventListener(evt, () => {
          if (!isInternalUpdate) run();
        });
      });
    };

    if (pageType === "hv") {
      const yearSlider = document.getElementById("flt-year");
      if (yearSlider) {
        yearSlider.addEventListener("input", () => {
          if (isInternalUpdate) return;
          const card =
            yearSlider.closest(".fy") || yearSlider.closest(".filter-card");
          const pickedEl = card ? card.querySelector("[data-fy-picked]") : null;
          const val = toNum(yearSlider.value);
          if (pickedEl) {
            if (val == null) {
              pickedEl.hidden = true;
              pickedEl.textContent = "";
            } else {
              pickedEl.hidden = false;
              pickedEl.textContent = ` ${val}`;
            }
          }
          run();
        });
      }
      bind("#flt-year-from", "input");
      bind("#flt-year-to", "input");
      ["#mode-chips", "#drive-chips", "#rear-chips", "#pos-chips"].forEach(
        (sel) => {
          const wrap = document.querySelector(sel);
          if (!wrap) return;
          wrap.addEventListener("click", (event) => {
            const chip = event.target.closest(".chip");
            if (!chip || chip.hasAttribute("data-disabled")) return;
            const on = chip.getAttribute("data-on") === "1";
            chip.setAttribute("data-on", on ? "0" : "1");
            run();
          });
        }
      );
    } else {
      bind("#nr-year-slider, #ls-year-slider", "input");
      bind("#nr-year-from, #ls-year-from", "input");
      bind("#nr-year-to, #ls-year-to", "input");
      bind("#ls-engine, #nr-engine", "input");
      bind("#ls-engine, #nr-engine", "change");
      bind("#ls-drop", "change");
      bind(".nr-pos, .ls-pos", "change");
      bind(".nr-appr", "change");
      bind("#nr-apply, #ls-apply", "click");
      const resetBtn =
        document.getElementById("nr-reset") || document.getElementById("ls-reset");
      if (resetBtn) {
        resetBtn.addEventListener("click", () => {
          if (isInternalUpdate) return;
          [
            "nr-year-from",
            "ls-year-from",
            "nr-year-to",
            "ls-year-to",
            "nr-engine",
            "ls-engine",
            "ls-drop",
            "nr-year-slider",
            "ls-year-slider",
            "ls-drop-front",
            "ls-drop-rear",
          ].forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            if (el.tagName === "SELECT") el.value = "";
            else if (el.type === "range") el.value = "0";
            else el.value = "";
          });
          document
            .querySelectorAll(".nr-pos, .ls-pos, .nr-appr")
            .forEach((box) => {
              box.checked = false;
            });
          run();
        });
      }
    }

    run();
  };

  window.UnifiedFilters = {
    init: initUnifiedFilters,
    parseStateFromUI,
    getCards,
    extractRecordFromCard,
    matchRecord,
    computeFacets,
    updateUIOptions,
    renderVisibility,
  };
})();
