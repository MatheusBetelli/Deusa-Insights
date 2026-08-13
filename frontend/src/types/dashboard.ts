export type CityTerritorialRanking = {
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
