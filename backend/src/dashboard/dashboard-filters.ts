import { Prisma } from "@prisma/client";
import { buildCnaeWhereInput, getCnaeVariants } from "../common/opportunity-filter";
import {
  hasFullPortfolioAccess,
  LeadAccessActor,
  scopeLeadWhere,
} from "../common/lead-access.policy";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";

// Shared by the Central Comercial and the funnel; ClientAccount is authoritative.
export function buildDashboardFilters(
  query: DashboardQueryDto,
  periodEnd: Date,
  actor: LeadAccessActor,
) {
  const cnaeVariants = getCnaeVariants(query.cnae);
  const uf = query.uf && query.uf !== "Todos" ? query.uf.toUpperCase() : undefined;
  const city = query.city && query.city !== "Todas" ? query.city.trim() : undefined;
  const assignedToId = query.assignedToId?.trim();
  const portfolioLeadWhere = scopeLeadWhere(assignedToId ? { assignedToId } : {}, actor);
  const hasPortfolioFilter = Boolean(assignedToId) || !hasFullPortfolioAccess(actor);
  const companyFilters: Prisma.CompanyWhereInput[] = [
    { situacaoCadastral: "ATIVA" },
    buildCnaeWhereInput(query.cnae),
  ];
  if (uf) companyFilters.push({ uf });
  if (city) companyFilters.push({ cidade: { equals: city, mode: "insensitive" } });

  const companyBaseWhere: Prisma.CompanyWhereInput = { AND: companyFilters };
  const clientCompanyFilters: Prisma.CompanyWhereInput[] = [];
  if (hasPortfolioFilter) clientCompanyFilters.push({ lead: { is: portfolioLeadWhere } });
  if (cnaeVariants.length > 0) {
    clientCompanyFilters.push({
      OR: [
        { cnaePrincipal: { in: cnaeVariants } },
        { cnaes: { some: { cnaeCode: { in: cnaeVariants } } } },
      ],
    });
  }

  const clientBaseWhere: Prisma.ClientAccountWhereInput = {
    ...(uf ? { uf } : {}),
    ...(city ? { cidade: { equals: city, mode: "insensitive" } } : {}),
    ...(clientCompanyFilters.length > 0 ? { company: { AND: clientCompanyFilters } } : {}),
    createdAt: { lt: periodEnd },
  };
  const leadBaseWhere: Prisma.LeadWhereInput = {
    ...(hasPortfolioFilter ? { AND: [portfolioLeadWhere] } : {}),
    company: companyBaseWhere,
  };

  return {
    city,
    clientBaseWhere,
    confirmedClientWhere: {
      ...clientBaseWhere,
      isCurrentClient: true,
    } satisfies Prisma.ClientAccountWhereInput,
    opportunityWhere: buildUnattendedOpportunityWhere({
      companyBaseWhere,
      hasPortfolioFilter,
      portfolioLeadWhere,
      periodEnd,
    }),
    companyBaseWhere,
    hasPortfolioFilter,
    leadBaseWhere,
    portfolioLeadWhere,
    uf,
  };
}

export function buildUnattendedOpportunityWhere(args: {
  companyBaseWhere: Prisma.CompanyWhereInput;
  hasPortfolioFilter: boolean;
  portfolioLeadWhere: Prisma.LeadWhereInput;
  periodEnd: Date;
}): Prisma.CompanyWhereInput {
  return {
    AND: [
      args.companyBaseWhere,
      { createdAt: { lt: args.periodEnd } },
      // A legacy CONVERTED status alone does not establish an official client.
      { clientAccounts: { none: { isCurrentClient: true } } },
      ...(args.hasPortfolioFilter ? [{ lead: { is: args.portfolioLeadWhere } }] : []),
    ],
  };
}
