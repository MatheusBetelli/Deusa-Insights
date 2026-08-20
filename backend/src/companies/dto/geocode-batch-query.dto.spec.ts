import 'reflect-metadata';
import assert from "node:assert";
import { test } from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { GeocodeBatchQueryDto } from "./geocode-batch-query.dto";
import { VerifyGoogleBatchQueryDto } from "./verify-google-batch-query.dto";

test("GeocodeBatchQueryDto normaliza CNAE formatado e boolean de query string", async () => {
  const dto = plainToInstance(
    GeocodeBatchQueryDto,
    {
      cnaeCode: "4712-1/00",
      limit: "25",
      force: "true",
    },
    { enableImplicitConversion: true },
  );

  const errors = await validate(dto);

  assert.strictEqual(errors.length, 0);
  assert.strictEqual(dto.cnaeCode, "4712100");
  assert.strictEqual(dto.limit, 25);
  assert.strictEqual(dto.force, true);
});

test("DTOs de lote preservam false com conversao implicita habilitada", async () => {
  const geocode = plainToInstance(
    GeocodeBatchQueryDto,
    { force: "false" },
    { enableImplicitConversion: true },
  );
  const verification = plainToInstance(
    VerifyGoogleBatchQueryDto,
    { dryRun: "false" },
    { enableImplicitConversion: true },
  );

  assert.strictEqual((await validate(geocode)).length, 0);
  assert.strictEqual((await validate(verification)).length, 0);
  assert.strictEqual(geocode.force, false);
  assert.strictEqual(verification.dryRun, false);
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
