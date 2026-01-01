const test = require("node:test");
const assert = require("node:assert/strict");

const { parseRange, rangesOverlap, clampGeneration } = require("../utils/rangeUtils");

test("parseRange year-only end defaults to december", () => {
  const range = parseRange("2015");
  assert.ok(range);
  assert.equal(range.start.year, 2015);
  assert.equal(range.start.month, 1);
  assert.equal(range.end.year, 2015);
  assert.equal(range.end.month, 12);
});

test("parseRange handles month-year range", () => {
  const range = parseRange("08-2010/05-2015");
  assert.ok(range);
  assert.deepEqual(range.start, { year: 2010, month: 8 });
  assert.deepEqual(range.end, { year: 2015, month: 5 });
});

test("rangesOverlap detects overlap and gaps", () => {
  const vehicle = parseRange("08-2010/05-2015");
  const overlap = parseRange("2014/2016");
  const gap = parseRange("06-2015/2018");
  assert.equal(rangesOverlap(vehicle, overlap), true);
  assert.equal(rangesOverlap(vehicle, gap), false);
});

test("clampGeneration gen3 maxes at 2015-05", () => {
  const range = parseRange("2010/2018");
  const clamped = clampGeneration(range, 3);
  assert.ok(clamped);
  assert.deepEqual(clamped.end, { year: 2015, month: 5 });
});
