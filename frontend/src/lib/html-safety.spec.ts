import assert from "node:assert";
import { test } from "node:test";
import { escapeHtml, escapeHtmlAttribute, safePathSegment } from "./html-safety";

test("escapeHtml trata payloads XSS como texto", () => {
  const payload = `<img src=x onerror="alert('xss')">`;

  assert.strictEqual(
    escapeHtml(payload),
    "&lt;img src=x onerror=&quot;alert(&#39;xss&#39;)&quot;&gt;",
  );
});

test("escapeHtmlAttribute escapa aspas e ampersands para atributos HTML", () => {
  assert.strictEqual(escapeHtmlAttribute(`https://example.test?a=1&b="x"`), "https://example.test?a=1&amp;b=&quot;x&quot;");
});

test("safePathSegment codifica IDs antes de montar paths internos", () => {
  assert.strictEqual(safePathSegment("../lead<script>"), "..%2Flead%3Cscript%3E");
});
