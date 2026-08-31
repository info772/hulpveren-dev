const test = require("node:test");
const assert = require("node:assert/strict");

const recentVehicles = require("../../wwwroot/assets/js/recentVehicles");

function createStorage(initialValue) {
  const data = new Map();
  if (initialValue !== undefined) {
    data.set(recentVehicles.STORAGE_KEY, initialValue);
  }
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
  };
}

test("recent vehicles adds normalized plate selections newest first", () => {
  const storage = createStorage();
  recentVehicles.add(storage, {
    plate: "s-153-xl",
    make: "Opel",
    model: "Movano",
    year: 2012,
    route: "/hulpveren/opel/movano/movano-b/?kt=S153XL",
  }, 1000);

  const items = recentVehicles.read(storage, 1000);
  assert.equal(items.length, 1);
  assert.equal(items[0].plate, "S153XL");
  assert.equal(items[0].route, "/hulpveren/opel/movano/movano-b/");
});

test("recent vehicles deduplicates by plate and keeps the latest item", () => {
  const storage = createStorage();
  recentVehicles.add(storage, {
    plate: "S153XL",
    make: "Opel",
    model: "Movano",
    year: 2011,
    route: "/hulpveren/opel/movano/",
  }, 1000);
  recentVehicles.add(storage, {
    plate: "s-153-xl",
    make: "Opel",
    model: "Movano",
    year: 2012,
    route: "/luchtvering/opel/movano/",
  }, 2000);

  const items = recentVehicles.read(storage, 2000);
  assert.equal(items.length, 1);
  assert.equal(items[0].year, 2012);
  assert.equal(items[0].route, "/luchtvering/opel/movano/");
});

test("recent vehicles stores at most five items", () => {
  const storage = createStorage();
  for (let i = 0; i < 6; i += 1) {
    recentVehicles.add(storage, {
      plate: "TEST0" + i,
      make: "Merk",
      model: "Model " + i,
      year: 2020,
      route: "/hulpveren/merk/model-" + i + "/",
    }, 1000 + i);
  }

  const items = recentVehicles.read(storage, 2006);
  assert.equal(items.length, 5);
  assert.equal(items[0].plate, "TEST05");
  assert.equal(items.at(-1).plate, "TEST01");
});

test("recent vehicles prunes items older than thirty days", () => {
  const now = 60 * 24 * 60 * 60 * 1000;
  const storage = createStorage(JSON.stringify([
    {
      plate: "OLD001",
      make: "Opel",
      model: "Movano",
      year: 2012,
      route: "/hulpveren/opel/movano/",
      updatedAt: now - recentVehicles.MAX_AGE_MS - 1,
    },
    {
      plate: "NEW001",
      make: "Opel",
      model: "Movano",
      year: 2012,
      route: "/hulpveren/opel/movano/",
      updatedAt: now,
    },
  ]));

  const items = recentVehicles.read(storage, now);
  assert.deepEqual(items.map((item) => item.plate), ["NEW001"]);
});

test("recent vehicles handles corrupt JSON safely", () => {
  const storage = createStorage("{not-json");
  assert.deepEqual(recentVehicles.read(storage, 1000), []);
});

test("recent vehicles can be cleared", () => {
  const storage = createStorage();
  recentVehicles.add(storage, {
    plate: "S153XL",
    make: "Opel",
    model: "Movano",
    year: 2012,
    route: "/hulpveren/opel/movano/",
  }, 1000);

  recentVehicles.clear(storage);
  assert.deepEqual(recentVehicles.read(storage, 1000), []);
});
