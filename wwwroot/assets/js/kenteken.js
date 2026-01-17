// Kentekenzoeker voor dev.hulpveren.shop
// Probeert via de Aldoc-proxy voertuiginfo op te halen en matcht sets uit hv/nr/ls data.

(function () {
  const FORM = document.getElementById("hv-plate-form");
  if (!FORM) return;

  const INPUT = document.getElementById("hv-plate-input");
  const STATUS = document.getElementById("hv-plate-status");
  const RESULTS = document.getElementById("hv-plate-results");

  // Aanpassen indien de proxy op een ander pad draait
  const PROXY_BASE = "/aldoc-proxy";
  // Aanpassen aan het juiste pad/endpoint zodra bekend
  const KENTEKEN_ENDPOINT = (plate) =>
    `${PROXY_BASE}/PartServices/${encodeURIComponent(plate)}`;
  // NEW: proxyv7 endpoint dat SKUs/sets teruggeeft voor deze plate + intent
  // Pas dit pad aan naar jouw echte proxy route als hij anders heet.
  const KENTEKEN_SETS_ENDPOINT = (plate, intentType) =>
    `${PROXY_BASE}/v7/sets?plate=${encodeURIComponent(plate)}&intent=${encodeURIComponent(
      intentType || ""
    )}`;

  const DATA_HV = "/data/hv-kits.json";
  const DATA_NR = "/data/nr-kits.json";
  const DATA_LS = "/data/ls-kits.json";
  function inferIntentTypeFromPath() {
    const p = String(location.pathname || "").toLowerCase();
    if (p.startsWith("/verlagingsveren")) return "ls";
    if (p.startsWith("/luchtvering")) return "nr";
    if (p.startsWith("/hulpveren")) return "hv";
    return "hv";
  }

  const slugify = (s) =>
    String(s || "")
      .trim()
      .toLowerCase()
      .replace(/ç/g, "c")
      .replace(/ë/g, "e")
      .replace(/ï/g, "i")
      .replace(/ö/g, "o")
      .replace(/ü/g, "u")
      .replace(/á|à|ä|â/g, "a")
      .replace(/é|è|ê|ë/g, "e")
      .replace(/í|ì|î|ï/g, "i")
      .replace(/ó|ò|ô|ö/g, "o")
      .replace(/ú|ù|û|ü/g, "u")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  function setStatus(msg, isError = false) {
    if (STATUS) {
      STATUS.textContent = msg || "";
      STATUS.style.color = isError ? "#c0392b" : "";
    }
  }

  async function fetchJson(url, fallback) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(res.statusText);
      return await res.json();
    } catch (e) {
      return fallback;
    }
  }

  function indexKitsBySku(list) {
    const map = new Map();
    (list || []).forEach((kit) => {
      const sku = String(kit?.sku || "").trim().toUpperCase();
      if (!sku) return;
      map.set(sku, kit);
    });
    return map;
  }

  function pickFamilyData(intentType, datasets) {
    if (intentType === "ls") return { basePath: "/verlagingsveren", data: datasets.ls };
    if (intentType === "nr") return { basePath: "/luchtvering", data: datasets.nr };
    return { basePath: "/hulpveren", data: datasets.hv };
  }

  function matchSetsBySku(intentType, skuList, datasets) {
    const { basePath, data } = pickFamilyData(intentType, datasets);
    const kitMap = indexKitsBySku(data?.kits || []);

    const matches = [];
    for (const s of skuList || []) {
      const sku = String(s || "").trim().toUpperCase();
      const kit = kitMap.get(sku);
      if (!kit) continue;

      matches.push({
        family: basePath,
        sku,
        title: `${sku}`,
        url: `${basePath}/${sku.toLowerCase()}/`,
      });
    }
    return matches;
  }

  function extractSkusFromProxy(raw, intentType) {
    const out = new Set();

    const add = (v) => {
      const sku = String(v || "").trim();
      if (sku) out.add(sku.toUpperCase());
    };

    (raw?.skus || raw?.kits || raw?.items || raw?.results || []).forEach((x) => {
      if (typeof x === "string") add(x);
      else add(x?.sku || x?.SKU || x?.code);
    });

    const key =
      intentType === "ls" ? "lsSkus" : intentType === "nr" ? "nrSkus" : "hvSkus";

    (raw?.[key] || raw?.sets?.[key] || raw?.aldocSets?.[key] || []).forEach(add);

    (raw?.matches || raw?.matchedItems || []).forEach((x) => add(x?.sku || x));

    return Array.from(out);
  }

  function renderMatches(vehicle, matches) {
    if (!RESULTS) return;
    RESULTS.innerHTML = "";
    if (!matches.length) {
      RESULTS.innerHTML =
        '<div class="card"><p>Geen sets gevonden voor dit kenteken. Neem contact op voor handmatige selectie.</p></div>';
      return;
    }
    matches.forEach((m) => {
      const card = document.createElement("article");
      card.className = "card product";
      card.innerHTML = `
        <div class="body">
          <div class="sku">${m.sku || ""}</div>
          <div class="meta">
            <div class="k">Auto</div><div class="v">${vehicle.make} ${vehicle.model}</div>
          </div>
          <div class="cta-row">
            <a class="btn" href="${m.url}">Bekijk set</a>
            <a class="btn btn-ghost" href="/contact?onderwerp=${encodeURIComponent(
              m.sku || ""
            )}">Plan montage</a>
          </div>
        </div>
      `;
      RESULTS.appendChild(card);
    });
  }

  FORM.addEventListener("submit", async (e) => {
    e.preventDefault();

    const plateRaw = (INPUT?.value || "").replace(/[^A-Za-z0-9]/g, "");
    if (!plateRaw) {
      setStatus("Voer een geldig kenteken in.", true);
      return;
    }
    setStatus("Bezig met opzoeken…");
    RESULTS.innerHTML = "";

    const intentType = inferIntentTypeFromPath();

    // Fetch vehicle info via proxy
    const vehicle = await fetchJson(KENTEKEN_ENDPOINT(plateRaw), null);
    if (!vehicle || !vehicle.make || !vehicle.model) {
      setStatus("Geen voertuig gevonden. Controleer het kenteken.", true);
      return;
    }

    const rawSets = await fetchJson(
      KENTEKEN_SETS_ENDPOINT(plateRaw, intentType),
      null
    );

    console.log("Debug (kenteken)", "\nKeys:", Object.keys(rawSets || {}));
    console.log("Debug (kenteken) raw sample:", rawSets);

    const skus = extractSkusFromProxy(rawSets, intentType);

    // Load datasets
    const [hv, nr, ls] = await Promise.all([
      fetchJson(DATA_HV, {}),
      fetchJson(DATA_NR, {}),
      fetchJson(DATA_LS, {}),
    ]);

    const matches = matchSetsBySku(intentType, skus, { hv, nr, ls });
    renderMatches(vehicle, matches);

    if (!matches.length) {
      setStatus(
        `Geen set gevonden op kenteken (${vehicle.make} ${vehicle.model}). Toon merk/model selectie.`,
        true
      );
      const makeSlug = slugify(vehicle.make);
      const modelSlug = slugify(vehicle.model.split("(")[0]);
      // location.href = `/${intentType === "ls" ? "verlagingsveren" : intentType === "nr" ? "luchtvering" : "hulpveren"}/${makeSlug}/${modelSlug}/`;
      return;
    }

    setStatus(`Gevonden: ${vehicle.make} ${vehicle.model}`);
  });
})();
