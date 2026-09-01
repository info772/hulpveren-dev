const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const headerPath = path.resolve(__dirname, "../../wwwroot/assets/js/recentVehiclesHeader.js");
const runtimeLayoutPath = path.resolve(__dirname, "../../runtime/app/views/layout.ejs");
const recentVehicles = require("../../wwwroot/assets/js/recentVehicles");

function source() {
  return fs.readFileSync(headerPath, "utf8");
}

function runtimeLayoutSource() {
  return fs.readFileSync(runtimeLayoutPath, "utf8");
}

class Element {
  constructor(tagName) {
    this.tagName = String(tagName || "").toUpperCase();
    this.children = [];
    this.parentElement = null;
    this.dataset = {};
    this.attributes = {};
    this.className = "";
    this.hidden = false;
    this.style = {};
    this.textContent = "";
    this.listeners = {};
    this.innerHTMLValue = "";
  }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  insertBefore(child, before) {
    child.parentElement = this;
    const idx = this.children.indexOf(before);
    if (idx >= 0) this.children.splice(idx, 0, child);
    else this.children.push(child);
    return child;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === "class") this.className = String(value);
    if (name === "href") this.href = String(value);
    if (name.startsWith("data-")) {
      const key = name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      this.dataset[key] = String(value);
    }
  }

  getAttribute(name) {
    if (name === "href") return this.href || null;
    return this.attributes[name] || null;
  }

  addEventListener(type, handler) {
    this.listeners[type] = this.listeners[type] || [];
    this.listeners[type].push(handler);
  }

  dispatchEvent(event) {
    (this.listeners[event.type] || []).forEach((handler) => handler(event));
  }

  contains(node) {
    if (node === this) return true;
    return this.children.some((child) => child.contains(node));
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
      contains: (name) => this.className.split(/\s+/).includes(name),
      toggle: (name, force) => {
        const has = this.className.split(/\s+/).includes(name);
        const next = force == null ? !has : !!force;
        if (next) this.classList.add(name);
        else this.classList.remove(name);
        return next;
      },
    };
  }

  set innerHTML(value) {
    this.innerHTMLValue = String(value);
    this.children = [];
    if (this.innerHTMLValue.includes("hv-recent-vehicles__list")) {
      const title = new Element("p");
      title.className = "hv-recent-vehicles__title";
      title.textContent = "Mijn voertuigen";
      const list = new Element("div");
      list.className = "hv-recent-vehicles__list";
      const clear = new Element("button");
      clear.className = "hv-recent-vehicles__clear";
      clear.textContent = "Wis recente voertuigen";
      this.appendChild(title);
      this.appendChild(list);
      this.appendChild(clear);
    }
  }

  get innerHTML() {
    return this.innerHTMLValue;
  }

  querySelector(selector) {
    return find(this, selector);
  }

  querySelectorAll(selector) {
    const out = [];
    walk(this, (node) => {
      if (matches(node, selector)) out.push(node);
    });
    return out;
  }
}

function matches(node, selector) {
  if (!node) return false;
  if (selector.startsWith("#")) {
    return node.id === selector.slice(1);
  }
  if (selector.startsWith(".")) {
    return node.className.split(/\s+/).includes(selector.slice(1));
  }
  if (selector === "script[src]" || selector.startsWith("script[")) {
    return node.tagName === "SCRIPT" && !!node.src;
  }
  return false;
}

function walk(root, fn) {
  fn(root);
  root.children.forEach((child) => walk(child, fn));
}

function find(root, selector) {
  let found = null;
  walk(root, (node) => {
    if (!found && matches(node, selector)) found = node;
  });
  return found;
}

function createStorage(initialItems) {
  const data = new Map();
  if (initialItems) {
    data.set(recentVehicles.STORAGE_KEY, JSON.stringify(initialItems));
  }
  return {
    getItem: (key) => data.get(key) || null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

function createHarness({
  actionsNow = true,
  items = [],
  provideRecentVehicles = true,
  existingRecentVehiclesScript = false,
} = {}) {
  const listeners = {};
  const observers = [];
  class MutationObserver {
    constructor(callback) {
      this.callback = callback;
      this.disconnected = false;
      observers.push(this);
    }
    observe() {}
    disconnect() {
      this.disconnected = true;
    }
  }

  const documentElement = new Element("html");
  const head = new Element("head");
  const body = new Element("body");
  documentElement.appendChild(head);
  documentElement.appendChild(body);
  let recentScript = null;
  if (existingRecentVehiclesScript) {
    recentScript = new Element("script");
    recentScript.src = "/assets/js/recentVehicles.js?v=20260831-1";
    recentScript.setAttribute("data-src", recentScript.src);
    head.appendChild(recentScript);
  }
  let actions = null;
  const addActions = () => {
    if (actions) return actions;
    actions = new Element("div");
    actions.className = "site-header__actions";
    body.appendChild(actions);
    observers.forEach((observer) => {
      if (!observer.disconnected) observer.callback();
    });
    return actions;
  };
  if (actionsNow) addActions();

  const document = {
    readyState: "complete",
    documentElement,
    head,
    body,
    addEventListener(type, handler) {
      listeners[type] = listeners[type] || [];
      listeners[type].push(handler);
    },
    createElement: (tagName) => new Element(tagName),
    getElementById(id) {
      return id === "hv-recent-vehicles-style" ? find(head, "#hv-recent-vehicles-style") : null;
    },
    querySelector(selector) {
      if (selector === ".site-header__actions") return actions;
      return find(documentElement, selector);
    },
    querySelectorAll(selector) {
      const out = [];
      walk(documentElement, (node) => {
        if (matches(node, selector)) out.push(node);
      });
      return out;
    },
  };

  const sandbox = {
    console,
    Date,
    URL,
    document,
    localStorage: createStorage(items),
    location: { origin: "https://dev.hulpveren.shop" },
    MutationObserver,
    setTimeout: (fn) => {
      fn();
      return 1;
    },
    addEventListener(type, handler) {
      listeners[type] = listeners[type] || [];
      listeners[type].push(handler);
    },
    dispatchEvent(event) {
      (listeners[event.type] || []).forEach((handler) => handler(event));
    },
  };
  if (provideRecentVehicles) {
    sandbox.HVRecentVehicles = recentVehicles;
  }
  sandbox.window = sandbox;
  vm.runInNewContext(source(), sandbox);
  return { addActions, document, recentScript, get actions() { return actions; }, sandbox };
}

function recentWrapper(actions) {
  return actions && actions.querySelector(".hv-recent-vehicles");
}

async function tick() {
  await new Promise((resolve) => setImmediate(resolve));
}

const item = {
  plate: "S153XL",
  make: "Opel",
  model: "Movano",
  year: 2012,
  route: "/hulpveren/opel/movano/movano-b/",
  updatedAt: Date.now(),
};

test("recent vehicles header initializes when actions are present", async () => {
  const harness = createHarness({ actionsNow: true, items: [item] });
  await tick();

  assert.ok(recentWrapper(harness.actions));
  assert.equal(recentWrapper(harness.actions).style.display, "");
});

test("runtime layout loads recent vehicles header next to search suggest without app.js", () => {
  assert.equal(fs.existsSync(runtimeLayoutPath), true);
  const html = runtimeLayoutSource();
  const recentInclude = '<script src="/assets/js/recentVehiclesHeader.js?v=20260901-1"></script>';
  const searchInclude = '<script src="/assets/js/search-suggest.js?v=20260622-platepreview"></script>';
  const recentIndex = html.indexOf(recentInclude);
  const searchIndex = html.indexOf(searchInclude);

  assert.notEqual(recentIndex, -1);
  assert.notEqual(searchIndex, -1);
  assert.ok(recentIndex < searchIndex);
  assert.doesNotMatch(html, /<script[^>]+src=["']\/assets\/js\/app\.js/i);
});

test("recent vehicles header initializes when actions arrive later", async () => {
  const harness = createHarness({ actionsNow: false, items: [item] });
  assert.equal(harness.actions, null);

  const actions = harness.addActions();
  await tick();

  assert.ok(recentWrapper(actions));
  assert.equal(recentWrapper(actions).style.display, "");
});

test("recent vehicles header stays hidden without recent vehicles", async () => {
  const harness = createHarness({ actionsNow: true, items: [] });
  await tick();

  const wrapper = recentWrapper(harness.actions);
  assert.ok(wrapper);
  assert.equal(wrapper.hidden, true);
  assert.equal(wrapper.style.display, "none");
});

test("recent vehicles header shows stored vehicles", async () => {
  const harness = createHarness({ actionsNow: true, items: [item] });
  await tick();

  const wrapper = recentWrapper(harness.actions);
  const link = wrapper.querySelector(".hv-recent-vehicles__item");
  assert.equal(wrapper.hidden, false);
  assert.equal(link.href, "/hulpveren/opel/movano/movano-b/?kt=S153XL");
  assert.match(link.textContent, /S-153-XL/);
  assert.match(link.textContent, / · /);
  assert.doesNotMatch(link.textContent, /[ÃÂ]/);
});

test("recent vehicles header does not duplicate on reinitialization", async () => {
  const harness = createHarness({ actionsNow: true, items: [item] });
  harness.sandbox.HVRecentVehiclesHeader.init();
  harness.sandbox.HVRecentVehiclesHeader.init();
  await tick();

  assert.equal(harness.actions.querySelectorAll(".hv-recent-vehicles").length, 1);
});

test("recent vehicles header waits for an existing recentVehicles script still loading", async () => {
  const harness = createHarness({
    actionsNow: true,
    items: [item],
    provideRecentVehicles: false,
    existingRecentVehiclesScript: true,
  });
  await tick();

  const wrapper = recentWrapper(harness.actions);
  assert.ok(wrapper);
  assert.equal(wrapper.hidden, true);
  assert.equal(wrapper.style.display, "none");
  assert.equal(harness.recentScript.listeners.load.length, 1);

  harness.sandbox.HVRecentVehicles = recentVehicles;
  harness.recentScript.dispatchEvent({ type: "load" });
  await tick();

  const link = wrapper.querySelector(".hv-recent-vehicles__item");
  assert.equal(wrapper.hidden, false);
  assert.equal(wrapper.style.display, "");
  assert.equal(link.href, "/hulpveren/opel/movano/movano-b/?kt=S153XL");
});
