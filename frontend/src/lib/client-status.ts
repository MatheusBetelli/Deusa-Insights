import type { ClientAccountStatus } from "@/types/company";

export function hasCurrentClientAccount(
  accounts: readonly ClientAccountStatus[] | null | undefined,
): boolean {
  return accounts?.some((account) => account.isCurrentClient === true) ?? false;
}
