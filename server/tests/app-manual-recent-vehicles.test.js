const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const appJsPath = path.resolve(__dirname, "../../wwwroot/assets/js/app.js");

function appSource() {
  return fs.readFileSync(appJsPath, "utf8");
}

function helperSource(name) {
  const source = appSource();
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} should exist`);
  const nextFunction = source.indexOf("\n  function ", start + 1);
  return source.slice(start, nextFunction === -1 ? undefined : nextFunction);
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

  assert.match(helper, /querySelector\("\.site-header__actions"\)/);
  assert.match(helper, /textContent = "Mijn voertuigen"/);
  assert.match(helper, /hv-recent-vehicles__panel/);
  assert.match(helper, /Wis recente voertuigen/);
  assert.match(helper, /wrapper\.hidden = items\.length === 0/);
  assert.match(helper, /wrapper\.style\.display = items\.length \? "" : "none"/);
  assert.match(helper, /recentVehiclesStorage\(\)/);
  assert.match(helper, /recent\.read\(storage\)/);
  assert.match(helper, /recent\.clear\(storage\)/);
  assert.match(helper, /document\.addEventListener\("click"/);
  assert.match(helper, /event\.key === "Escape"/);
  assert.match(source, /initRecentVehiclesHeader\(\)/);
});

test("recent vehicle header links keep route and add kt only for stored plates", () => {
  const source = appSource();
  const hrefHelper = helperSource("recentVehicleHref");
  const labelHelper = helperSource("recentVehicleLabel");

  assert.match(hrefHelper, /const route = item && item\.route \? item\.route : "\/kenteken\/"/);
  assert.match(hrefHelper, /url\.searchParams\.set\("kt", item\.plate\)/);
  assert.match(hrefHelper, /return url\.pathname \+ url\.search/);
  assert.match(labelHelper, /formatRecentVehiclePlate\(item\.plate\)/);
  assert.match(labelHelper, /\[item && item\.make, item && item\.model\]/);
  assert.match(source, /window\.addEventListener\("hv:recentVehiclesChanged", render\)/);
});

test("kenteken page no longer contains the fixed recent vehicles card", () => {
  const kentekenPath = path.resolve(__dirname, "../../wwwroot/kenteken/index.html");
  const html = fs.readFileSync(kentekenPath, "utf8");

  assert.doesNotMatch(html, /id="kenteken-recent"/);
  assert.doesNotMatch(html, /id="kenteken-recent-list"/);
  assert.doesNotMatch(html, /id="kenteken-recent-clear"/);
});
