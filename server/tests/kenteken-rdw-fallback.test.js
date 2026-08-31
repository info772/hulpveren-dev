const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const pagePath = path.resolve(__dirname, "../../wwwroot/kenteken/index.html");

function extractRdwPreviewScript() {
  const html = fs.readFileSync(pagePath, "utf8");
  const scripts = Array.from(html.matchAll(/<script>\s*(\(function \(\) \{[\s\S]*?\}\)\(\);)\s*<\/script>/g));
  const match = scripts.find((script) => script[1].includes("function applyAldocLinks"));
  assert.ok(match, "current kenteken RDW preview script should be present");
  return match[1];
}

const movanoFitments = {
  kits: [
    {
      fitments: [
        {
          platform_codes: ["A (X70)"],
          year_from: "07-1998",
          year_to: "05-2010",
        },
        {
          platform_codes: ["B (X62)"],
          year_from: "05-2010",
          year_to: "07-2021",
        },
        {
          platform_codes: ["C (U9)"],
          year_from: "07-2021",
          year_to: "",
        },
      ],
    },
  ],
};

function createHarness({
  existingRoutes = [],
  fitmentResponses = {},
  solutionsResponse,
  solutionsOk = true,
} = {}) {
  const elements = new Map();
  const cards = new Map();
  const element = (id) => {
    if (!elements.has(id)) {
      const card = { style: { display: "none" } };
      cards.set(id, card);
      elements.set(id, {
        href: "#",
        style: { display: "none" },
        textContent: "",
        closest(selector) {
          return selector === "article.card" ? cards.get(id) : null;
        },
      });
    }
    return elements.get(id);
  };
  const routes = new Set(existingRoutes);
  const fetchCalls = [];
  const sandbox = {
    console,
    Date,
    URL,
    URLSearchParams,
    document: {
      readyState: "complete",
      addEventListener() {},
      getElementById: element,
    },
    fetch: async (url, options = {}) => {
      const key = String(url);
      fetchCalls.push({ url: key, method: options.method || "GET" });
      if (key.startsWith("/api/plate/solutions/")) {
        return {
          ok: solutionsOk,
          status: solutionsOk ? 200 : 500,
          json: async () => solutionsResponse || { solutions: {} },
        };
      }
      if (Object.prototype.hasOwnProperty.call(fitmentResponses, key)) {
        return {
          ok: true,
          status: 200,
          json: async () => fitmentResponses[key],
        };
      }
      return {
        ok: routes.has(key),
        status: routes.has(key) ? 200 : 404,
        json: async () => ({}),
      };
    },
    location: {
      origin: "https://dev.hulpveren.shop",
      pathname: "/kenteken/",
      search: "",
    },
    sessionStorage: { setItem() {} },
    setTimeout,
  };
  sandbox.window = sandbox;
  vm.runInNewContext(extractRdwPreviewScript(), sandbox);
  return { cards, elements, fetchCalls, sandbox };
}

test("current kenteken flow keeps Aldoc solution cards and URLs leading", async () => {
  const { cards, elements, sandbox } = createHarness({
    solutionsResponse: {
      solutions: {
        hulpveren: { available: true, url: "/aldoc/hv/S153XL" },
        luchtvering: { available: true, url: "/aldoc/nr/S153XL" },
        verlagingsveren: { available: false },
      },
    },
  });

  await sandbox.HVKentekenRdwPreview.applyAldocLinks("S153XL", {
    make: "Opel",
    model: "Movano",
    year: 2020,
  });

  assert.equal(cards.get("kenteken-link-hv").style.display, "");
  assert.equal(cards.get("kenteken-link-nr").style.display, "");
  assert.equal(cards.get("kenteken-link-ls").style.display, "none");
  assert.equal(elements.get("kenteken-link-hv").href, "/aldoc/hv/S153XL");
  assert.equal(elements.get("kenteken-link-nr").href, "/aldoc/nr/S153XL");
  assert.match(elements.get("kenteken-status").textContent, /Beschikbare oplossingen: Hulpveren, Luchtvering\./);
});

test("current kenteken flow preserves Aldoc success when RDW preview finishes later", async () => {
  const { cards, elements, sandbox } = createHarness({
    solutionsResponse: {
      solutions: {
        hulpveren: { available: true, url: "/aldoc/hv/S153XL" },
        luchtvering: { available: false },
        verlagingsveren: { available: true, url: "/aldoc/ls/S153XL" },
      },
    },
  });

  await sandbox.HVKentekenRdwPreview.applyAldocLinks("S153XL", null);
  const statusAfterAldoc = elements.get("kenteken-status").textContent;

  sandbox.HVKentekenRdwPreview.renderVehicle("S153XL", {
    make: "Opel",
    model: "Movano",
    year: 2020,
  });

  assert.equal(cards.get("kenteken-link-hv").style.display, "");
  assert.equal(cards.get("kenteken-link-nr").style.display, "none");
  assert.equal(cards.get("kenteken-link-ls").style.display, "");
  assert.equal(elements.get("kenteken-link-hv").href, "/aldoc/hv/S153XL");
  assert.equal(elements.get("kenteken-link-ls").href, "/aldoc/ls/S153XL");
  assert.equal(elements.get("kenteken-status").textContent, statusAfterAldoc);
  assert.match(elements.get("kenteken-vehicle").textContent, /Opel Movano/);
});

test("current kenteken flow uses unique Movano generation only when the product route exists", async () => {
  const { cards, elements, fetchCalls, sandbox } = createHarness({
    existingRoutes: [
      "/hulpveren/opel/movano/",
      "/hulpveren/opel/movano/movano-b/",
      "/luchtvering/opel/movano/",
      "/verlagingsveren/opel/",
    ],
    fitmentResponses: {
      "/data/fitments/opel/movano.json": movanoFitments,
    },
    solutionsResponse: { solutions: {} },
  });

  await sandbox.HVKentekenRdwPreview.applyAldocLinks("S153XL", {
    make: "Opel",
    model: "Movano",
    year: 2020,
  });

  assert.equal(cards.get("kenteken-link-hv").style.display, "");
  assert.equal(cards.get("kenteken-link-nr").style.display, "");
  assert.equal(cards.get("kenteken-link-ls").style.display, "none");
  assert.equal(elements.get("kenteken-link-hv").href, "/hulpveren/opel/movano/movano-b/?kt=S153XL");
  assert.equal(elements.get("kenteken-link-nr").href, "/luchtvering/opel/movano/?kt=S153XL");
  assert.notEqual(elements.get("kenteken-link-ls").href, "/verlagingsveren/opel/?kt=S153XL");
  assert.equal(
    fetchCalls.some((call) => call.url === "/verlagingsveren/opel/" && call.method === "HEAD"),
    false
  );
  assert.match(elements.get("kenteken-status").textContent, /geen exacte kentekenkoppeling beschikbaar/);
});

async function renderMovanoFallbackForYear(year) {
  const { elements, sandbox } = createHarness({
    existingRoutes: ["/hulpveren/opel/movano/", "/hulpveren/opel/movano/movano-b/"],
    fitmentResponses: {
      "/data/fitments/opel/movano.json": movanoFitments,
    },
    solutionsResponse: { solutions: {} },
  });

  await sandbox.HVKentekenRdwPreview.applyAldocLinks("S153XL", {
    make: "Opel",
    model: "Movano",
    year,
  });

  return elements.get("kenteken-link-hv").href;
}

test("current kenteken flow auto-selects unique Movano generation for RDW year 2012", async () => {
  assert.equal(
    await renderMovanoFallbackForYear(2012),
    "/hulpveren/opel/movano/movano-b/?kt=S153XL"
  );
});

test("current kenteken flow keeps model route when unique generation route does not exist", async () => {
  const { elements, sandbox } = createHarness({
    existingRoutes: ["/hulpveren/opel/movano/"],
    fitmentResponses: {
      "/data/fitments/opel/movano.json": movanoFitments,
    },
    solutionsResponse: { solutions: {} },
  });

  await sandbox.HVKentekenRdwPreview.applyAldocLinks("S153XL", {
    make: "Opel",
    model: "Movano",
    year: 2012,
  });

  assert.equal(elements.get("kenteken-link-hv").href, "/hulpveren/opel/movano/?kt=S153XL");
});

test("current kenteken flow does not auto-select Movano generation for overlapping RDW year 2010", async () => {
  assert.equal(
    await renderMovanoFallbackForYear(2010),
    "/hulpveren/opel/movano/?kt=S153XL"
  );
});

test("current kenteken flow does not auto-select Movano generation for overlapping RDW year 2021", async () => {
  assert.equal(
    await renderMovanoFallbackForYear(2021),
    "/hulpveren/opel/movano/?kt=S153XL"
  );
});

test("current kenteken flow does not auto-select generation when RDW year is outside all ranges", async () => {
  assert.equal(
    await renderMovanoFallbackForYear(1990),
    "/hulpveren/opel/movano/?kt=S153XL"
  );
});

test("current kenteken flow does not auto-select generation when RDW year is missing", async () => {
  assert.equal(
    await renderMovanoFallbackForYear(undefined),
    "/hulpveren/opel/movano/?kt=S153XL"
  );
});

test("current kenteken flow ignores yearMin for automatic generation selection", async () => {
  const { elements, sandbox } = createHarness({
    existingRoutes: ["/hulpveren/opel/movano/", "/hulpveren/opel/movano/movano-b/"],
    fitmentResponses: {
      "/data/fitments/opel/movano.json": movanoFitments,
    },
    solutionsResponse: { solutions: {} },
  });

  await sandbox.HVKentekenRdwPreview.applyAldocLinks("S153XL", {
    make: "Opel",
    model: "Movano",
    yearMin: 2012,
  });

  assert.equal(elements.get("kenteken-link-hv").href, "/hulpveren/opel/movano/?kt=S153XL");
});

test("current kenteken flow safely falls back to make route when RDW model route is unknown", async () => {
  const { elements, sandbox } = createHarness({
    existingRoutes: ["/hulpveren/opel/", "/luchtvering/opel/", "/verlagingsveren/opel/"],
    solutionsResponse: { solutions: {} },
  });

  await sandbox.HVKentekenRdwPreview.applyAldocLinks("S153XL", {
    make: "Opel",
    model: "Niet Bestaand",
    year: 2020,
  });

  assert.equal(elements.get("kenteken-link-hv").href, "/hulpveren/opel/?kt=S153XL");
  assert.equal(elements.get("kenteken-link-nr").href, "/luchtvering/opel/?kt=S153XL");
  assert.equal(elements.get("kenteken-link-ls").href, "/verlagingsveren/opel/?kt=S153XL");
});

test("current kenteken flow shows manual fallback when no product group route is available", async () => {
  const { cards, elements, sandbox } = createHarness({
    solutionsResponse: { solutions: {} },
  });

  await sandbox.HVKentekenRdwPreview.applyAldocLinks("S153XL", {
    make: "Opel",
    model: "Movano",
    year: 2020,
  });

  assert.equal(cards.get("kenteken-link-hv").style.display, "none");
  assert.equal(cards.get("kenteken-link-nr").style.display, "none");
  assert.equal(cards.get("kenteken-link-ls").style.display, "none");
  assert.equal(elements.get("kenteken-manual-fallback").hidden, false);
  assert.match(elements.get("kenteken-status").textContent, /niet automatisch koppelen/);
});

test("current kenteken renderVehicle uses RDW fallback when solutions endpoint fails", async () => {
  const { cards, elements, sandbox } = createHarness({
    existingRoutes: ["/hulpveren/opel/movano/", "/luchtvering/opel/movano/"],
    solutionsOk: false,
  });

  sandbox.HVKentekenRdwPreview.renderVehicle("S153XL", {
    make: "Opel",
    model: "Movano",
    year: 2020,
  });

  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(cards.get("kenteken-link-hv").style.display, "");
  assert.equal(cards.get("kenteken-link-nr").style.display, "");
  assert.equal(cards.get("kenteken-link-ls").style.display, "none");
  assert.equal(elements.get("kenteken-link-hv").href, "/hulpveren/opel/movano/?kt=S153XL");
  assert.match(elements.get("kenteken-status").textContent, /geen exacte kentekenkoppeling beschikbaar/);
});
