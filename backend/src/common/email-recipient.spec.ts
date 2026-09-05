import assert from "node:assert/strict";
import test from "node:test";
import { resolveEmailDelivery } from "./email-recipient";

test("entrega e-mail diretamente quando o destinatário não é redirecionado", () => {
  const previousRecipient = process.env.RESEND_TEST_RECIPIENT;
  delete process.env.RESEND_TEST_RECIPIENT;

  try {
    assert.deepEqual(resolveEmailDelivery("  User@Example.com "), {
      recipientEmail: "user@example.com",
      isRelay: false,
    });
  } finally {
    if (previousRecipient === undefined) delete process.env.RESEND_TEST_RECIPIENT;
    else process.env.RESEND_TEST_RECIPIENT = previousRecipient;
  }
});

test("redireciona o MVP para o e-mail configurado e preserva o destinatário no aviso", () => {
  const previousRecipient = process.env.RESEND_TEST_RECIPIENT;
  process.env.RESEND_TEST_RECIPIENT = "deusaalimentos01@gmail.com";

  try {
    assert.deepEqual(resolveEmailDelivery("brunokmorgado@gmail.com"), {
      recipientEmail: "deusaalimentos01@gmail.com",
      isRelay: true,
    });
  } finally {
    if (previousRecipient === undefined) delete process.env.RESEND_TEST_RECIPIENT;
    else process.env.RESEND_TEST_RECIPIENT = previousRecipient;
  }
});
