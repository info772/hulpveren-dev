const crypto = require("crypto");

function normalizePlate(input) {
  return String(input || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function isValidPlate(plate) {
  return plate.length >= 6;
}

function maskPlate(plate) {
  if (!plate) return "";
  const head = plate.slice(0, 2);
  const tail = "*".repeat(Math.max(0, plate.length - 2));
  return `${head}${tail}`;
}

function hashPlate(plate) {
  if (!plate) return "";
  return crypto.createHash("sha256").update(plate).digest("hex").slice(0, 12);
}

module.exports = {
  normalizePlate,
  isValidPlate,
  maskPlate,
  hashPlate,
};
