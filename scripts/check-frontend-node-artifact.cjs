const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const frontendOutput = path.join(__dirname, "..", "frontend", ".output");
const serverEntry = path.join(frontendOutput, "server", "index.mjs");

assert.ok(fs.existsSync(serverEntry), "Frontend Node server entry was not generated");
assert.ok(
  fs.existsSync(path.join(frontendOutput, "public")),
  "Frontend public assets were not generated",
);

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    assert.equal(
      entry.name.startsWith(".env") || entry.name.startsWith(".dev.vars"),
      false,
      `Environment file must not be packaged: ${path.relative(frontendOutput, fullPath)}`,
    );
  }
}

walk(frontendOutput);
console.log(
  "Frontend Node/Cloud Run artifact contains server entry, assets and no environment files.",
);
