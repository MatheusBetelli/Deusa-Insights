export type EmailDelivery = {
  recipientEmail: string;
  isRelay: boolean;
};

/**
 * Resend's shared test sender only delivers to the account owner's address.
 * This explicit override supports the MVP relay flow without silently changing
 * the recipient in normal operation.
 */
export function resolveEmailDelivery(targetEmail: string): EmailDelivery {
  const normalizedTarget = targetEmail.trim().toLowerCase();
  const configuredRecipient = process.env.RESEND_TEST_RECIPIENT?.trim().toLowerCase();

  if (!configuredRecipient || configuredRecipient === normalizedTarget) {
    return { recipientEmail: normalizedTarget, isRelay: false };
  }

  return { recipientEmail: configuredRecipient, isRelay: true };
}
