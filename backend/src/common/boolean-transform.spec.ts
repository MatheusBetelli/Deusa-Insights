import assert from "node:assert/strict";
import test from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { LoginDto } from "../auth/dto/login.dto";
import { CreateCityDto } from "../cities/dto/create-city.dto";
import { CreateCnaeDto } from "../cnaes/dto/create-cnae.dto";

test("boolean DTO transforms preserve the string false", async () => {
  const login = plainToInstance(
    LoginDto,
    { email: "user@example.test", password: "password", rememberMe: "false" },
    { enableImplicitConversion: true },
  );
  const city = plainToInstance(
    CreateCityDto,
    { name: "Garca", uf: "SP", isActive: "false" },
    { enableImplicitConversion: true },
  );
  const cnae = plainToInstance(
    CreateCnaeDto,
    { code: "4712100", description: "Minimercados", isTarget: "false" },
    { enableImplicitConversion: true },
  );

  assert.equal(login.rememberMe, false);
  assert.equal(city.isActive, false);
  assert.equal(cnae.isTarget, false);
  assert.deepEqual(await validate(login), []);
  assert.deepEqual(await validate(city), []);
  assert.deepEqual(await validate(cnae), []);
});

test("boolean DTO transforms reject values outside true and false", async () => {
  const dto = plainToInstance(
    CreateCityDto,
    { name: "Garca", uf: "SP", isActive: "yes" },
    { enableImplicitConversion: true },
  );

  assert.equal((await validate(dto)).length, 1);
});
