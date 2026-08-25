const { readFileSync, readdirSync } = require("node:fs");
const { join } = require("node:path");

function collectSpecFiles(directory) {
  const files = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSpecFiles(entryPath));
    } else if (entry.isFile() && entry.name.endsWith(".spec.ts")) {
      files.push(entryPath);
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

function countDeclaredTests(files) {
  return files.reduce((total, file) => {
    const matches = readFileSync(file, "utf8").match(/\btest\s*\(/g);
    return total + (matches?.length ?? 0);
  }, 0);
}

module.exports = { collectSpecFiles, countDeclaredTests };
