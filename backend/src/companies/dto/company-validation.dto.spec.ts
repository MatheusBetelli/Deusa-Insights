import test from "node:test";
import assert from "node:assert/strict";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateCompanyDto } from "./create-company.dto";
import { ValidateLocationDto } from "./validate-location.dto";

test("CreateCompanyDto normaliza CNPJ e rejeita coordenadas fora do planeta", async () => {
  const dto = plainToInstance(CreateCompanyDto, {
    cnpj: "11.222.333/0001-81",
    razaoSocial: "Mercado Teste",
    situacaoCadastral: "ATIVA",
    uf: "SP",
    cidade: "Garça",
    latitude: 91,
    longitude: -49.6,
  });
  const errors = await validate(dto);

  assert.equal(dto.cnpj, "11222333000181");
  assert.ok(errors.some((error) => error.property === "latitude"));
});

test("ValidateLocationDto rejeita estados, URLs e datas fora do contrato", async () => {
  const dto = plainToInstance(ValidateLocationDto, {
    statusValidacao: "qualquer_valor",
    origemCoordenada: "origem_inventada",
    urlEvidencia: "javascript:alert(1)",
    dataVisita: "amanhã",
  });
  const properties = new Set((await validate(dto)).map((error) => error.property));

  assert.ok(properties.has("statusValidacao"));
  assert.ok(properties.has("origemCoordenada"));
  assert.ok(properties.has("urlEvidencia"));
  assert.ok(properties.has("dataVisita"));
});
