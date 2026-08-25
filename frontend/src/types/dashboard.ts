export type DashboardPeriod =
  | "selected_month"
  | "current_month"
  | "last_3_months"
  | "last_6_months"
  | "last_12_months";

export type DashboardQuery = {
  period?: DashboardPeriod;
  month?: number;
  year?: number;
  uf?: string;
  city?: string;
  cnae?: string;
  assignedToId?: string;
};

type DashboardResponsible = {
  id: string;
  name: string;
  email: string;
};

export type DashboardSegment = {
  key: string;
  name: string;
  count: number;
  percentage: number;
};

type DashboardPeriodInfo = {
  key: DashboardPeriod;
  label: string;
  start: string;
  end: string;
  previousStart: string;
  previousEnd: string;
};

export type CityExpansion = {
  city: string;
  clients: number;
  opportunities: number;
  totalMarket: number;
  coveragePercentage: number;
  expansionPercentage: number;
};

export type MonthlyEvolutionPoint = {
  month: string;
  year: number;
  activeClients: number;
  positivatedClients: number;
  negotiationsCount?: number;
  newLeads?: number;
};

type CityTerritorialRanking = {
  rank: number;
  city: string;
  territorialScore: number;
  criticalCount: number;
  qualifiedCount: number;
  totalCompanies: number;
  distanceGarcaKm: number;
  cnaeFocusDescription: string;
};

export type DashboardSummary = {
  period: DashboardPeriodInfo;
  filters: {
    responsibles: DashboardResponsible[];
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
  expansionByCity: CityExpansion[];
  monthlyEvolution: MonthlyEvolutionPoint[];

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
  topRegions?: CityTerritorialRanking[];
  statusDistribution?: { name: string; count: number }[];
  potentialDistribution?: { name: string; count: number }[];
  cityDistribution?: { city: string; total: number }[];
  monthlyTrend?: { mes: string; novosLeads: number; convertidos: number }[];
};
