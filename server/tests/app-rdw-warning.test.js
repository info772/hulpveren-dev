const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const appJsPath = path.resolve(__dirname, "../../wwwroot/assets/js/app.js");

test("RDW fallback notice is rendered even when modelFallback is true", () => {
  const source = fs.readFileSync(appJsPath, "utf8");
  const noticeDeclaration = source.match(
    /const rdwFallbackNotice =[\s\S]*?;\r?\n\r?\n    const contextModelSlug/
  );

  assert.ok(noticeDeclaration, "rdwFallbackNotice declaration should exist");
  assert.match(noticeDeclaration[0], /isRdwBasic/);
  assert.doesNotMatch(noticeDeclaration[0], /!modelFallback/);
  assert.match(source, /Selectie op voertuiggegevens/);
  assert.match(source, /\$\{fallbackNote\}\s*\r?\n\s*\$\{rdwFallbackNotice\}/);
});
