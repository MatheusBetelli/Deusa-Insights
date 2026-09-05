import { Injectable } from "@nestjs/common";
import { LeadStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  hasFullPortfolioAccess,
  leadAccessCacheKey,
  LeadAccessActor,
} from "../common/lead-access.policy";
import { DashboardPeriod, DashboardQueryDto } from "./dto/dashboard-query.dto";
import { buildDashboardFilters, buildUnattendedOpportunityWhere } from "./dashboard-filters";

type CountByCity = {
  city: string;
  clients: number;
  opportunities: number;
};

const ROLLING_PERIOD_MONTHS: Partial<Record<DashboardPeriod, number>> = {
  last_3_months: 3,
  last_6_months: 6,
  last_12_months: 12,
};

type DashboardSegment = {
  key: string;
  name: string;
  count: number;
  percentage: number;
};

type DashboardSummaryResponse = {
  period: {
    key: DashboardPeriod;
    label: string;
    start: string;
    end: string;
    previousStart: string;
    previousEnd: string;
  };
  filters: {
    responsibles: Array<{ id: string; name: string; email: string }>;
    unsupported: string[];
  };
  portfolio: {
    totalClients: number;
    activeClients: number;
    inactiveClients: number;
    newClientsInBase: number;
    distribution: DashboardSegment[];
  };
  positivation: {
    total: number;
    portfolioPercentage: number;
    previousTotal: number;
    comparisonAvailable: boolean;
    deltaPercentage: number | null;
    distribution: DashboardSegment[];
  };
  coverage: {
    clients: number;
    opportunities: number;
    totalMarket: number;
    percentage: number;
    expansionPercentage: number;
  };
  expansionByCity: Array<
    CountByCity & {
      totalMarket: number;
      coveragePercentage: number;
      expansionPercentage: number;
    }
  >;
  monthlyEvolution: Array<{
    month: string;
    year: number;
    activeClients: number;
    positivatedClients: number;
    negotiationsCount: number;
    newLeads: number;
  }>;
  potentialClients: number;
  activeClients: number;
  inactiveClients: number;
  criticalOpportunities: number;
  monitoredCities: number;
  monitoredCnaes: number;
  priorityCity: string | null;
  priorityCnae: string | null;
  priorityMetrics?: {
    territorialScore: number;
    criticalCount: number;
    qualifiedCount: number;
    distanceGarcaKm: number;
    cnaeFocusDescription: string;
  };
  topRegions: Array<{
    rank: number;
    city: string;
    territorialScore: number;
    criticalCount: number;
    qualifiedCount: number;
    totalCompanies: number;
    distanceGarcaKm: number;
    cnaeFocusDescription: string;
  }>;
  statusDistribution: Array<{ name: string; count: number }>;
  potentialDistribution: Array<{ name: string; count: number }>;
  cityDistribution: Array<{ city: string; total: number }>;
  monthlyTrend: Array<{ mes: string; novosLeads: number; convertidos: number }>;
};

const POSITIVATION_STATUSES: LeadStatus[] = [
  LeadStatus.CONTACTED,
  LeadStatus.INTERESTED,
  LeadStatus.NEGOTIATION,
  LeadStatus.CONVERTED,
];

const monthLabels = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

function formatCnae(code?: string | null) {
  const digits = code?.replace(/\D/g, "") ?? "";
  if (digits.length !== 7) return code ?? null;
  return digits.replace(/^(\d{4})(\d)(\d{2})$/, "$1-$2/$3");
}

function startOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addMonths(date: Date, amount: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1));
}

function pct(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

function pctDelta(current: number, previous: number) {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function resolvePeriod(query: DashboardQueryDto) {
  const now = new Date();
  const period: DashboardPeriod = query.period ?? "current_month";
  const currentMonthStart = startOfMonth(now);

  let start: Date;
  let end: Date;
  let months: number;

  const rollingMonths = ROLLING_PERIOD_MONTHS[period];
  if (rollingMonths) {
    months = rollingMonths;
    start = addMonths(currentMonthStart, -(months - 1));
    end = addMonths(currentMonthStart, 1);
  } else {
    const year = query.year ?? now.getUTCFullYear();
    const month = query.month ?? now.getUTCMonth() + 1;
    start = new Date(Date.UTC(year, month - 1, 1));
    end = addMonths(start, 1);
    months = 1;
  }

  const previousEnd = start;
  const previousStart = addMonths(previousEnd, -months);

  return {
    key: period,
    start,
    end,
    previousStart,
    previousEnd,
    months,
    label:
      months === 1
        ? `${monthLabels[start.getUTCMonth()]}/${start.getUTCFullYear()}`
        : `${monthLabels[start.getUTCMonth()]}/${start.getUTCFullYear()} - ${monthLabels[addMonths(end, -1).getUTCMonth()]}/${addMonths(end, -1).getUTCFullYear()}`,
  };
}

function periodWhere(start: Date, end: Date): Prisma.DateTimeFilter {
  return { gte: start, lt: end };
}

@Injectable()
export class DashboardService {
  private summaryCache = new Map<string, { data: DashboardSummaryResponse; expiresAt: number }>();

  clearCache() {
    this.summaryCache.clear();
  }

  constructor(private readonly prisma: PrismaService) {}

  async summary(
    query: DashboardQueryDto = {},
    actor: LeadAccessActor,
  ): Promise<DashboardSummaryResponse> {
    const period = resolvePeriod(query);
    const cacheKey = `${leadAccessCacheKey(actor)}_${period.key}_${period.start.getTime()}_${period.end.getTime()}_${query.uf || "all"}_${query.city || "all"}_${query.cnae || "all"}_${query.assignedToId || "all"}`;
    const cached = this.summaryCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const {
      city,
      clientBaseWhere,
      confirmedClientWhere,
      opportunityWhere,
      companyBaseWhere,
      hasPortfolioFilter,
      leadBaseWhere,
      portfolioLeadWhere,
      uf,
    } = buildDashboardFilters(query, period.end, actor);

    const [
      currentClients,
      inactiveClients,
      newClientsInBase,
      unattendedOpportunities,
      positivatedClients,
      previousPositivatedClients,
      activeLeads,
      inactiveLeadCount,
      criticalOpportunities,
      monitoredCities,
      monitoredCnaes,
      statusCounts,
      potentialCounts,
      topCnae,
      responsibles,
    ] = await Promise.all([
      this.prisma.clientAccount.count({
        where: confirmedClientWhere,
      }),
      this.prisma.lead.count({
        where: {
          ...leadBaseWhere,
          OR: [{ status: LeadStatus.INACTIVE }, { status: LeadStatus.NOT_INTERESTED }],
          company: {
            ...companyBaseWhere,
            clientAccounts: { none: { isCurrentClient: true } },
          },
        },
      }),
      this.prisma.clientAccount.count({
        where: {
          ...clientBaseWhere,
          isCurrentClient: true,
          createdAt: periodWhere(period.start, period.end),
        },
      }),
      this.prisma.company.count({
        where: opportunityWhere,
      }),
      this.prisma.lead.count({
        where: {
          ...leadBaseWhere,
          status: { in: POSITIVATION_STATUSES },
          lastContactAt: periodWhere(period.start, period.end),
          company: {
            ...companyBaseWhere,
            createdAt: { lt: period.end },
          },
          OR: [
            { status: LeadStatus.CONVERTED },
            { company: { clientAccounts: { some: { isCurrentClient: true } } } },
          ],
        },
      }),
      this.prisma.lead.count({
        where: {
          ...leadBaseWhere,
          status: { in: POSITIVATION_STATUSES },
          lastContactAt: periodWhere(period.previousStart, period.previousEnd),
          company: {
            ...companyBaseWhere,
            createdAt: { lt: period.previousEnd },
          },
          OR: [
            { status: LeadStatus.CONVERTED },
            { company: { clientAccounts: { some: { isCurrentClient: true } } } },
          ],
        },
      }),
      this.prisma.lead.count({
        where: {
          ...leadBaseWhere,
          status: { notIn: [LeadStatus.CONVERTED, LeadStatus.INACTIVE, LeadStatus.NOT_INTERESTED] },
        },
      }),
      this.prisma.lead.count({ where: { ...leadBaseWhere, status: LeadStatus.INACTIVE } }),
      this.prisma.lead.count({ where: { ...leadBaseWhere, potentialLevel: "CRITICAL" } }),
      this.prisma.city.count({ where: { isActive: true } }),
      this.prisma.cnae.count({ where: { isTarget: true } }),
      this.prisma.lead.groupBy({
        by: ["status"],
        where: leadBaseWhere,
        _count: { id: true },
      }),
      this.prisma.lead.groupBy({
        by: ["potentialLevel"],
        where: {
          ...leadBaseWhere,
          status: { notIn: [LeadStatus.CONVERTED, LeadStatus.INACTIVE, LeadStatus.NOT_INTERESTED] },
          company: {
            ...companyBaseWhere,
            clientAccounts: { none: { isCurrentClient: true } },
            createdAt: { lt: period.end },
          },
        },
        _count: { id: true },
      }),
      this.prisma.company.groupBy({
        by: ["cnaePrincipal"],
        where: {
          AND: [
            companyBaseWhere,
            ...(hasPortfolioFilter ? [{ lead: { is: portfolioLeadWhere } }] : []),
          ],
        },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 1,
      }),
      this.prisma.profile.findMany({
        where: {
          ...(!hasFullPortfolioAccess(actor) && actor.email ? { email: actor.email } : {}),
          assignedLeads: {
            some: {
              company: {
                situacaoCadastral: "ATIVA",
                ...(uf ? { uf } : {}),
                ...(city ? { cidade: { equals: city, mode: "insensitive" } } : {}),
              },
            },
          },
        },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const marketTotal = currentClients + unattendedOpportunities;
    const coveragePercent = pct(currentClients, marketTotal);
    const expansionPercent = pct(unattendedOpportunities, marketTotal);

    const portfolioDistribution = [
      { key: "active", name: "Ativos", count: currentClients },
      ...(inactiveClients > 0
        ? [{ key: "inactive", name: "Inativos", count: inactiveClients }]
        : []),
    ].map((item) => ({ ...item, percentage: pct(item.count, currentClients + inactiveClients) }));

    const positivationDistribution = [
      {
        key: "active",
        name: "Ativos",
        count: positivatedClients,
        percentage: pct(positivatedClients, Math.max(1, currentClients)),
      },
    ];

    const cityExpansion = await this.getCityExpansion({
      companyBaseWhere,
      hasPortfolioFilter,
      portfolioLeadWhere,
      periodEnd: period.end,
    });

    const evolutionStart = period.months === 1 ? addMonths(period.start, -5) : period.start;

    const monthlyEvolution = await this.getMonthlyEvolution({
      periodStart: evolutionStart,
      periodEnd: period.end,
      companyBaseWhere,
      clientBaseWhere,
      leadBaseWhere,
    });

    const statusMap: Record<string, string> = {
      NEW: "Novos Leads",
      NO_CONTACT: "Sem contato",
      CONTACTED: "Contatados",
      INTERESTED: "Interessados",
      NEGOTIATION: "Em Negociação",
      CONVERTED: "Convertidos",
      INACTIVE: "Inativos",
      NOT_INTERESTED: "Sem Interesse",
    };

    const levelMap: Record<string, string> = {
      CRITICAL: "Oportunidades Críticas",
      HIGH: "Alto Potencial",
      MEDIUM: "Médio Potencial",
      LOW: "Baixo Potencial",
    };

    const priorityCityInfo = cityExpansion[0] ?? null;

    const result: DashboardSummaryResponse = {
      period: {
        key: period.key,
        label: period.label,
        start: period.start.toISOString(),
        end: period.end.toISOString(),
        previousStart: period.previousStart.toISOString(),
        previousEnd: period.previousEnd.toISOString(),
      },
      filters: {
        responsibles,
        unsupported: [
          "Inativos recentes/antigos dependem de data de ultima compra ou ultima positivacao por cliente.",
          "Novos clientes comerciais e reativados dependem de data de primeira compra/reativacao.",
          "Positivacao usa Lead.lastContactAt de clientes atuais porque ainda nao ha historico de vendas no backend principal.",
        ],
      },
      portfolio: {
        totalClients: currentClients + inactiveClients,
        activeClients: currentClients,
        inactiveClients,
        newClientsInBase,
        distribution: portfolioDistribution,
      },
      positivation: {
        total: positivatedClients,
        portfolioPercentage: pct(positivatedClients, currentClients),
        previousTotal: previousPositivatedClients,
        comparisonAvailable: positivatedClients > 0 || previousPositivatedClients > 0,
        deltaPercentage: pctDelta(positivatedClients, previousPositivatedClients),
        distribution: positivationDistribution,
      },
      coverage: {
        clients: currentClients,
        opportunities: unattendedOpportunities,
        totalMarket: marketTotal,
        percentage: coveragePercent,
        expansionPercentage: expansionPercent,
      },
      expansionByCity: cityExpansion,
      monthlyEvolution,

      potentialClients: activeLeads,
      activeClients: currentClients,
      inactiveClients: inactiveLeadCount,
      criticalOpportunities,
      monitoredCities,
      monitoredCnaes,
      priorityCity: priorityCityInfo?.city ?? null,
      priorityCnae: formatCnae(topCnae[0]?.cnaePrincipal),
      priorityMetrics: priorityCityInfo
        ? {
            territorialScore: Math.round(priorityCityInfo.expansionPercentage),
            criticalCount: priorityCityInfo.opportunities,
            qualifiedCount: priorityCityInfo.opportunities,
            distanceGarcaKm: 0,
            cnaeFocusDescription: "Espaço comercial disponível calculado por cobertura",
          }
        : undefined,
      topRegions: cityExpansion.map((item, index) => ({
        rank: index + 1,
        city: item.city,
        territorialScore: Math.round(item.expansionPercentage),
        criticalCount: item.opportunities,
        qualifiedCount: item.opportunities,
        totalCompanies: item.clients + item.opportunities,
        distanceGarcaKm: 0,
        cnaeFocusDescription: "Espaço comercial disponível",
      })),
      statusDistribution: statusCounts.map((sc) => ({
        name: statusMap[sc.status] || sc.status,
        count: sc._count.id,
      })),
      potentialDistribution: potentialCounts.map((pc) => ({
        name: levelMap[pc.potentialLevel] || pc.potentialLevel,
        count: pc._count.id,
      })),
      cityDistribution: cityExpansion.slice(0, 6).map((item) => ({
        city: item.city,
        total: item.opportunities,
      })),
      monthlyTrend: monthlyEvolution.map((item) => ({
        mes: item.month,
        novosLeads: item.newLeads,
        convertidos: item.activeClients,
      })),
    };

    this.summaryCache.set(cacheKey, { data: result, expiresAt: Date.now() + 30000 });
    return result;
  }

  private async getCityExpansion(args: {
    companyBaseWhere: Prisma.CompanyWhereInput;
    hasPortfolioFilter: boolean;
    portfolioLeadWhere: Prisma.LeadWhereInput;
    periodEnd: Date;
  }) {
    const { companyBaseWhere, hasPortfolioFilter, portfolioLeadWhere, periodEnd } = args;

    const [clientsByCity, opportunitiesByCity] = await Promise.all([
      this.prisma.company.groupBy({
        by: ["cidade"],
        where: {
          ...companyBaseWhere,
          createdAt: { lt: periodEnd },
          clientAccounts: { some: { isCurrentClient: true } },
          ...(hasPortfolioFilter ? { lead: { is: portfolioLeadWhere } } : {}),
        },
        _count: { id: true },
      }),
      this.prisma.company.groupBy({
        by: ["cidade"],
        where: buildUnattendedOpportunityWhere(args),
        _count: { id: true },
      }),
    ]);

    const byCity = new Map<string, CountByCity>();

    for (const item of clientsByCity) {
      const city = item.cidade?.trim() || "Sem cidade";
      const current = byCity.get(city) ?? { city, clients: 0, opportunities: 0 };
      current.clients += item._count.id;
      byCity.set(city, current);
    }

    for (const item of opportunitiesByCity) {
      const city = item.cidade?.trim() || "Sem cidade";
      const current = byCity.get(city) ?? { city, clients: 0, opportunities: 0 };
      current.opportunities += item._count.id;
      byCity.set(city, current);
    }

    return Array.from(byCity.values())
      .map((item) => {
        const total = item.clients + item.opportunities;
        return {
          ...item,
          totalMarket: total,
          coveragePercentage: pct(item.clients, total),
          expansionPercentage: pct(item.opportunities, total),
        };
      })
      .filter((item) => item.totalMarket > 0)
      .sort(
        (a, b) =>
          b.expansionPercentage - a.expansionPercentage || b.opportunities - a.opportunities,
      )
      .slice(0, 8);
  }

  private async getMonthlyEvolution(args: {
    periodStart: Date;
    periodEnd: Date;
    companyBaseWhere: Prisma.CompanyWhereInput;
    clientBaseWhere: Prisma.ClientAccountWhereInput;
    leadBaseWhere: Prisma.LeadWhereInput;
  }) {
    const { periodStart, periodEnd, companyBaseWhere, clientBaseWhere, leadBaseWhere } = args;
    const result = [];

    for (
      let cursor = startOfMonth(periodStart);
      cursor < periodEnd;
      cursor = addMonths(cursor, 1)
    ) {
      const next = addMonths(cursor, 1);
      const monthEnd = next < periodEnd ? next : periodEnd;

      const [activeClients, positivatedClients, negotiationsCount, newLeads] = await Promise.all([
        this.prisma.clientAccount.count({
          where: { ...clientBaseWhere, isCurrentClient: true, createdAt: { lt: monthEnd } },
        }),
        this.prisma.lead.count({
          where: {
            ...leadBaseWhere,
            status: { in: POSITIVATION_STATUSES },
            lastContactAt: periodWhere(cursor, monthEnd),
            company: companyBaseWhere,
            OR: [
              { status: LeadStatus.CONVERTED },
              { company: { clientAccounts: { some: { isCurrentClient: true } } } },
            ],
          },
        }),
        this.prisma.lead.count({
          where: {
            ...leadBaseWhere,
            status: LeadStatus.NEGOTIATION,
            lastContactAt: periodWhere(cursor, monthEnd),
            company: companyBaseWhere,
          },
        }),
        this.prisma.lead.count({
          where: {
            ...leadBaseWhere,
            createdAt: periodWhere(cursor, monthEnd),
            company: companyBaseWhere,
          },
        }),
      ]);

      result.push({
        month: monthLabels[cursor.getUTCMonth()],
        year: cursor.getUTCFullYear(),
        activeClients,
        positivatedClients,
        negotiationsCount,
        newLeads,
      });
    }

    return result;
  }
}
