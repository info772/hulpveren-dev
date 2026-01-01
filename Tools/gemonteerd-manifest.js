/**
 * Builds /assets/img/Gemonteerd/manifest.json based on the files present.
 * Run: node Tools/gemonteerd-manifest.js
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, "..");
const IMG_DIR = path.join(ROOT, "wwwroot", "assets", "img", "Gemonteerd");
const MANIFEST = path.join(IMG_DIR, "manifest.json");

const ALLOWED = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);

function main() {
  const entries = fs
    .readdirSync(IMG_DIR, { withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => d.name)
    .filter((name) => ALLOWED.has(path.extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, "nl"));

  fs.writeFileSync(MANIFEST, JSON.stringify(entries, null, 2) + "\n", "utf8");
  console.log(`Wrote ${entries.length} items to ${path.relative(ROOT, MANIFEST)}`);
}

main();
