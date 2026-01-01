const test = require("node:test");
const assert = require("node:assert/strict");
const fetch = require("node-fetch");

const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const online = process.env.SMOKE_ONLINE === "1";

test("plate lookup", { skip: !online }, async () => {
  const res = await fetch(`${baseUrl}/api/plate/28NJN7`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(Array.isArray(data.vehicleCandidates));
});

test("menu list", { skip: !online }, async () => {
  const res = await fetch(`${baseUrl}/api/menu`);
  assert.equal(res.status, 200);
});

test("menuparts list", { skip: !online }, async () => {
  const res = await fetch(`${baseUrl}/api/menuparts/0/46918`);
  assert.equal(res.status, 200);
});
