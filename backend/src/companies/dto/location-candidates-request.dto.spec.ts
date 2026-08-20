import "reflect-metadata";
import assert from "node:assert";
import { test } from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { LocationCandidatesRequestDto } from "./location-candidates-request.dto";

test("LocationCandidatesRequestDto exige confirmação explícita da chamada paga", async () => {
  for (const input of [{}, { confirmPaidRequest: false }, { confirmPaidRequest: "false" }]) {
    const dto = plainToInstance(LocationCandidatesRequestDto, input, {
      enableImplicitConversion: true,
    });

    assert.ok((await validate(dto)).some((error) => error.property === "confirmPaidRequest"));
  }
});

test("LocationCandidatesRequestDto aceita somente confirmação verdadeira", async () => {
  const dto = plainToInstance(
    LocationCandidatesRequestDto,
    { confirmPaidRequest: true },
    { enableImplicitConversion: true },
  );

  assert.strictEqual((await validate(dto)).length, 0);
  assert.strictEqual(dto.confirmPaidRequest, true);
});
