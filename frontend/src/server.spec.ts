import assert from "node:assert/strict";
import test from "node:test";
import { buildBackendUrl, resolveBackendOrigin } from "./server";

test("proxy preserva a origem fixa mesmo com caminho iniciado por duas barras", () => {
  const upstream = buildBackendUrl(
    new URL("https://frontend.example.test/api//attacker.example.test/path?city=Marilia"),
    { BACKEND_ORIGIN: "https://backend.example.test" },
  );

  assert.equal(upstream.origin, "https://backend.example.test");
  assert.equal(upstream.pathname, "//attacker.example.test/path");
  assert.equal(upstream.search, "?city=Marilia");
});

test("origem do backend rejeita caminho, credenciais e protocolo nao HTTP", () => {
  assert.throws(() => resolveBackendOrigin({ BACKEND_ORIGIN: "https://backend.example.test/v1" }));
  assert.throws(() =>
    resolveBackendOrigin({ BACKEND_ORIGIN: "https://user:secret@backend.example.test" }),
  );
  assert.throws(() => resolveBackendOrigin({ BACKEND_ORIGIN: "file:///tmp/backend" }));
});
