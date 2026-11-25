import type { LeadsB2BSearch } from "@/features/leads/types/search";
import { LeadsB2B } from "@/features/leads/pages/LeadsB2B";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/leads-b2b")({
  validateSearch: (search: Record<string, unknown>): LeadsB2BSearch => ({
    search: typeof search.search === "string" ? search.search : undefined,
    uf: typeof search.uf === "string" ? search.uf : undefined,
    city: typeof search.city === "string" ? search.city : undefined,
    cnae: typeof search.cnae === "string" ? search.cnae : undefined,
    status: typeof search.status === "string" ? search.status : undefined,
    potentialLevel: typeof search.potentialLevel === "string" ? search.potentialLevel : undefined,
    statusVerificacaoEndereco:
      typeof search.statusVerificacaoEndereco === "string"
        ? search.statusVerificacaoEndereco
        : undefined,
    pendenteValidacao:
      typeof search.pendenteValidacao === "string" ? search.pendenteValidacao : undefined,
    situacaoCadastral:
      typeof search.situacaoCadastral === "string" ? search.situacaoCadastral : undefined,
    sortBy: typeof search.sortBy === "string" ? search.sortBy : undefined,
    sortOrder:
      search.sortOrder === "asc" || search.sortOrder === "desc" ? search.sortOrder : undefined,
    page:
      typeof search.page === "number"
        ? search.page
        : typeof search.page === "string"
          ? parseInt(search.page, 10) || 1
          : undefined,
  }),
  component: LeadsB2B,
});
