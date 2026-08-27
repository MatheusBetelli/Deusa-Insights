import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { collectSpecFiles, countDeclaredTests } = require("./test-suite-utils.cjs");
const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const frontendDirectory = join(scriptsDirectory, "..", "frontend");
const files = collectSpecFiles(join(frontendDirectory, "src"));
const declaredTests = countDeclaredTests(files);

process.env.NODE_ENV ??= "test";

test("frontend test suite discovery is complete", () => {
  assert.ok(files.length >= 8, `Expected at least 8 spec files, found ${files.length}`);
  assert.ok(declaredTests >= 16, `Expected at least 16 declared tests, found ${declaredTests}`);
});

for (const file of files) {
  await import(pathToFileURL(file).href);
}
