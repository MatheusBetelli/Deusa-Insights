import assert from "node:assert/strict";
import test from "node:test";
import { Response } from "express";
import { AUTH_COOKIE_NAME, AuthController, getAuthCookieOptions } from "./auth.controller";

test("login grava JWT somente no cookie httpOnly e nao o devolve no JSON", async () => {
  let cookieName: string | undefined;
  let cookieValue: string | undefined;
  let cookieOptions: unknown;
  const response = {
    cookie(name: string, value: string, options: unknown) {
      cookieName = name;
      cookieValue = value;
      cookieOptions = options;
      return this;
    },
  } as Response;
  const controller = new AuthController({
    login: async () => ({
      accessToken: "jwt-secret-value",
      user: { id: "usr-1", name: "User", email: "user@example.test", role: "SALES" },
    }),
  } as never);

  const result = await controller.login(
    { email: "user@example.test", password: "password", rememberMe: false },
    response,
  );

  assert.equal(cookieName, AUTH_COOKIE_NAME);
  assert.equal(cookieValue, "jwt-secret-value");
  assert.deepEqual(cookieOptions, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
  });
  assert.deepEqual(result, {
    user: { id: "usr-1", name: "User", email: "user@example.test", role: "SALES" },
  });
  assert.equal("accessToken" in result, false);
});

test("cookie persistente respeita a expiracao de oito horas do JWT", () => {
  assert.equal(getAuthCookieOptions(true).maxAge, 8 * 60 * 60 * 1000);
  assert.equal(getAuthCookieOptions(false).maxAge, undefined);
});
