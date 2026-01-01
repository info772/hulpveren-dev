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

  const DATA_HV = "/data/hv-kits.json";
  const DATA_NR = "/data/nr-kits.json";
  const DATA_LS = "/data/ls-kits.json";

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

  function matchSets(vehicle, datasets) {
    const make = slugify(vehicle.make);
    const model = slugify(vehicle.model);
    if (!make || !model) return [];

    const matches = [];
    const { hv, nr, ls } = datasets;
    const add = (family, sku, title, url) =>
      matches.push({
        family,
        sku,
        title,
        url,
      });

    function scan(list, basePath) {
      (list || []).forEach((kit) => {
        (kit.fitments || []).forEach((f) => {
          if (slugify(f.make) === make && slugify(f.model) === model) {
            add(
              basePath,
              kit.sku,
              `${f.make} ${f.model} (${kit.sku})`,
              `${basePath}/${kit.sku.toLowerCase()}/`
            );
          }
        });
      });
    }

    scan(hv?.kits || [], "/hulpveren");
    scan(nr?.kits || [], "/luchtvering");
    scan(ls?.kits || [], "/verlagingsveren");
    return matches;
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

    // Fetch vehicle info via proxy
    const vehicle = await fetchJson(KENTEKEN_ENDPOINT(plateRaw), null);
    if (!vehicle || !vehicle.make || !vehicle.model) {
      setStatus("Geen voertuig gevonden. Controleer het kenteken.", true);
      return;
    }

    // Load datasets
    const [hv, nr, ls] = await Promise.all([
      fetchJson(DATA_HV, {}),
      fetchJson(DATA_NR, {}),
      fetchJson(DATA_LS, {}),
    ]);

    const matches = matchSets(vehicle, { hv, nr, ls });
    renderMatches(vehicle, matches);
    setStatus(`Gevonden: ${vehicle.make} ${vehicle.model}`);
  });
})();
