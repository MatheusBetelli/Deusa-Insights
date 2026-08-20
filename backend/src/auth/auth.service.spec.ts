import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { AuthService } from "./auth.service";

test("resetPassword rejeita reutilização concorrente do mesmo token", async () => {
  const updatedAt = new Date("2026-01-01T00:00:00.000Z");
  const prisma = {
    user: {
      findUnique: async () => ({ id: "user-1", updatedAt }),
      updateMany: async () => ({ count: 0 }),
    },
  };
  const jwt = {
    verifyAsync: async () => ({
      sub: "user-1",
      type: "password_reset",
      ver: updatedAt.getTime(),
    }),
  };
  const service = new AuthService(prisma as never, jwt as never);

  await assert.rejects(
    () =>
      service.resetPassword({
        token: "already-used-token",
        newPassword: "NovaSenhaMuitoForte123!",
        confirmPassword: "NovaSenhaMuitoForte123!",
      }),
    BadRequestException,
  );
});

test("changePassword rejeita atualização concorrente da conta", async () => {
  const updatedAt = new Date("2026-01-01T00:00:00.000Z");
  const service = new AuthService(
    {
      user: {
        findUnique: async () => ({
          id: "user-1",
          updatedAt,
          passwordHash: await bcrypt.hash("senha-atual", 4),
        }),
        updateMany: async () => ({ count: 0 }),
      },
    } as never,
    {} as never,
  );

  await assert.rejects(
    () =>
      service.changePassword("user-1", {
        currentPassword: "senha-atual",
        newPassword: "nova-senha-segura",
        confirmPassword: "nova-senha-segura",
      }),
    BadRequestException,
  );
});

test("forgotPassword aplica timeout, trata erro HTTP e mantém resposta não enumerável", async () => {
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  const originalApiKey = process.env.RESEND_API_KEY;
  const originalFrom = process.env.RESEND_FROM_EMAIL;
  const originalFrontendUrl = process.env.FRONTEND_URL;
  let capturedInit: RequestInit | undefined;
  const loggedErrors: unknown[][] = [];

  try {
    process.env.RESEND_API_KEY = "test-key-never-sent";
    process.env.RESEND_FROM_EMAIL = "noreply@example.test";
    process.env.FRONTEND_URL = "https://app.example.test";
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      capturedInit = init;
      return new Response(null, { status: 429 });
    }) as typeof fetch;
    console.error = (...args: unknown[]) => {
      loggedErrors.push(args);
    };

    const service = new AuthService(
      {
        user: {
          findUnique: async () => ({
            id: "user-1",
            email: "user@example.test",
            name: "Usuário Teste",
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          }),
        },
      } as never,
      { signAsync: async () => "reset-token" } as never,
    );

    const result = await service.forgotPassword("USER@example.test");

    assert.match(result.message, /Se o e-mail estiver cadastrado/);
    assert.ok(capturedInit?.signal instanceof AbortSignal);
    assert.equal(loggedErrors.length, 1);
    assert.match(String(loggedErrors[0][1]), /HTTP 429/);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
    if (originalApiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalApiKey;
    if (originalFrom === undefined) delete process.env.RESEND_FROM_EMAIL;
    else process.env.RESEND_FROM_EMAIL = originalFrom;
    if (originalFrontendUrl === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = originalFrontendUrl;
  }
});
