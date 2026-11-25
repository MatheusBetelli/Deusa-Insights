import assert from "node:assert/strict";
import test from "node:test";
import { GoneException } from "@nestjs/common";
import { ImportsController } from "../imports.controller";
import { ReceitaFederalProvider } from "./receita-federal.provider";

test("busca e sincronização descontinuadas encerram antes de acessar arquivos ou banco", () => {
  assert.throws(() => new ImportsController({} as never).importCnpj(), GoneException);
  assert.throws(() => new ReceitaFederalProvider().getCompanyByCnpj(), GoneException);
});
