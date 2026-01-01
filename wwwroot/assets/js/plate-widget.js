(function () {
  const STORAGE_KEYS = {
    plate: "hv_plate",
    vehicle: "hv_vehicle_selected",
    selectedAt: "hv_vehicle_selected_at",
  };

  function normalizePlate(value) {
    return String(value || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  }

  function isValidPlate(value) {
    return String(value || "").length >= 6;
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

  function saveSelection(plate, vehicle) {
    storageSet(STORAGE_KEYS.plate, plate);
    storageSet(STORAGE_KEYS.vehicle, JSON.stringify(vehicle));
    storageSet(STORAGE_KEYS.selectedAt, String(Date.now()));
  }

  function getSelection() {
    const plate = storageGet(STORAGE_KEYS.plate);
    const vehicle = storageGetJson(STORAGE_KEYS.vehicle);
    const selectedAt = storageGet(STORAGE_KEYS.selectedAt);
    return { plate, vehicle, selectedAt };
  }

  function clearSelection() {
    storageRemove(STORAGE_KEYS.plate);
    storageRemove(STORAGE_KEYS.vehicle);
    storageRemove(STORAGE_KEYS.selectedAt);
  }

  function emit(name, detail) {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }

  async function fetchJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      const err = new Error("request_failed");
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  async function lookupPlate(plate) {
    const normalized = normalizePlate(plate);
    if (!isValidPlate(normalized)) {
      const err = new Error("invalid_plate");
      err.code = "invalid_plate";
      throw err;
    }
    return fetchJson(`/api/plate/${encodeURIComponent(normalized)}`);
  }

  function candidateLabel(candidate) {
    if (!candidate) return "Onbekend";
    const make = candidate.make || candidate.makename || "";
    const model = candidate.model || candidate.modelname || "";
    const type = candidate.type || candidate.typename || "";
    const from = candidate.typeFrom || candidate.type_from || "";
    const till = candidate.typeTill || candidate.type_till || "";
    const years = from || till ? `${from}-${till || ""}` : "";
    const base = [make, model, type].filter(Boolean).join(" ");
    return years ? `${base} (${years})` : base || "Onbekend";
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

  function renderCandidatePicker(container, candidates, onPick) {
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

  function finalizeSelection(plate, vehicle, data, elements) {
    if (!vehicle) return;
    saveSelection(plate, vehicle);
    if (elements && elements.results) {
      renderSelected(elements.results, vehicle);
    }
    if (elements && elements.status) {
      setStatus(elements.status, "Voertuig gevonden.");
    }
    emit("hv:vehicleSelected", {
      plate,
      vehicle,
      source: (data && data.source) || "api",
    });
  }

  function mount(target) {
    const container = typeof target === "string" ? document.querySelector(target) : target;
    if (!container) return null;

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

    const form = container.querySelector(".hv-plate-form");
    const input = container.querySelector(".hv-plate-input");
    const status = container.querySelector(".hv-plate-status");
    const results = container.querySelector(".hv-plate-results");

    const existing = getSelection();
    if (existing && existing.vehicle) {
      renderSelected(results, existing.vehicle);
      if (existing.plate) input.value = existing.plate;
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      setStatus(status, "");
      results.innerHTML = "";

      const normalized = normalizePlate(input.value);
      if (!isValidPlate(normalized)) {
        setStatus(status, "Ongeldig kenteken", true);
        return;
      }

      emit("hv:plateLookup", { plate: normalized });
      setLoading(form, true);
      setStatus(status, "Bezig met ophalen...");

      try {
        const data = await lookupPlate(normalized);
        const candidates = Array.isArray(data.vehicleCandidates)
          ? data.vehicleCandidates
          : Array.isArray(data.candidates)
            ? data.candidates
            : [];

        emit("hv:plateResult", {
          plate: normalized,
          candidates,
          source: data.source || "api",
        });

        if (!candidates.length) {
          setStatus(status, "Geen voertuig gevonden voor dit kenteken.", true);
          return;
        }

        if (candidates.length === 1) {
          finalizeSelection(normalized, candidates[0], data, { results, status });
          return;
        }

        renderCandidatePicker(results, candidates, (selection) => {
          finalizeSelection(normalized, selection, data, { results, status });
        });
        setStatus(status, "Meerdere voertuigen gevonden.");
      } catch (err) {
        let message = "Kentekenservice tijdelijk niet bereikbaar";
        if (err && (err.code === "invalid_plate" || err.status === 400)) {
          message = "Ongeldig kenteken";
        } else if (err && err.status === 429) {
          message = "Te veel verzoeken, probeer zo opnieuw";
        }
        setStatus(status, message, true);
      } finally {
        setLoading(form, false);
      }
    });

    return {
      destroy() {
        container.innerHTML = "";
      },
    };
  }

  window.HVPlateWidget = {
    mount,
    normalizePlate,
    getSelected: getSelection,
    clear: clearSelection,
  };
})();
