import assert from "node:assert";
import { test } from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { GeocodeBatchQueryDto } from "./geocode-batch-query.dto";

test("GeocodeBatchQueryDto normaliza CNAE formatado e boolean de query string", async () => {
  const dto = plainToInstance(GeocodeBatchQueryDto, {
    cnaeCode: "4712-1/00",
    limit: "25",
    force: "true",
  });

  const errors = await validate(dto);

  assert.strictEqual(errors.length, 0);
  assert.strictEqual(dto.cnaeCode, "4712100");
  assert.strictEqual(dto.limit, 25);
  assert.strictEqual(dto.force, true);
});

test("GeocodeBatchQueryDto rejeita limite excessivo e CNAE malformado", async () => {
  const dto = plainToInstance(GeocodeBatchQueryDto, {
    cnaeCode: "../471",
    limit: "1000",
  });

  const errors = await validate(dto);

  assert.ok(errors.some((error) => error.property === "cnaeCode"));
  assert.ok(errors.some((error) => error.property === "limit"));
});
