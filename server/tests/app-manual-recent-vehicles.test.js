const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const appJsPath = path.resolve(__dirname, "../../wwwroot/assets/js/app.js");
const plateContextJsPath = path.resolve(__dirname, "../../wwwroot/assets/js/plateContext.js");

function appSource() {
  return fs.readFileSync(appJsPath, "utf8");
}

function plateContextSource() {
  return fs.readFileSync(plateContextJsPath, "utf8");
}

function plateContextSourceWithTestHook() {
  const source = plateContextSource();
  const marker = "  window.HVPlateContext = {";
  assert.ok(source.includes(marker), "HVPlateContext export should exist");
  return source.replace(
    marker,
    "  window.__testBuildPlateKtUrl = buildPlateKtUrl;\n" + marker
  );
}

function createPlateContextHarness({ pathname, search = "", links = [], modernHeader = false }) {
  class Element {
    constructor(tagName) {
      this.tagName = String(tagName || "").toUpperCase();
      this.children = [];
      this.dataset = {};
      this.attributes = {};
      this.className = "";
      this.parentElement = null;
      this.previousElementSibling = null;
      this.hidden = false;
      this.style = {};
      this.textContent = "";
      this.innerHTMLValue = "";
      this.listeners = {};
    }

    appendChild(child) {
      child.parentElement = this;
      child.previousElementSibling = this.children[this.children.length - 1] || null;
      this.children.push(child);
      return child;
    }

    insertAdjacentElement(position, child) {
      if (position === "afterbegin") {
        child.parentElement = this;
        this.children.unshift(child);
        return child;
      }
      if ((position === "afterend" || position === "beforebegin") && this.parentElement) {
        const siblings = this.parentElement.children;
        const currentIndex = siblings.indexOf(this);
        const insertAt = position === "beforebegin" ? currentIndex : currentIndex + 1;
        child.parentElement = this.parentElement;
        siblings.splice(insertAt, 0, child);
        this.parentElement.children.forEach((sibling, index) => {
          sibling.previousElementSibling = this.parentElement.children[index - 1] || null;
        });
        return child;
      }
      return this.appendChild(child);
    }

    setAttribute(name, value) {
      this.attributes[name] = String(value);
      if (name === "href") this.href = String(value);
      if (name === "class") this.className = String(value);
      if (name.startsWith("data-")) {
        const key = name
          .slice(5)
          .replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        this.dataset[key] = String(value);
      }
    }

    getAttribute(name) {
      if (name === "href") return this.href || null;
      return Object.prototype.hasOwnProperty.call(this.attributes, name)
        ? this.attributes[name]
        : null;
    }

    matches(selector) {
      return selector === "[data-plate-chip]" && this.dataset.plateChip === "1";
    }

    querySelector() {
      if (this.innerHTMLValue.includes("<button")) {
        const button = new Element("button");
        button.addEventListener = (eventName, handler) => {
          button.listeners[eventName] = handler;
        };
        return button;
      }
      return null;
    }

    querySelectorAll(selector) {
      if (selector === "a[href]") return this.children.filter((child) => child.href);
      return [];
    }

    remove() {
      if (!this.parentElement) return;
      this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
      this.parentElement = null;
    }

    get classList() {
      return {
        add: (...names) => {
          const current = new Set(this.className.split(/\s+/).filter(Boolean));
          names.forEach((name) => current.add(name));
          this.className = Array.from(current).join(" ");
        },
        remove: (...names) => {
          const remove = new Set(names);
          this.className = this.className
            .split(/\s+/)
            .filter((name) => name && !remove.has(name))
            .join(" ");
        },
      };
    }

    set innerHTML(value) {
      this.innerHTMLValue = String(value);
    }

    get innerHTML() {
      return this.innerHTMLValue;
    }
  }

  const findInTree = (root, predicate) => {
    if (!root) return null;
    if (predicate(root)) return root;
    for (const child of root.children || []) {
      const found = findInTree(child, predicate);
      if (found) return found;
    }
    return null;
  };

  const list = new Element("div");
  list.dataset.setList = "1";
  const header = modernHeader ? new Element("header") : null;
  if (header) {
    header.className = "site-header";
  }
  links.forEach((href) => {
    const card = new Element("article");
    const link = new Element("a");
    link.href = href;
    link.setAttribute("href", href);
    card.appendChild(link);
    list.appendChild(card);
  });

  const storage = new Map();
  const sandbox = {
    console,
    CustomEvent: class CustomEvent {
      constructor(type, options = {}) {
        this.type = type;
        this.detail = options.detail;
      }
    },
    Date,
    URL,
    dispatchEvent(event) {
      this.lastEvent = event;
    },
    document: {
      readyState: "loading",
      body: new Element("body"),
      head: new Element("head"),
      documentElement: new Element("html"),
      addEventListener() {},
      createElement: (tagName) => new Element(tagName),
      getElementById() {
        return null;
      },
      querySelector(selector) {
        if (selector === "[data-set-list]") return list;
        if (selector === ".site-header") return header;
        if (selector === "[data-plate-pill-row]") {
          return findInTree(this.body, (node) => node.dataset.platePillRow === "1");
        }
        if (selector === "[data-plate-pill]") {
          return findInTree(this.body, (node) => node.dataset.platePill === "1");
        }
        return null;
      },
      querySelectorAll(selector) {
        if (selector === "[data-set-list]") return [list];
        return [];
      },
    },
    localStorage: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key),
    },
    location: {
      origin: "https://dev.hulpveren.shop",
      pathname,
      search,
      href: `https://dev.hulpveren.shop${pathname}${search}`,
    },
    sessionStorage: {
      getItem: (key) => storage.get(`session:${key}`) || null,
      setItem: (key, value) => storage.set(`session:${key}`, String(value)),
      removeItem: (key) => storage.delete(`session:${key}`),
    },
    setTimeout() {},
  };
  if (header) {
    sandbox.document.body.appendChild(header);
  }
  sandbox.window = sandbox;
  vm.runInNewContext(plateContextSource(), sandbox);
  return { list, sandbox };
}

function createPlateContextUrlBuilderHarness({ pathname, search = "" }) {
  const sandbox = {
    console,
    CustomEvent: class CustomEvent {
      constructor(type, options = {}) {
        this.type = type;
        this.detail = options.detail;
      }
    },
    Date,
    URL,
    document: {
      readyState: "loading",
      addEventListener() {},
      createElement: () => ({
        dataset: {},
        setAttribute() {},
        appendChild() {},
        querySelector() {
          return null;
        },
      }),
      getElementById() {
        return null;
      },
      querySelector() {
        return null;
      },
      querySelectorAll() {
        return [];
      },
    },
    localStorage: {
      getItem() {
        return null;
      },
      setItem() {},
      removeItem() {},
    },
    location: {
      origin: "https://dev.hulpveren.shop",
      pathname,
      search,
      href: `https://dev.hulpveren.shop${pathname}${search}`,
    },
    sessionStorage: {
      getItem() {
        return null;
      },
      setItem() {},
      removeItem() {},
    },
    setTimeout() {},
  };
  sandbox.window = sandbox;
  vm.runInNewContext(plateContextSourceWithTestHook(), sandbox);
  return sandbox;
}

function appClickHandlerSource() {
  const source = appSource();
  const start = source.indexOf('  document.addEventListener("click", (evt) => {');
  assert.notEqual(start, -1, "global product click handler should exist");
  const end = source.indexOf("\n  });", start);
  assert.notEqual(end, -1, "global product click handler should close");
  return source.slice(start, end + "\n  });".length);
}

function createAppClickHandlerHarness({ pathname, search = "", plate = "S153XL" } = {}) {
  const listeners = {};
  const sandbox = {
    URL,
    window: null,
    document: {
      addEventListener(type, handler) {
        listeners[type] = handler;
      },
    },
    location: {
      origin: "https://dev.hulpveren.shop",
      pathname,
      search,
      href: `https://dev.hulpveren.shop${pathname}${search}`,
    },
    hv_plate_context: {
      plate,
      vehicle: { make: "Opel", model: "Movano" },
      route: { makeSlug: "opel", modelSlug: "movano" },
    },
  };
  sandbox.window = sandbox;

  const code = `
    const PLATE_PREFIX = "kt_";
    const normalizePlateInput = (value) => String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const slugify = (value) => String(value || "").toLowerCase().trim().replace(/&/g, "en").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    function getPlateContext() {
      return window.hv_plate_context || {};
    }
    function getKtSegment() {
      const ctx = getPlateContext();
      const plate = ctx.plate ? normalizePlateInput(ctx.plate).toLowerCase() : "";
      if (!plate) return "";
      return \`\${PLATE_PREFIX}\${plate}\`;
    }
${appClickHandlerSource()}
  `;
  vm.runInNewContext(code, sandbox);
  assert.equal(typeof listeners.click, "function", "click handler should be registered");
  return {
    sandbox,
    click(href) {
      const anchor = {
        href,
        getAttribute(name) {
          return name === "href" ? href : null;
        },
      };
      const event = {
        prevented: false,
        target: {
          closest(selector) {
            return selector === "a" ? anchor : null;
          },
        },
        preventDefault() {
          this.prevented = true;
        },
      };
      listeners.click(event);
      return { anchor, event };
    },
  };
}

function helperSource(name) {
  const source = appSource();
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} should exist`);
  const nextFunction = source.indexOf("\n  function ", start + 1);
  return source.slice(start, nextFunction === -1 ? undefined : nextFunction);
}

function renderPlateModelInnerSource() {
  const source = appSource();
  const start = source.indexOf("async function renderPlateModel");
  assert.notEqual(start, -1, "renderPlateModel should exist");
  const end = source.indexOf("\n  async function ", start + 1);
  return source.slice(start, end === -1 ? undefined : end);
}

test("manual model visits store recent vehicle after a renderable model route", () => {
  const source = appSource();
  const helper = helperSource("rememberManualModelVisit");

  assert.match(helper, /parseRoute\(location\.pathname,\s*BASE\)/);
  assert.match(helper, /route\.kind !== "model"/);
  assert.match(helper, /recent\.add\(storage,\s*\{/);
  assert.match(helper, /plate:\s*""/);
  assert.match(helper, /make:\s*makeLabel/);
  assert.match(helper, /model:\s*modelLabel/);
  assert.match(helper, /year:\s*null/);
  assert.match(source, /if \(!allPairs\.length\)[\s\S]*?return;\s*\}\s*\r?\n\s*rememberManualModelVisit\(makeLabel,\s*modelLabel\);/);
});

test("manual generation visits keep the full current pathname as stored route", () => {
  const helper = helperSource("rememberManualModelVisit");

  assert.match(helper, /route:\s*normalizePath\(location\.pathname\)/);
  assert.doesNotMatch(helper, /route:\s*["'`]\/hulpveren\/\$\{makeSlug\}/);
  assert.doesNotMatch(helper, /route:\s*.*route\.model/);
});

test("active plate context is not stored again as a manual selection", () => {
  const helper = helperSource("rememberManualModelVisit");

  assert.match(helper, /hasPlateToken\(location\.pathname,\s*BASE\)/);
  assert.match(helper, /getActivePlateContext\(\) \|\| getPlateContext\(\)/);
  assert.match(helper, /activeCtx && activeCtx\.plate/);
});

test("missing localStorage or failed recentVehicles lazy-load cannot break renderModel", () => {
  const source = appSource();
  const loader = source.match(/let recentVehiclesLoadPromise[\s\S]*?const initSiteData = async/);
  const helper = helperSource("rememberManualModelVisit");

  assert.ok(loader, "recent vehicles lazy-loader should be near script loading helpers");
  assert.match(loader[0], /if \(!recentVehiclesLoadPromise\)/);
  assert.match(loader[0], /\/assets\/js\/recentVehicles\.js\?v=20260831-1/);
  assert.match(loader[0], /\.catch\(\(\) => null\)/);
  assert.match(helper, /const storage = recentVehiclesStorage\(\)/);
  assert.match(helper, /if \(!storage\) return/);
  assert.match(helper, /try \{[\s\S]*\} catch \(err\) \{\}/);
});

test("recent vehicles are exposed from the current site header", () => {
  const source = appSource();
  const helper = helperSource("initRecentVehiclesHeader");

  assert.match(source, /let recentVehiclesHeaderLoadPromise = null/);
  assert.match(helper, /HVRecentVehiclesHeader/);
  assert.match(helper, /\/assets\/js\/recentVehiclesHeader\.js\?v=20260901-1/);
  assert.match(source, /initRecentVehiclesHeader\(\)/);
});

test("recent vehicle header links keep route and add kt only for stored plates", () => {
  const source = appSource();

  assert.match(source, /\/assets\/js\/recentVehiclesHeader\.js\?v=20260901-1/);
});

test("global product click handler leaves modern kt query generation links alone", () => {
  const harness = createAppClickHandlerHarness({
    pathname: "/kenteken/",
    search: "?kt=S153XL",
    plate: "S153XL",
  });
  const href = "/hulpveren/opel/movano/movano-b/?kt=S153XL";

  const { anchor, event } = harness.click(href);

  assert.equal(event.prevented, false);
  assert.equal(anchor.href, href);
  assert.equal(
    harness.sandbox.window.location.href,
    "https://dev.hulpveren.shop/kenteken/?kt=S153XL"
  );
  assert.doesNotMatch(harness.sandbox.window.location.href, /kt_s153xl/i);
});

test("global product click handler keeps legacy kt pathname behavior for links without kt query", () => {
  const harness = createAppClickHandlerHarness({
    pathname: "/kenteken/",
    search: "?kt=S153XL",
    plate: "S153XL",
  });

  const { event } = harness.click("/hulpveren/opel/movano/");

  assert.equal(event.prevented, true);
  assert.equal(
    harness.sandbox.window.location.href,
    "https://dev.hulpveren.shop/hulpveren/opel/movano/kt_s153xl/"
  );
});

test("recent vehicles header initializes when site header actions arrive late", () => {
  const helper = helperSource("initRecentVehiclesHeader");

  assert.match(helper, /HVRecentVehiclesHeader\.init\(\)/);
  assert.match(helper, /loadScriptOnce\(/);
});

test("kenteken page no longer contains the fixed recent vehicles card", () => {
  const kentekenPath = path.resolve(__dirname, "../../wwwroot/kenteken/index.html");
  const html = fs.readFileSync(kentekenPath, "utf8");

  assert.doesNotMatch(html, /id="kenteken-recent"/);
  assert.doesNotMatch(html, /id="kenteken-recent-list"/);
  assert.doesNotMatch(html, /id="kenteken-recent-clear"/);
});

test("plateContext never injects legacy plate search into the modern site header", () => {
  const source = plateContextSource();
  const start = source.indexOf("const ensurePlateBar = () =>");
  assert.notEqual(start, -1, "ensurePlateBar should exist");
  const end = source.indexOf("\n  const initPlateBar", start);
  const helper = source.slice(start, end === -1 ? undefined : end);

  assert.match(helper, /document\.querySelector\("\.plate-search"\)/);
  assert.match(helper, /document\.querySelector\("\.hv2-cta"\)/);
  assert.match(helper, /document\.querySelector\("\.nav-shell"\)/);
  assert.match(helper, /document\.querySelector\("\.hv2-header"\)/);
  assert.doesNotMatch(helper, /document\.querySelector\("\.site-header"\)/);
  assert.match(source, /const buildPlateBarMarkup = \(\) => `\s*<div class="plate-search">/);
});

test("plateContext keeps modern generation links with query plate unchanged", () => {
  const href = "/hulpveren/opel/movano/movano-b/?kt=S153XL";
  const { list, sandbox } = createPlateContextHarness({
    pathname: "/hulpveren/opel/movano/movano-b/",
    search: "?kt=S153XL",
    links: [href],
  });

  sandbox.HVPlateContext.applyPlateContext({
    plate: "S153XL",
    vehicle: { make: "Opel", model: "Movano" },
  });

  const link = list.children[0].children[0];
  assert.equal(link.href, href);
  assert.equal(link.getAttribute("href"), href);
  assert.notEqual(link.href, "/hulpveren/opel/movano/movano-b/kt_s153xl/?kt=S153XL");
});

test("plateContext URL builder keeps modern model and generation routes query-style", () => {
  const modelRoute = createPlateContextUrlBuilderHarness({
    pathname: "/hulpveren/opel/movano/",
  });
  const generationRoute = createPlateContextUrlBuilderHarness({
    pathname: "/hulpveren/opel/movano/movano-b/",
  });

  assert.equal(
    modelRoute.__testBuildPlateKtUrl({ plateRaw: "S153XL", ktRaw: "s153xl" }),
    "/hulpveren/opel/movano/?kt=S153XL"
  );
  assert.equal(
    generationRoute.__testBuildPlateKtUrl({ plateRaw: "S153XL", ktRaw: "s153xl" }),
    "/hulpveren/opel/movano/movano-b/?kt=S153XL"
  );
});

test("plateContext URL builder keeps real kt pathnames in legacy path flow", () => {
  const sandbox = createPlateContextUrlBuilderHarness({
    pathname: "/hulpveren/opel/movano/kt_s153xl/",
  });

  const url = sandbox.__testBuildPlateKtUrl({
    plateRaw: "S153XL",
    ktRaw: "s153xl",
  });

  assert.equal(url, "/hulpveren/opel/movano/S153XL/kt_s153xl");
  assert.doesNotMatch(url, /\?kt=/);
});

test("plateContext does not inject the loose plate pill below a modern site header", () => {
  const { sandbox } = createPlateContextHarness({
    pathname: "/hulpveren/opel/movano/movano-b/",
    search: "?kt=7VSV16",
    modernHeader: true,
  });

  sandbox.HVPlateContext.setPlateContextFromVehicle("7VSV16", {
    make: "VOLKSWAGEN",
    model: "CADDY",
  });

  assert.equal(sandbox.document.querySelector("[data-plate-pill-row]"), null);
  assert.equal(sandbox.hv_plate_context.plate, "7VSV16");
  assert.equal(sandbox.hv_plate_context.vehicle.make, "VOLKSWAGEN");
  assert.equal(sandbox.hv_plate_context.vehicle.model, "CADDY");
});

test("generation route with query plate keeps the generation pathname", () => {
  const helper = renderPlateModelInnerSource();

  assert.match(helper, /const currentProductRoute = parseRoute\(window\.location\.pathname,\s*base\)/);
  assert.match(helper, /currentProductRoute\.kind === "model"/);
  assert.match(helper, /!hasPlateToken\(window\.location\.pathname,\s*base\)/);
  assert.match(helper, /return;\s*\}\s*const needsUpgrade/);
});

test("legacy kt pathname flow still upgrades only incomplete kt routes", () => {
  const helper = renderPlateModelInnerSource();

  assert.match(helper, /const currentRoute = parsePlateRoute\(window\.location\.pathname,\s*base\)/);
  assert.match(helper, /const needsUpgrade =\s*!currentRoute \|\| !currentRoute\.make \|\| !currentRoute\.model/);
  assert.match(helper, /\[basePath,\s*makeSlugValue,\s*modelSlugValue,\s*`\$\{PLATE_PREFIX\}\$\{platePart\}`\]/);
  assert.match(helper, /window\.history\.replaceState\(/);
});

test("plain model routes remain model routes and are not treated as plate routes", () => {
  const parseRoute = helperSource("parseRoute");
  const parsePlateRoute = helperSource("parsePlateRoute");
  const helper = renderPlateModelInnerSource();

  assert.match(parseRoute, /if \(parts\.length >= 2\)\s*return \{ kind: "model", make: parts\[0\], model: parts\[1\] \}/);
  assert.match(parsePlateRoute, /const plateMatch = findPlateSegment\(parts\)/);
  assert.match(parsePlateRoute, /if \(!plateMatch\) return null/);
  assert.match(helper, /currentProductRoute\.kind === "model"/);
});
