export type EmailDelivery = {
  recipientEmail: string;
  isRelay: boolean;
};

/**
 * Resend's shared test sender only delivers to the account owner's address.
 * This explicit override supports the MVP relay flow without silently changing
 * the recipient in normal operation. Production must never use this relay.
 */
export function resolveEmailDelivery(targetEmail: string): EmailDelivery {
  const normalizedTarget = targetEmail.trim().toLowerCase();
  const configuredRecipient = process.env.RESEND_TEST_RECIPIENT?.trim().toLowerCase();
  const isProduction = process.env.NODE_ENV?.trim().toLowerCase() === "production";

  if (!configuredRecipient || configuredRecipient === normalizedTarget || isProduction) {
    return { recipientEmail: normalizedTarget, isRelay: false };
  }

  return { recipientEmail: configuredRecipient, isRelay: true };
}
