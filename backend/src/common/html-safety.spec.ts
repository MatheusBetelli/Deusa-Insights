import assert from "node:assert";
import { test } from "node:test";
import { escapeHtml } from "./html-safety";

test("escapeHtml escapa conteudo externo antes de template HTML", () => {
  assert.strictEqual(
    escapeHtml(`<script>alert("x")</script>`),
    "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
  );
});
