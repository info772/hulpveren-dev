const fs = require("fs");
const path = require("path");

function writeTextAtomic(filePath, content) {
  const dir = path.dirname(filePath);
  const tempPath = path.join(dir, `${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(tempPath, content, "utf8");
  try {
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    if (err.code === "EEXIST" || err.code === "EPERM") {
      try {
        fs.unlinkSync(filePath);
      } catch (removeErr) {
        // Ignore missing file or access race.
      }
      fs.renameSync(tempPath, filePath);
    } else {
      throw err;
    }
  }
}

function writeJsonAtomic(filePath, payload) {
  const content = JSON.stringify(payload, null, 2) + "\n";
  writeTextAtomic(filePath, content);
}

module.exports = {
  writeTextAtomic,
  writeJsonAtomic,
};
