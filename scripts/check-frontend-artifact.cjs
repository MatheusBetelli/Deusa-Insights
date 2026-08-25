const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const frontendDist = path.join(__dirname, "..", "frontend", "dist");
const forbiddenNames = new Set([
  "DATABASE_URL",
  "DIRECT_URL",
  "GOOGLE_MAPS_API_KEY",
  "JWT_SECRET",
  "RESEND_API_KEY",
  "VITE_GOOGLE_MAPS_API_KEY",
]);

assert.ok(fs.existsSync(frontendDist), "Frontend dist directory was not generated");

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
      `Environment file must not be packaged: ${path.relative(frontendDist, fullPath)}`,
    );
  }
}

walk(frontendDist);

const workerConfigPath = path.join(frontendDist, "server", "wrangler.json");
const workerConfig = JSON.parse(fs.readFileSync(workerConfigPath, "utf8"));
for (const key of Object.keys(workerConfig.vars ?? {})) {
  assert.equal(forbiddenNames.has(key), false, `Sensitive binding found in Worker vars: ${key}`);
}

console.log("Frontend artifact contains no environment files or sensitive plain-text bindings.");
