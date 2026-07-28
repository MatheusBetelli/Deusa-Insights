import test from "node:test";
import assert from "node:assert/strict";
import { cn } from "./utils";

test("cn combina classes de forma condicional e remove conflitos tailwind", () => {
  assert.equal(cn("px-2 py-1", "bg-blue-500"), "px-2 py-1 bg-blue-500");
  assert.equal(cn("px-2", false && "hidden", "py-1"), "px-2 py-1");
  assert.equal(cn("p-4", "p-2"), "p-2");
});
