const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const notFoundPath = path.resolve(__dirname, "../../wwwroot/404.html");

function readNotFoundPage() {
  assert.equal(fs.existsSync(notFoundPath), true, "wwwroot/404.html should exist");
  return fs.readFileSync(notFoundPath, "utf8");
}

test("static 404 page has customer content and noindex robots", () => {
  const html = readNotFoundPage();

  assert.match(html, /name="robots"\s+content="noindex,follow"/);
  assert.match(html, /Deze pagina konden we niet vinden/);
});

test("static 404 page links to key recovery routes", () => {
  const html = readNotFoundPage();

  ["/kenteken/", "/hulpveren/", "/luchtvering/", "/verlagingsveren/", "/contact/"].forEach((href) => {
    assert.match(html, new RegExp(`href="${href.replace(/\//g, "\\/")}"`));
  });
});

test("static 404 page uses current layout assets and not legacy header styles", () => {
  const html = readNotFoundPage();

  assert.match(html, /\/assets\/css\/style\.bundle\.css/);
  assert.doesNotMatch(html, /hv3-/);
  assert.doesNotMatch(html, /header-v3\.css/);
  assert.doesNotMatch(html, /\/assets\/css\/site\.css/);
});
