import assert from "node:assert/strict";
import test from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateCommercialActionDto } from "./create-commercial-action.dto";

test("ação comercial aceita tipos previstos e observação opcional", async () => {
  const errors = await validate(plainToInstance(CreateCommercialActionDto, { type: "VISITA" }));
  assert.equal(errors.length, 0);
});

test("ação comercial rejeita tipo inválido, observação longa e userId", async () => {
  const errors = await validate(
    plainToInstance(CreateCommercialActionDto, {
      type: "TIPO_INVENTADO",
      description: "x".repeat(2001),
      userId: "attacker-1",
    }),
    { whitelist: true, forbidNonWhitelisted: true },
  );
  assert.ok(errors.length > 0);
  assert.ok(errors.some((error) => error.property === "type"));
  assert.ok(errors.some((error) => error.property === "description"));
  assert.ok(errors.some((error) => error.property === "userId"));
});
