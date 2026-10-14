#!/usr/bin/env node
// Apply only to the production/dev server version inspected on 2026-09-23.
const fs = require('fs');
const crypto = require('crypto');
const vm = require('vm');

const target = process.argv[2];
const checkOnly = process.argv[3] === '--check';
if (!target || (process.argv[3] && !checkOnly)) {
  console.error('Usage: node patch-plate-speed.js <server.js> [--check]');
  process.exit(2);
}

const expectedSha = 'eb02e12db353ccccd3fbe9ddd30851a359ad42193cdd95877c8dec91aa4d55ab';
const patchedSha = '194e47d976e654f11fd54515d288c5b4944f5c1ab9da776692f2d4e564b0c767';
const source = fs.readFileSync(target, 'utf8');
const sha = crypto.createHash('sha256').update(source).digest('hex');
if (sha === patchedSha) {
  console.log('Plate speed patch already applied.');
  process.exit(0);
}
if (sha !== expectedSha) {
  console.error('Unexpected server.js SHA-256: ' + sha + '. Nothing changed.');
  process.exit(1);
}
const changes = [
  [
    "app.get('/api/plate/preview/:plate', async (req, res) => {",
    `// A plate is requested again when visitors follow a solution link. Cache only
// successful responses; failed and missing plates are always checked afresh.
const plateApiCache = new Map();
const PLATE_API_CACHE_TTL_MS = 10 * 60 * 1000;
const PLATE_API_CACHE_MAX = 500;

function cachePlateApiResult(kind) {
  return function (req, res, next) {
    const plate = normalizeNlPlate(req.params.plate);
    if (!plate || plate.length < 6 || plate.length > 8) return next();
    const key = kind + ':' + plate;
    const cached = plateApiCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return res.json(cached.body);
    if (cached) plateApiCache.delete(key);

    const originalJson = res.json.bind(res);
    res.json = function (body) {
      if (res.statusCode === 200 && body && body.ok === true) {
        plateApiCache.delete(key);
        plateApiCache.set(key, { body, expiresAt: Date.now() + PLATE_API_CACHE_TTL_MS });
        while (plateApiCache.size > PLATE_API_CACHE_MAX) {
          plateApiCache.delete(plateApiCache.keys().next().value);
        }
      }
      return originalJson(body);
    };
    next();
  };
}

app.get('/api/plate/preview/:plate', cachePlateApiResult('preview'), async (req, res) => {`
  ],
  [
    `  const seenFetches = new Set();

  for (const item of candidateItems) {
    const key = \`\${item.menuCode}:\${item.partCode}\`;
    if (seenFetches.has(key)) continue;
    seenFetches.add(key);

    const articles = await fetchAldocArticlesForPart(typeCode, item.menuCode, item.partCode);

    articles.forEach((article) => {`,
    `  const seenFetches = new Set();
  const distinctItems = candidateItems.filter((item) => {
    const key = \`\${item.menuCode}:\${item.partCode}\`;
    if (seenFetches.has(key)) return false;
    seenFetches.add(key);
    return true;
  });

  // Bound parallel requests to avoid overloading the supplier on large menus.
  const articleGroups = [];
  for (let index = 0; index < distinctItems.length; index += 4) {
    const batch = distinctItems.slice(index, index + 4);
    articleGroups.push(...await Promise.all(batch.map((item) =>
      fetchAldocArticlesForPart(typeCode, item.menuCode, item.partCode)
    )));
  }

  distinctItems.forEach((item, index) => {
    articleGroups[index].forEach((article) => {`
  ],
  [
    `      });
    });
  }

  return solutionMap;
}`,
    `      });
    });
  });

  return solutionMap;
}`
  ],
  [
    `async function attachPlateSolutionUrls(solutions, aldocVehicle, plate) {
  for (const type of Object.keys(solutions || {})) {
    if (!solutions[type] || !solutions[type].available) continue;

    solutions[type].url =
      await resolveUrlFromSolutionItems(type, solutions[type], aldocVehicle, plate) ||
      resolvePlateSolutionUrl(type, aldocVehicle, plate);
  }

  return solutions;
}`,
    `async function attachPlateSolutionUrls(solutions, aldocVehicle, plate) {
  await Promise.all(Object.keys(solutions || {}).map(async (type) => {
    if (!solutions[type] || !solutions[type].available) return;
    solutions[type].url =
      await resolveUrlFromSolutionItems(type, solutions[type], aldocVehicle, plate) ||
      resolvePlateSolutionUrl(type, aldocVehicle, plate);
  }));
  return solutions;
}`
  ],
  [
    "app.get('/api/plate/solutions/:plate', async (req, res) => {",
    "app.get('/api/plate/solutions/:plate', cachePlateApiResult('solutions'), async (req, res) => {"
  ]
];

let patched = source;
for (const [before, after] of changes) {
  if (patched.split(before).length !== 2) {
    console.error('A server patch anchor is missing or duplicated. Nothing changed.');
    process.exit(1);
  }
  patched = patched.replace(before, after);
}
new vm.Script(patched, { filename: target });
if (checkOnly) {
  console.log('Patch syntax and source version verified.');
  process.exit(0);
}
const backup = target + '.bak.' + new Date().toISOString().replace(/[-:]/g, '').replace(/\..*$/, 'Z');
fs.copyFileSync(target, backup, fs.constants.COPYFILE_EXCL);
fs.writeFileSync(target, patched);
console.log('Updated ' + target + '; backup: ' + backup);
