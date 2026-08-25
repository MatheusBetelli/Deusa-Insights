const assert = require("node:assert/strict");
const test = require("node:test");
const { join } = require("node:path");
const { collectSpecFiles, countDeclaredTests } = require("./test-suite-utils.cjs");

const backendDirectory = join(__dirname, "..", "backend");
const files = collectSpecFiles(join(backendDirectory, "src"));
const declaredTests = countDeclaredTests(files);

test("backend test suite discovery is complete", () => {
  assert.ok(files.length >= 29, `Expected at least 29 spec files, found ${files.length}`);
  assert.ok(declaredTests >= 78, `Expected at least 78 declared tests, found ${declaredTests}`);
});

for (const file of files) {
  require(file);
}
