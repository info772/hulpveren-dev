#!/usr/bin/env node
const fs = require('fs');
const crypto = require('crypto');
const vm = require('vm');
const path = require('path');

const target = process.argv[2];
const checkOnly = process.argv[3] === '--check';
if (!target || (process.argv[3] && !checkOnly)) {
  console.error('Gebruik: node patch-www-kenteken-app.js <app.js> [--check]');
  process.exit(2);
}

const expectedSha = '0721aef67118645120b254881491ac780079a1b9865b247584f34a0c2511aba7';
const patchedSha = '741cff5cf58a37598c1072ceda9ee52e2f1fca64cb700c2d9f607b9f2e0890fc';
const before = '  function suppressHomeSectionsOnPlate() {\n' +
  '    if (window.__SPA_DISABLED__ || window.__LEGACY_HERO_PAGE__) return;';
const after = '  function suppressHomeSectionsOnPlate() {\n' +
  '    if (window.__SPA_DISABLED__ || window.__LEGACY_HERO_PAGE__ || document.getElementById("kenteken-tiles")) return;';

const original = fs.readFileSync(target, 'utf8');
const sha = crypto.createHash('sha256').update(original).digest('hex');
if (sha !== expectedSha) {
  if (sha === patchedSha) {
    console.log('De kentekenfix staat al in ' + target);
    process.exit(0);
  }
  console.error('Productie app.js is veranderd. Verwacht SHA-256 ' + expectedSha + ', gevonden ' + sha + '. Niets overschreven.');
  process.exit(1);
}

if (original.split(before).length !== 2) {
  console.error('De doelcode staat niet precies eenmaal in productie app.js. Niets overschreven.');
  process.exit(1);
}
const updated = original.replace(before, after);
new vm.Script(updated, { filename: target });
if (checkOnly) {
  console.log('Kentekenpatch gevalideerd voor ' + target);
  process.exit(0);
}

const backup = target + '.bak.' + new Date().toISOString().replace(/[-:]/g, '').replace(/\..*$/, 'Z');
fs.copyFileSync(target, backup, fs.constants.COPYFILE_EXCL);
fs.writeFileSync(target, updated, 'utf8');
console.log('Productie app.js bijgewerkt. Backup: ' + backup);
