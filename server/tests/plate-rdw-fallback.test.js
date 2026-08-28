const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const fetch = require("node-fetch");

function mockModule(modulePath, exportsValue) {
  const resolved = require.resolve(modulePath);
  delete require.cache[resolved];
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports: exportsValue,
  };
}

async function withPlateServer({ proxyResult, rdwResult }, run) {
  const routePath = require.resolve("../routes/plate");
  delete require.cache[routePath];

  class UpstreamError extends Error {}

  mockModule("../services/proxyClient", {
    UpstreamError,
    getTypesByLicenseplateNL: async () => proxyResult,
  });
  mockModule("../services/rdwClient", {
    lookupRdwVehicle: async () => rdwResult,
  });

  const plateRoute = require("../routes/plate");
  const app = express();
  app.use("/api/plate", plateRoute);
  app.use((err, req, res, next) => {
    res.status(500).json({ error: err.message || "test_error" });
  });

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    delete require.cache[routePath];
  }
}

test("plate route keeps Aldoc match as proxyv7 and enriches RDW data", async () => {
  await withPlateServer(
    {
      proxyResult: {
        upstreamMs: 12,
        candidates: [{ make: "FORD", model: "Transit", ktyp: 123 }],
      },
      rdwResult: {
        vehicle: {
          make: "Ford",
          model: "Transit",
          year: 2019,
          firstRegistrationDate: "2019-04-12",
        },
      },
    },
    async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/plate/ab-12-cd`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.source, "proxyv7");
      assert.equal(data.vehicleCandidates.length, 1);
      assert.equal(data.vehicleCandidates[0].ktyp, 123);
      assert.equal(data.vehicleCandidates[0].year, 2019);
    }
  );
});

test("plate route falls back to RDW basic vehicle when Aldoc has no match", async () => {
  await withPlateServer(
    {
      proxyResult: {
        upstreamMs: 8,
        error: "licenseplate_not_found",
        candidates: [],
      },
      rdwResult: {
        vehicle: {
          make: "Volkswagen",
          model: "Golf",
          year: 2017,
          firstRegistrationDate: "2017-06-01",
          vehicleType: "Personenauto",
        },
      },
    },
    async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/plate/rdw123`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.source, "rdw");
      assert.equal(data.confidence, "basic");
      assert.deepEqual(data.vehicle, {
        make: "Volkswagen",
        model: "Golf",
        year: 2017,
        firstRegistrationDate: "2017-06-01",
        vehicleType: "Personenauto",
      });
    }
  );
});

test("plate route returns not_found when Aldoc misses and RDW data is insufficient", async () => {
  await withPlateServer(
    {
      proxyResult: {
        upstreamMs: 8,
        error: "licenseplate_not_found",
        candidates: [],
      },
      rdwResult: {
        vehicle: null,
      },
    },
    async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/plate/zz-99-zz`);
      assert.equal(res.status, 404);
      const data = await res.json();
      assert.equal(data.error, "licenseplate_not_found");
      assert.equal(data.source, "proxyv7");
    }
  );
});
