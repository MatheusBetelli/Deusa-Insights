const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const repositoryRoot = path.join(__dirname, "..");

const trackedFiles = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter((file) => file && fs.existsSync(path.join(repositoryRoot, file)));

const trackedCsv = trackedFiles.filter((file) => file.toLowerCase().endsWith(".csv"));
const trackedEnvironmentFiles = trackedFiles.filter(
  (file) => /(^|\/)\.env(?:\.|$)/.test(file) && !file.endsWith(".example"),
);
const allowedBackendScripts = new Set([
  "backend/scripts/.gitkeep",
  "backend/scripts/generate-quality-report.ts",
]);
const unexpectedBackendScripts = trackedFiles.filter(
  (file) => file.startsWith("backend/scripts/") && !allowedBackendScripts.has(file),
);

assert.deepEqual(trackedCsv, [], `CSV files must not be tracked: ${trackedCsv.join(", ")}`);
assert.deepEqual(
  trackedEnvironmentFiles,
  [],
  `Environment files must not be tracked: ${trackedEnvironmentFiles.join(", ")}`,
);
assert.deepEqual(
  unexpectedBackendScripts,
  [],
  `Only audited backend scripts may be tracked: ${unexpectedBackendScripts.join(", ")}`,
);

console.log("Repository hygiene checks passed.");
